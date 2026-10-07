// ASIO AUDIO ENGINE
//
// The app's single audio backend for stimulus playback and microphone
// recording on Windows audio interfaces that ship ASIO drivers (e.g.
// Focusrite). Built on audify (https://github.com/almoghamdani/audify),
// Node bindings for RtAudio. Unlike node-audio-asio, audify bundles
// RtAudio's own ASIO host code and publishes prebuilt Windows binaries, so
// no manual Steinberg SDK step is needed to ship it in the installer.
//
// One full-duplex stream is opened on the chosen device and kept running.
// Output is written by this module one frame ahead of the hardware (a
// constant pre-buffer), so output frame k is always played in the same
// driver callback that captures input frame k. That puts stimulus onsets
// and microphone recordings on one sample clock, which is what makes the
// reaction-time numbers trustworthy.
//
// When ASIO isn't usable (not Windows, disabled in cfg_audio_asio.json,
// audify missing, no ASIO device, or the stream fails to open),
// isEnabled() returns false and callers fall back to their previous
// Web Audio / sox paths. getStatus() says why, so tasks can record which
// backend produced a session's data.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

const CONFIG_FILE_NAME = 'cfg_audio_asio.json';

const DEFAULT_CONFIG = {
    enabled: true,
    // Empty = auto: prefer a device whose name contains "Focusrite",
    // otherwise the first ASIO device found.
    deviceName: '',
    sampleRate: 48000,
    frameSize: 128,
    // 0-based device output channels stimuli are sent to. A mono stimulus is
    // copied to every listed channel; a stereo stimulus sends L/R to the
    // first two.
    outputChannels: [0, 1],
    // 0-based device input channel that recordings are taken from.
    inputChannel: 0,
    // Frames written ahead of the hardware (16 x 128 @ 48 kHz ~= 43 ms).
    // This only delays when a sound starts relative to the play() call; the
    // reported onset times already account for it. Too small and a busy JS
    // event loop (DOM updates, GC) lets the driver run dry.
    prebufferFrames: 16,
    // ASIO reports input+output latency only as a total through RtAudio.
    // Used to convert sample positions to wall-clock (performance.now())
    // times; sample-domain alignment between stimulus and recording does
    // not depend on these.
    outputLatencyMs: null,
    inputLatencyMs: null,
    // dB SPL measured at the earphone with stimulus volume at 100% and the
    // lab's fixed knob settings. Used only for logging estimated SPL
    // (src/shared/audio/stimulus-level.js); null = not calibrated.
    calibrationDbSplAt100: null,
    // Which Focusrite playback pair a Windows output device uses, when its
    // name doesn't say (set from Audio Setup), e.g.
    // { "Speakers (Focusrite USB Audio)": [1, 2] }. Display/clash check only.
    windowsPairs: {}
};

function getConfigDir() {
    if (process.platform === 'win32') {
        return path.join(os.homedir(), 'AppData', 'Roaming', 'Oats', 'task-configurations');
    }
    return path.join(os.homedir(), 'Documents', 'Oats', 'task-configurations');
}

function getConfigPath() {
    return path.join(getConfigDir(), CONFIG_FILE_NAME);
}

function loadConfig() {
    try {
        const parsed = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
        return Object.assign({}, DEFAULT_CONFIG, parsed);
    } catch (error) {
        return Object.assign({}, DEFAULT_CONFIG);
    }
}

function nowMs() {
    return (typeof performance !== 'undefined' ? performance : require('perf_hooks').performance).now();
}

// How long the driver may go without delivering audio before the device
// is treated as disconnected (unplugged, powered off, driver reset).
const DISCONNECT_TIMEOUT_MS = 1500;
const MAX_CACHED_FILES = 150;

// Emits 'statuschange' (with getStatus()) whenever ASIO starts, fails to
// start, disconnects or is shut down, so the UI can react in real time.
class AsioEngine extends EventEmitter {
    constructor() {
        super();
        this.config = loadConfig();
        this.audify = null;
        this.rt = null;
        this.device = null;
        this.started = false;
        this.startAttempted = false;
        this.statusReason = 'not started';
        this.disconnected = false;
        this.watchdog = null;
        this.lastBlockAt = 0;

        this.sampleRate = this.config.sampleRate;
        this.frameSize = this.config.frameSize;
        this.outChannelCount = 0;
        this.inChannelCount = 0;
        this.streamLatencyFrames = 0;

        this.blocksReceived = 0;
        this.framesWritten = 0;
        this.framesConsumed = 0;
        this.underruns = 0;
        this.slip = 0;
        this._silentSamples = [];
        this._slipPending = false;
        this._lastInputAt = null;
        this._queuedAtLastInput = 0;
        // Recent (performance.now() - blockIndex * period) values; the minimum
        // filters out JS delivery jitter when mapping the audio clock to
        // wall-clock time.
        this.clockSamples = [];
        this.clockOffsetMs = null;

        this.outputJobs = [];
        this.activeJob = null;
        // Jobs fully written to the driver queue but not yet played.
        this.pendingDrains = [];

        this.capture = null;
    }

    // ---- configuration / lifecycle ------------------------------------------------

    isPlatformSupported() {
        return process.platform === 'win32';
    }

    getConfigPath() {
        return getConfigPath();
    }

    reloadConfig() {
        this.config = loadConfig();
        return this.config;
    }

    saveConfig(partial) {
        this.config = Object.assign({}, this.config, partial);
        fs.mkdirSync(getConfigDir(), { recursive: true });
        fs.writeFileSync(getConfigPath(), JSON.stringify(this.config, null, 2), 'utf8');
        return this.config;
    }

    // Tries to start the stream the first time it's asked, so every existing
    // `if (asioEngine.isEnabled())` check means "ASIO is actually running".
    isEnabled() {
        if (!this.isPlatformSupported()) { this.statusReason = 'ASIO is only available on Windows'; return false; }
        if (!this.config.enabled) { this.statusReason = 'ASIO is turned off in Audio Setup'; return false; }
        if (!this.started && !this.startAttempted) this._start();
        return this.started;
    }

    async ensureStarted() {
        return this.isEnabled();
    }

    getStatus() {
        return {
            backend: this.started ? 'ASIO' : 'fallback',
            reason: this.started ? null : this.statusReason,
            disconnected: this.disconnected,
            device: this.device ? this.device.name : null,
            sampleRate: this.sampleRate,
            frameSize: this.frameSize,
            outputChannels: this.config.outputChannels,
            inputChannel: this.config.inputChannel,
            streamLatencyFrames: this.streamLatencyFrames,
            streamLatencyMs: this.streamLatencyFrames / this.sampleRate * 1000,
            underruns: this.underruns
        };
    }

    // Short label for results files. A task that uses its own channels
    // passes them ({ outputChannels, inputChannel }, 0-based) so the label
    // names the channels it really used.
    describeBackend(channels = {}) {
        const s = this.getStatus();
        if (s.backend !== 'ASIO') return `Fallback (Web Audio/sox) - ASIO unavailable: ${s.reason}`;
        const out = channels.outputChannels && channels.outputChannels.length ? channels.outputChannels : s.outputChannels;
        const inp = channels.inputChannel != null ? channels.inputChannel : s.inputChannel;
        return `ASIO - ${s.device} @ ${s.sampleRate} Hz, ${s.frameSize}-sample buffer, ` +
            `out ch ${out.map((c) => c + 1).join('+')}, in ch ${inp + 1}, ` +
            `stream latency ${s.streamLatencyMs.toFixed(1)} ms`;
    }

    _loadAudify() {
        if (this.audify) return true;
        try {
            // eslint-disable-next-line global-require
            this.audify = require('audify');
            return true;
        } catch (error) {
            this.statusReason = `audify could not be loaded (${String(error.message).split('\n')[0]})`;
            return false;
        }
    }

    // Lists ASIO devices without opening a stream (for the setup screen).
    listDevices() {
        if (!this.isPlatformSupported() || !this._loadAudify()) return [];
        try {
            const rt = this.rt || new this.audify.RtAudio(this.audify.RtAudioApi.WINDOWS_ASIO);
            return rt.getDevices().map((d) => ({
                id: d.id,
                name: d.name,
                outputChannels: d.outputChannels,
                inputChannels: d.inputChannels,
                sampleRates: d.sampleRates,
                preferredSampleRate: d.preferredSampleRate
            }));
        } catch (error) {
            console.warn('[asio-engine] Could not list ASIO devices:', error.message);
            return [];
        }
    }

    _pickDevice(devices) {
        const wanted = (this.config.deviceName || '').trim().toLowerCase();
        const usable = devices.filter((d) => d.outputChannels > 0 && d.inputChannels > 0);
        if (wanted) {
            return usable.find((d) => d.name.toLowerCase() === wanted) ||
                usable.find((d) => d.name.toLowerCase().includes(wanted)) || null;
        }
        return usable.find((d) => /focusrite/i.test(d.name)) || usable[0] || null;
    }

    _start() {
        this.startAttempted = true;
        if (!this._loadAudify()) {
            console.warn('[asio-engine]', this.statusReason);
            return false;
        }

        const { RtAudio, RtAudioApi, RtAudioFormat } = this.audify;
        try {
            this.rt = new RtAudio(RtAudioApi.WINDOWS_ASIO);
            const device = this._pickDevice(this.rt.getDevices());
            if (!device) {
                this.statusReason = this.config.deviceName
                    ? `ASIO device "${this.config.deviceName}" not found`
                    : 'no ASIO device with both inputs and outputs was found';
                console.warn('[asio-engine]', this.statusReason);
                return false;
            }

            const badOut = this.config.outputChannels.find((c) => c < 0 || c >= device.outputChannels);
            if (badOut !== undefined || this.config.outputChannels.length === 0) {
                this.statusReason = `output channel ${badOut + 1} does not exist on ${device.name} (${device.outputChannels} outputs)`;
                console.warn('[asio-engine]', this.statusReason);
                return false;
            }
            if (this.config.inputChannel < 0 || this.config.inputChannel >= device.inputChannels) {
                this.statusReason = `input channel ${this.config.inputChannel + 1} does not exist on ${device.name} (${device.inputChannels} inputs)`;
                console.warn('[asio-engine]', this.statusReason);
                return false;
            }

            this.device = device;
            // Open every channel so any output/input can be chosen per call.
            this.outChannelCount = device.outputChannels;
            this.inChannelCount = device.inputChannels;

            this.frameSize = this.rt.openStream(
                { deviceId: device.id, nChannels: this.outChannelCount, firstChannel: 0 },
                { deviceId: device.id, nChannels: this.inChannelCount, firstChannel: 0 },
                RtAudioFormat.RTAUDIO_FLOAT32,
                this.config.sampleRate,
                this.config.frameSize,
                'Oats',
                (input) => this._onInputBlock(input),
                () => { this.framesConsumed += 1; },
                0,
                (type, message) => this._onDriverError(type, message)
            );
            this.sampleRate = this.rt.getStreamSampleRate() || this.config.sampleRate;
            this.streamLatencyFrames = this.rt.getStreamLatency() || 0;

            for (let i = 0; i < this.config.prebufferFrames; i++) this._writeNextFrame();
            this.rt.start();
            this.started = true;
            this.disconnected = false;
            this.statusReason = null;
            this._startWatchdog();
            console.log('[asio-engine] Started:', this.describeBackend());
            this._emitStatus();
            return true;
        } catch (error) {
            this.statusReason = `ASIO stream failed to open (${error.message})`;
            console.error('[asio-engine]', this.statusReason);
            try { if (this.rt && this.rt.isStreamOpen()) this.rt.closeStream(); } catch (e) { /* ignore */ }
            this.rt = null;
            this._emitStatus();
            return false;
        }
    }

    _emitStatus() {
        this.emit('statuschange', this.getStatus());
    }

    // ---- disconnect detection -----------------------------------------------------

    // A running ASIO stream delivers an input block every few ms. If none
    // arrive for DISCONNECT_TIMEOUT_MS, the interface has gone away.
    _startWatchdog() {
        this._stopWatchdog();
        this.lastBlockAt = nowMs();
        this.watchdog = setInterval(() => {
            if (!this.started) return;
            if (nowMs() - this.lastBlockAt > DISCONNECT_TIMEOUT_MS) {
                this._handleDisconnect('the interface stopped sending audio');
                return;
            }
            if (this._slipPending && !this._slipCheckTimer) this._checkSlip();
        }, 100);
    }

    _stopWatchdog() {
        if (this._slipCheckTimer) { clearTimeout(this._slipCheckTimer); this._slipCheckTimer = null; }
        if (this.watchdog) clearInterval(this.watchdog);
        this.watchdog = null;
    }

    _onDriverError(type, message) {
        console.error(`[asio-engine] RtAudio error (${type}): ${message}`);
        // WARNING (0) and DEBUG_WARNING (1) are informational.
        if (this.started && type >= 2) this._handleDisconnect(message);
    }

    // Stops using the device and releases anything waiting on it, so tasks
    // carry on with the fallback path instead of hanging.
    _handleDisconnect(reason) {
        if (!this.started) return;
        console.warn(`[asio-engine] ASIO device disconnected: ${reason}`);
        const deviceName = this.device ? this.device.name : 'ASIO device';
        if (this.capture) this.capture.interrupted = true;
        const capture = this.capture;
        this.disconnected = true;
        this.shutdown();
        // Keep a partly-recorded take so the task can still save what it got
        // (it stays marked interrupted and is never resumed).
        this.capture = capture;
        this.startAttempted = true;
        this.statusReason = `${deviceName} disconnected (${reason})`;
        this._emitStatus();
    }

    // Retries opening the ASIO device (e.g. after it is plugged back in).
    // Returns true if ASIO is running afterwards.
    tryReconnect() {
        if (this.started) return true;
        if (!this.config.enabled || !this.isPlatformSupported()) return false;
        const previousReason = this.statusReason;
        this.startAttempted = false;
        const ok = this.isEnabled();
        // While still unplugged, keep saying it's disconnected rather than
        // the generic "no device found".
        if (!ok && this.disconnected) this.statusReason = previousReason;
        return ok;
    }

    // Closes the stream so the next isEnabled() call reopens it with the
    // current config (used after changing settings).
    restart() {
        this.shutdown();
        this.reloadConfig();
        this.startAttempted = false;
        return this.isEnabled();
    }

    // ---- timeline ------------------------------------------------------------------

    _periodMs() {
        return this.frameSize / this.sampleRate * 1000;
    }

    _latencySplitMs() {
        const totalMs = this.streamLatencyFrames / this.sampleRate * 1000;
        const out = this.config.outputLatencyMs != null ? this.config.outputLatencyMs : totalMs / 2;
        const inp = this.config.inputLatencyMs != null ? this.config.inputLatencyMs : totalMs - out;
        return { out, inp };
    }

    // Absolute stream sample index -> performance.now() time of the driver
    // callback that handled it (before hardware latency).
    _sampleToCallbackMs(sampleIndex) {
        if (this.clockOffsetMs == null) return nowMs();
        return this.clockOffsetMs + (sampleIndex / this.frameSize) * this._periodMs();
    }

    // When an output sample is expected to leave the interface.
    outputSampleToPerfMs(sampleIndex) {
        return this._sampleToCallbackMs(sampleIndex) + this._latencySplitMs().out;
    }

    // When the sound recorded at an input sample actually reached the interface.
    inputSampleToPerfMs(sampleIndex) {
        return this._sampleToCallbackMs(sampleIndex) - this._periodMs() - this._latencySplitMs().inp;
    }

    // Stream sample index currently being captured, estimated from the clock.
    perfMsToInputSample(perfMs) {
        if (this.clockOffsetMs == null) return this.blocksReceived * this.frameSize;
        const ms = perfMs + this._periodMs() + this._latencySplitMs().inp - this.clockOffsetMs;
        return Math.round(ms / this._periodMs() * this.frameSize);
    }

    _updateClock(blockIndex, receivedAt) {
        const value = receivedAt - (blockIndex + 1) * this._periodMs();
        this.clockSamples.push(value);
        if (this.clockSamples.length > 500) this.clockSamples.shift();
        let min = Infinity;
        for (const v of this.clockSamples) if (v < min) min = v;
        this.clockOffsetMs = min;
    }

    // ---- real-time pump --------------------------------------------------------------

    _onInputBlock(input) {
        if (!this.started) return;
        const blockIndex = this.blocksReceived;
        this.blocksReceived += 1;
        this.lastBlockAt = nowMs();
        this._updateClock(blockIndex, nowMs());

        if (this.capture && !this.capture.interrupted) this._captureBlock(input, blockIndex);

        // The queue can only run dry if the app went quiet for a good part of
        // the pre-buffer. Only then is the silence count re-measured (the raw
        // event counts jitter, so they must not be acted on otherwise).
        const now = nowMs();
        if (this._lastInputAt != null) {
            // Driver periods that went by while the app was busy, against the
            // audio that was queued (minus slack for events not yet seen).
            const periods = (now - this._lastInputAt) / this._periodMs();
            if (periods > this._queuedAtLastInput - 3) this._beginSlipCheck();
        }
        this._fillOutput();
        this._lastInputAt = now;
        this._queuedAtLastInput = this.framesWritten - this.framesConsumed;
        this._settleJobs();
    }

    // Keeps a small, fixed amount of audio queued in the driver (the
    // pre-buffer), counted against frames the driver has actually played.
    // If the app was busy for longer than that, the driver played silence in
    // the meantime; writing the "missed" frames afterwards would only queue a
    // backlog that delays every later sound. Instead the timeline skips past
    // the silence (this.slip = callbacks that played no audio), so frame
    // index + slip is still the driver callback the frame plays in.
    _fillOutput() {
        while (this.framesWritten - this.framesConsumed < this.config.prebufferFrames) {
            this._writeNextFrame();
        }
    }

    // After the app was busy: hold new sounds (so none starts with a wrong
    // timestamp) and measure how many driver callbacks played silence.
    _beginSlipCheck() {
        this._slipPending = true;
        this._silentSamples = [];
        if (this._slipCheckTimer) return;
        const tick = () => {
            this._slipCheckTimer = null;
            this._checkSlip();
            if (this._slipPending && this.started) this._slipCheckTimer = setTimeout(tick, 15);
        };
        this._slipCheckTimer = setTimeout(tick, 15);
    }

    // Silent driver callbacks = callbacks so far - frames played. The two
    // arrive as separate events, so a single reading can be off by an event
    // or two; it is read from a timer 8 times and the most frequent value
    // taken (ties: the smaller, so jitter never invents a dropout). Silence
    // can't be un-played, so the count only ever goes up.
    _checkSlip() {
        if (!this.started || !this._slipPending) return;
        this._silentSamples.push(this.blocksReceived - this.framesConsumed);
        if (this._silentSamples.length < 8) return;
        const counts = {};
        this._silentSamples.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
        const settled = Number(Object.keys(counts).sort((x, y) => counts[y] - counts[x] || x - y)[0]);
        if (settled > this.slip) this._setSlip(settled);
        this._slipPending = false;
        this._silentSamples = [];
        this._settleJobs();
    }

    // Silent driver callbacks so far changed: shift sounds still waiting to
    // play (they come after the silence). Their timing is flagged unreliable
    // through this.underruns, which every sound and recording compares.
    _setSlip(value) {
        const delta = value - this.slip;
        if (delta === 0) return;
        const firstUnplayed = (this.framesConsumed + this.slip) * this.frameSize;
        const shift = delta * this.frameSize;
        for (const job of [this.activeJob, ...this.pendingDrains, ...this.outputJobs]) {
            if (!job) continue;
            if (job.startSample != null && job.startSample >= firstUnplayed) job.startSample += shift;
            if (job.endSample != null && job.endSample >= firstUnplayed) job.endSample += shift;
        }
        this.slip = value;
        this.underruns += Math.abs(delta);
        const t = nowMs();
        if (!this._lastUnderrunLog || t - this._lastUnderrunLog > 1000) {
            this._lastUnderrunLog = t;
            console.warn(`[asio-engine] Output underrun: the app was busy and the interface played ${this.slip} silent ` +
                'frame(s) so far; sounds/recordings in progress at that moment are flagged unreliable.');
        }
    }

    _writeNextFrame() {
        const frameIndex = this.framesWritten + this.slip;
        const frame = new Float32Array(this.frameSize * this.outChannelCount);

        let i = 0;
        while (i < this.frameSize) {
            if (!this.activeJob) {
                if (this.outputJobs.length === 0 || this._slipPending) break;
                this.activeJob = this.outputJobs.shift();
                this.activeJob.startSample = frameIndex * this.frameSize + i;
                this.activeJob.underrunsAtStart = this.underruns;
                if (this.activeJob.onStart) {
                    // Fires before the first sample is heard (it is still in
                    // the pre-buffer), so callers learn the exact onset early.
                    const onStart = this.activeJob.onStart;
                    this.activeJob.onStart = null;
                    try { onStart(this._jobTiming(this.activeJob, false)); } catch (error) { console.error('[asio-engine] onStart failed:', error); }
                }
            }
            const job = this.activeJob;
            const take = Math.min(this.frameSize - i, job.length - job.position);
            for (let n = 0; n < take; n++) {
                const base = (i + n) * this.outChannelCount;
                for (let r = 0; r < job.routes.length; r++) {
                    const route = job.routes[r];
                    frame[base + route.channel] += route.data[job.position + n] * job.gain;
                }
            }
            job.position += take;
            i += take;
            if (job.position >= job.length) {
                job.endSample = frameIndex * this.frameSize + i;
                this.activeJob = null;
                this.pendingDrains.push(job);
            }
        }

        for (let s = 0; s < frame.length; s++) {
            if (frame[s] > 1) frame[s] = 1;
            else if (frame[s] < -1) frame[s] = -1;
        }

        this.rt.write(Buffer.from(frame.buffer));
        this.framesWritten += 1;
    }

    // Resolves playback promises once their last frame has been handed to
    // the driver.
    _settleJobs() {
        if (this.pendingDrains.length === 0 || this._slipPending) return;
        const playedThrough = this.blocksReceived * this.frameSize;
        while (this.pendingDrains.length > 0 && this.pendingDrains[0].endSample <= playedThrough) {
            const job = this.pendingDrains.shift();
            job.resolve(this._jobTiming(job, false));
        }
    }

    _jobTiming(job, cancelled) {
        return {
            backend: 'ASIO',
            cancelled,
            onsetSample: job.startSample,
            offsetSample: job.endSample,
            onsetPerfMs: job.startSample != null ? this.outputSampleToPerfMs(job.startSample) : null,
            offsetPerfMs: job.endSample != null ? this.outputSampleToPerfMs(job.endSample) : null,
            sampleRate: this.sampleRate,
            timingReliable: job.underrunsAtStart === undefined || job.underrunsAtStart === this.underruns
        };
    }

    // ---- playback ------------------------------------------------------------------

    _resolveRoutes(channelData, outputChannels) {
        const requested = outputChannels && outputChannels.length ? outputChannels : this.config.outputChannels;
        // A task's own channel choice must be honoured exactly: a channel the
        // device doesn't have is an error, not something to quietly drop.
        const missing = requested.filter((c) => !(Number.isInteger(c) && c >= 0 && c < this.outChannelCount));
        if (missing.length) {
            throw new Error(`Output channel ${missing.map((c) => c + 1).join('+')} does not exist on ` +
                `${this.device ? this.device.name : 'the ASIO device'} (${this.outChannelCount} outputs)`);
        }
        const channels = requested;
        if (channels.length === 0) throw new Error('No valid ASIO output channel selected');

        if (channelData.length >= 2 && channels.length >= 2) {
            return channels.map((channel, idx) => ({ channel, data: channelData[idx % 2] }));
        }
        let mono = channelData[0];
        if (channelData.length > 1) {
            mono = new Float32Array(channelData[0].length);
            for (const ch of channelData) for (let n = 0; n < mono.length; n++) mono[n] += ch[n] / channelData.length;
        }
        return channels.map((channel) => ({ channel, data: mono }));
    }

    // Queues decoded audio. options: { volume, outputChannels, onStart }.
    // Resolves with sample-accurate onset/offset timing once played.
    // onStart(timing) is called as soon as the onset is fixed, while the
    // sound is still in the pre-buffer (i.e. before it is heard).
    playChannelData(channelData, options = {}) {
        if (!this.isEnabled()) {
            return Promise.reject(new Error(`ASIO is not available: ${this.statusReason}`));
        }
        let routes;
        try {
            routes = this._resolveRoutes(channelData, options.outputChannels);
        } catch (error) {
            return Promise.reject(error);
        }
        const gain = options.volume == null ? 1 : options.volume;
        return new Promise((resolve) => {
            this.outputJobs.push({
                routes, gain, position: 0, length: routes[0].data.length,
                startSample: null, endSample: null, resolve, onStart: options.onStart || null
            });
        });
    }

    // Plays several parts back to back as one sample-continuous sound, so
    // the gaps between them are exact. Each part is decoded channel data
    // (Float32Array[] at the stream rate), { silenceMs } or
    // { toneHz, durationMs, level, rampMs }. options as for playChannelData.
    // Timing (both for onStart and the resolved value) adds partOnsetSamples
    // and partOnsetPerfMs: when each part starts.
    playSequence(parts, options = {}) {
        const pieces = parts.map((part) => {
            if (Array.isArray(part)) return part;
            if (part.silenceMs != null) return [new Float32Array(Math.max(0, Math.round(part.silenceMs / 1000 * this.sampleRate)))];
            return [this.toneData(part.toneHz, part.durationMs, part.level, part.rampMs)];
        });
        const channelCount = Math.max(...pieces.map((p) => p.length));
        const total = pieces.reduce((n, p) => n + p[0].length, 0);
        const data = Array.from({ length: channelCount }, () => new Float32Array(Math.max(1, total)));
        const offsets = [];
        let position = 0;
        for (const piece of pieces) {
            offsets.push(position);
            for (let c = 0; c < channelCount; c++) data[c].set(piece[c % piece.length], position);
            position += piece[0].length;
        }
        const withParts = (timing) => Object.assign(timing, {
            partOnsetSamples: offsets.map((o) => (timing.onsetSample != null ? timing.onsetSample + o : null)),
            partOnsetPerfMs: offsets.map((o) => (timing.onsetSample != null ? this.outputSampleToPerfMs(timing.onsetSample + o) : null))
        });
        const onStart = options.onStart;
        return this.playChannelData(data, Object.assign({}, options, {
            onStart: onStart ? (timing) => onStart(withParts(timing)) : null
        })).then(withParts);
    }

    async _decodeToStreamRate(arrayBuffer) {
        const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
        if (!Offline) throw new Error('OfflineAudioContext unavailable; ASIO playback must run in the renderer');
        const probe = new Offline(1, 1, this.sampleRate);
        const decoded = await probe.decodeAudioData(arrayBuffer);
        return this.resampleAudioBuffer(decoded);
    }

    // Converts a Web Audio AudioBuffer (any rate) to Float32Array channels at
    // the stream rate, using Chromium's resampler.
    async resampleAudioBuffer(audioBuffer) {
        if (audioBuffer.sampleRate === this.sampleRate) {
            return Array.from({ length: audioBuffer.numberOfChannels }, (_, c) => audioBuffer.getChannelData(c).slice());
        }
        const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
        const length = Math.ceil(audioBuffer.duration * this.sampleRate);
        const ctx = new Offline(audioBuffer.numberOfChannels, Math.max(1, length), this.sampleRate);
        const src = ctx.createBufferSource();
        src.buffer = audioBuffer;
        src.connect(ctx.destination);
        src.start(0);
        const rendered = await ctx.startRendering();
        return Array.from({ length: rendered.numberOfChannels }, (_, c) => rendered.getChannelData(c).slice());
    }

    // Decoded stimuli are cached per path (tasks replay the same files),
    // keeping the most recently used ones so a long session running many
    // tasks doesn't hold every stimulus in memory.
    async loadFile(filePath) {
        this._cache = this._cache || new Map();
        const key = `${filePath}@${this.sampleRate}`;
        if (this._cache.has(key)) {
            const data = this._cache.get(key);
            this._cache.delete(key);
            this._cache.set(key, data); // most recently used last
            return data;
        }
        const bytes = fs.readFileSync(filePath);
        const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        const data = await this._decodeToStreamRate(arrayBuffer);
        this._cache.set(key, data);
        while (this._cache.size > MAX_CACHED_FILES) this._cache.delete(this._cache.keys().next().value);
        return data;
    }

    // Plays a WAV/MP3 file. Kept compatible with the previous signature.
    async playFile(filePath, volume = 1.0, options = {}) {
        const channelData = await this.loadFile(filePath);
        return this.playChannelData(channelData, Object.assign({}, options, { volume }));
    }

    async playAudioBuffer(audioBuffer, volume = 1.0, options = {}) {
        const channelData = await this.resampleAudioBuffer(audioBuffer);
        return this.playChannelData(channelData, Object.assign({}, options, { volume }));
    }

    // Sine tone samples at the stream rate with linear fade in/out.
    toneData(frequency, durationMs, level = 1, rampMs = 10) {
        const n = Math.max(1, Math.round(durationMs / 1000 * this.sampleRate));
        const fade = Math.max(1, Math.min(Math.round(rampMs / 1000 * this.sampleRate), Math.floor(n / 2)));
        const data = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const env = Math.min(1, i / fade, (n - 1 - i) / fade);
            data[i] = Math.sin(2 * Math.PI * frequency * i / this.sampleRate) * env * level;
        }
        return data;
    }

    // Short sine test tone with fade in/out.
    playTone(frequency = 440, durationMs = 500, volume = 0.3, options = {}) {
        return this.playChannelData([this.toneData(frequency, durationMs)], Object.assign({}, options, { volume }));
    }

    // Cancels queued and currently playing output.
    clearOutputQueue() {
        const jobs = this.outputJobs.concat(this.activeJob ? [this.activeJob] : [], this.pendingDrains);
        this.outputJobs = [];
        this.activeJob = null;
        this.pendingDrains = [];
        jobs.forEach((job) => job.resolve(this._jobTiming(job, true)));
    }

    // ---- recording ------------------------------------------------------------------

    _captureBlock(input, blockIndex) {
        const cap = this.capture;
        const floats = new Float32Array(input.buffer, input.byteOffset, input.length / 4);
        const mono = new Float32Array(this.frameSize);
        for (let n = 0; n < this.frameSize; n++) {
            mono[n] = floats[n * this.inChannelCount + cap.channel];
        }
        if (cap.startSample == null) {
            cap.startSample = blockIndex * this.frameSize;
            cap.resolveStart(cap.startSample);
        }
        cap.chunks.push(mono);
    }

    // Starts recording the chosen input channel. Resolves with the stream
    // sample index (and wall-clock time) of the recording's first sample.
    async startCapture(options = {}) {
        if (!this.isEnabled()) throw new Error(`ASIO is not available: ${this.statusReason}`);
        const channel = options.inputChannel != null ? options.inputChannel : this.config.inputChannel;
        if (!Number.isInteger(channel) || channel < 0 || channel >= this.inChannelCount) {
            throw new Error(`Input channel ${channel + 1} does not exist on ${this.device.name}`);
        }
        let resolveStart;
        const started = new Promise((r) => { resolveStart = r; });
        const capture = { channel, chunks: [], startSample: null, resolveStart, underrunsAtStart: this.underruns };
        this.capture = capture;

        // If the driver has stopped delivering audio, fail instead of hanging
        // the task forever.
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('ASIO driver delivered no input for 2 s')), 2000);
        });
        try {
            const startSample = await Promise.race([started, timeout]);
            return {
                startSample,
                startPerfMs: startSample != null ? this.inputSampleToPerfMs(startSample) : null,
                sampleRate: this.sampleRate
            };
        } catch (error) {
            if (this.capture === capture) this.capture = null;
            throw error;
        } finally {
            clearTimeout(timer);
        }
    }

    _takeCapture() {
        const cap = this.capture;
        this.capture = null;
        if (!cap) return { samples: new Float32Array(0), startSample: null, timingReliable: true };
        const total = cap.chunks.reduce((sum, c) => sum + c.length, 0);
        const samples = new Float32Array(total);
        let offset = 0;
        for (const c of cap.chunks) { samples.set(c, offset); offset += c.length; }
        // A capture that never resolved its start (stopped before the first
        // block arrived) must not leave startCapture() hanging.
        if (cap.startSample == null) cap.resolveStart(null);
        return {
            samples,
            startSample: cap.startSample,
            timingReliable: !cap.interrupted && cap.underrunsAtStart === this.underruns
        };
    }

    stopCaptureDiscard() {
        const { samples } = this._takeCapture();
        let peak = 0;
        for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
        return peak > 0.0015;
    }

    // Stops recording and returns it as a complete 16-bit mono WAV file in
    // memory, plus where it sits on the stream clock.
    stopCaptureToWavBuffer() {
        const { samples, startSample, timingReliable } = this._takeCapture();

        const wavBuffer = Buffer.alloc(44 + samples.length * 2);
        wavBuffer.write('RIFF', 0, 'ascii');
        wavBuffer.writeUInt32LE(36 + samples.length * 2, 4);
        wavBuffer.write('WAVE', 8, 'ascii');
        wavBuffer.write('fmt ', 12, 'ascii');
        wavBuffer.writeUInt32LE(16, 16);
        wavBuffer.writeUInt16LE(1, 20);
        wavBuffer.writeUInt16LE(1, 22);
        wavBuffer.writeUInt32LE(this.sampleRate, 24);
        wavBuffer.writeUInt32LE(this.sampleRate * 2, 28);
        wavBuffer.writeUInt16LE(2, 32);
        wavBuffer.writeUInt16LE(16, 34);
        wavBuffer.write('data', 36, 'ascii');
        wavBuffer.writeUInt32LE(samples.length * 2, 40);
        for (let i = 0; i < samples.length; i++) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            wavBuffer.writeInt16LE(Math.round(s < 0 ? s * 32768 : s * 32767), 44 + i * 2);
        }

        return {
            wavBuffer,
            startSample,
            startPerfMs: startSample != null ? this.inputSampleToPerfMs(startSample) : null,
            sampleRate: this.sampleRate,
            sampleCount: samples.length,
            streamLatencyFrames: this.streamLatencyFrames,
            timingReliable
        };
    }

    // Stops recording and writes it to disk as 16-bit mono WAV.
    async stopCaptureToFile(outputPath) {
        const result = this.stopCaptureToWavBuffer();
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        await fs.promises.writeFile(outputPath, result.wavBuffer);
        delete result.wavBuffer;
        return Object.assign({ outputPath }, result);
    }

    // Where a played stimulus starts inside a recording, in samples and ms.
    // Includes the interface's round-trip latency, i.e. the position at
    // which the stimulus would be heard if the output were looped back to
    // the input. Speech onset (found in the WAV) minus this = reaction time.
    stimulusPositionInRecording(playbackTiming, recordingInfo) {
        if (!playbackTiming || playbackTiming.onsetSample == null ||
            !recordingInfo || recordingInfo.startSample == null) {
            return null;
        }
        const samples = playbackTiming.onsetSample - recordingInfo.startSample + this.streamLatencyFrames;
        return {
            samples,
            ms: samples / this.sampleRate * 1000,
            timingReliable: playbackTiming.timingReliable !== false && recordingInfo.timingReliable !== false
        };
    }

    // ---- teardown ------------------------------------------------------------------

    stop() {
        this._stopWatchdog();
        this.clearOutputQueue();
        this.capture = null;
        if (this.rt) {
            try { if (this.rt.isStreamRunning()) this.rt.stop(); } catch (e) {
                console.warn('[asio-engine] Error stopping stream:', e.message);
            }
        }
        this.started = false;
    }

    shutdown() {
        this.stop();
        if (this.rt) {
            try { if (this.rt.isStreamOpen()) this.rt.closeStream(); } catch (e) {
                console.warn('[asio-engine] Error closing stream:', e.message);
            }
        }
        this.rt = null;
        this.device = null;
        this.blocksReceived = 0;
        this.framesWritten = 0;
        this.framesConsumed = 0;
        this.underruns = 0;
        this.slip = 0;
        this._silentSamples = [];
        this._slipPending = false;
        this._lastInputAt = null;
        this._queuedAtLastInput = 0;
        this.clockSamples = [];
        this.clockOffsetMs = null;
        this._cache = null;
        if (!this.disconnected) this._emitStatus();
    }
}

// One shared stream for the whole app: ASIO drivers are opened once, not
// per task or per sound.
const sharedEngine = new AsioEngine();

module.exports = sharedEngine;
module.exports.AsioEngine = AsioEngine;
module.exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
