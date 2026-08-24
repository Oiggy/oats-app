// ASIO AUDIO ENGINE
//
// Optional low-latency audio backend for equipment whose audio interfaces
// ship ASIO drivers (Steinberg's low-latency I/O API for Windows). Built on
// top of node-audio-asio: https://github.com/distopik/node-audio-asio
//
// node-audio-asio is alpha-quality, proof-of-concept software, and because
// the Steinberg ASIO SDK cannot be redistributed, the native addon only
// works on a machine where a developer has downloaded the SDK, extracted it
// over the node-audio-asio package, and rebuilt it (see that project's
// README and docs/asio-support.md in this repo). When that hasn't been done,
// or the app isn't running on Windows, or ASIO is simply disabled in
// configuration, every method here reports "unsupported" so callers fall
// back to their existing playback/recording path with no change in
// behavior.
//
// This module owns a single, persistent ASIO stream (ASIO drivers are
// initialized once and then pump audio through a real-time callback for as
// long as the stream is running, rather than being opened per-sound). Output
// audio is fed to that callback from an in-memory queue of "jobs"; input
// audio is captured into an in-memory buffer while a recording is active.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { Reader: WavReader, Writer: WavWriter } = require('wav');

const CONFIG_FILE_NAME = 'cfg_audio_asio.json';

const DEFAULT_CONFIG = {
    enabled: false,
    driver: 'ASIO4ALL v2',
    sampleRate: 44100,
    bitsPerSample: 24,
    samplesPerBlock: 256,
    endianess: 'little',
    inputChannels: [0],
    outputChannels: [0, 1]
};

function getConfigDir() {
    if (process.platform === 'win32') {
        return path.join(os.homedir(), 'AppData', 'Roaming', 'Oats', 'task-configurations');
    }
    return path.join(os.homedir(), 'Documents', 'Oats', 'task-configurations');
}

function loadConfig() {
    try {
        const configPath = path.join(getConfigDir(), CONFIG_FILE_NAME);
        const raw = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        return Object.assign({}, DEFAULT_CONFIG, parsed);
    } catch (error) {
        return Object.assign({}, DEFAULT_CONFIG);
    }
}

function bytesPerSample(bitsPerSample) {
    return bitsPerSample / 8;
}

function writeSampleLE(buffer, offset, value, bitsPerSample) {
    switch (bitsPerSample) {
        case 16:
            buffer.writeInt16LE(value, offset);
            return;
        case 24: {
            const clamped = Math.max(-8388608, Math.min(8388607, value));
            const unsigned = clamped < 0 ? clamped + 0x1000000 : clamped;
            buffer[offset] = unsigned & 0xff;
            buffer[offset + 1] = (unsigned >> 8) & 0xff;
            buffer[offset + 2] = (unsigned >> 16) & 0xff;
            return;
        }
        case 32:
            buffer.writeInt32LE(value, offset);
            return;
        default:
            throw new Error(`Unsupported ASIO bit depth: ${bitsPerSample}`);
    }
}

function readSampleLE(buffer, offset, bitsPerSample) {
    switch (bitsPerSample) {
        case 16:
            return buffer.readInt16LE(offset);
        case 24: {
            let value = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
            if (value & 0x800000) value -= 0x1000000;
            return value;
        }
        case 32:
            return buffer.readInt32LE(offset);
        default:
            throw new Error(`Unsupported ASIO bit depth: ${bitsPerSample}`);
    }
}

// Scales a 16-bit signed sample (the depth every WAV asset in this project
// uses) up to the ASIO stream's configured bit depth.
function scaleInt16To(value, bitsPerSample) {
    if (bitsPerSample === 16) return value;
    if (bitsPerSample === 24) return value * 256;
    if (bitsPerSample === 32) return value * 65536;
    throw new Error(`Unsupported ASIO bit depth: ${bitsPerSample}`);
}

// Inverse of scaleInt16To, used when downmixing captured microphone audio
// back to 16-bit for saving as a standard WAV file.
function scaleToInt16(value, bitsPerSample) {
    if (bitsPerSample === 16) return value;
    if (bitsPerSample === 24) return Math.round(value / 256);
    if (bitsPerSample === 32) return Math.round(value / 65536);
    throw new Error(`Unsupported ASIO bit depth: ${bitsPerSample}`);
}

class AsioEngine {
    constructor() {
        this.config = loadConfig();
        this.nodeAsio = null;
        this.loadError = null;
        this.started = false;

        // Queue of { samples: Int16Array-like, position, onDrain } output jobs,
        // drained in order by the real-time audio callback.
        this.outputJobs = [];

        this.captureActive = false;
        this.captureSamples = [];
    }

    isPlatformSupported() {
        return process.platform === 'win32';
    }

    reloadConfig() {
        this.config = loadConfig();
        return this.config;
    }

    isEnabled() {
        return this.isPlatformSupported() && this.config.enabled === true;
    }

    getLoadError() {
        return this.loadError;
    }

    _loadNativeModule() {
        if (this.nodeAsio || this.loadError) return;
        try {
            // eslint-disable-next-line global-require
            this.nodeAsio = require('node-audio-asio');
        } catch (error) {
            this.loadError = error;
            console.warn('[asio-engine] node-audio-asio is not available, ASIO support disabled:', error.message);
        }
    }

    // Starts the persistent ASIO stream on first use. Safe to call
    // repeatedly; subsequent calls resolve immediately once started.
    async ensureStarted() {
        if (this.started) return true;
        if (!this.isEnabled()) return false;

        this._loadNativeModule();
        if (!this.nodeAsio) return false;

        const { driver, sampleRate, bitsPerSample, samplesPerBlock, endianess, inputChannels, outputChannels } = this.config;
        const channelBufferLen = samplesPerBlock * bytesPerSample(bitsPerSample);
        const initialBuffers = outputChannels.map(() => Buffer.alloc(channelBufferLen));

        let asioErr;
        try {
            asioErr = this.nodeAsio.initAsio({
                driver,
                sampleRate,
                bitsPerSample,
                samplesPerBlock,
                endianess,
                inputChannels,
                outputChannels
            });
        } catch (error) {
            this.loadError = error;
            console.error('[asio-engine] initAsio threw an error:', error.message);
            return false;
        }

        if (asioErr) {
            this.loadError = new Error(typeof asioErr === 'string' ? asioErr : 'initAsio failed');
            console.error('[asio-engine] Failed to initialize ASIO driver:', this.loadError.message);
            return false;
        }

        this.nodeAsio.start(initialBuffers, (inputBufs) => this._onAudioBlock(inputBufs));
        this.started = true;
        return true;
    }

    // Real-time callback invoked by the native addon once per audio block.
    // Must stay synchronous and allocation-light: this runs on ASIO's audio
    // thread, not the Node event loop.
    _onAudioBlock(inputBufs) {
        const { bitsPerSample, samplesPerBlock, outputChannels } = this.config;
        const bytes = bytesPerSample(bitsPerSample);

        if (this.captureActive && inputBufs && inputBufs[0]) {
            const inBuf = inputBufs[0];
            const sampleCount = Math.floor(inBuf.length / bytes);
            for (let i = 0; i < sampleCount; i++) {
                const sample = readSampleLE(inBuf, i * bytes, bitsPerSample);
                this.captureSamples.push(scaleToInt16(sample, bitsPerSample));
            }
        }

        const outBuf = Buffer.alloc(samplesPerBlock * bytes);
        for (let i = 0; i < samplesPerBlock; i++) {
            let sample16 = 0;

            while (this.outputJobs.length > 0 && this.outputJobs[0].position >= this.outputJobs[0].samples.length) {
                const finished = this.outputJobs.shift();
                finished.onDrain();
            }

            if (this.outputJobs.length > 0) {
                const job = this.outputJobs[0];
                sample16 = job.samples[job.position];
                job.position += 1;
            }

            writeSampleLE(outBuf, i * bytes, scaleInt16To(sample16, bitsPerSample), bitsPerSample);
        }

        // outputChannels.length identical mono buffers: every configured
        // output channel gets the same signal (stimuli in this app are mono).
        return outputChannels.map(() => outBuf);
    }

    async _readWavAsInt16Mono(filePath) {
        return new Promise((resolve, reject) => {
            const channelSums = [];
            let sampleRate = 44100;
            let channels = 1;
            let bitDepth = 16;

            const reader = new WavReader();

            reader.on('format', (format) => {
                sampleRate = format.sampleRate;
                channels = format.channels;
                bitDepth = format.bitDepth;
            });

            reader.on('data', (chunk) => {
                if (bitDepth !== 16) return; // every asset in this project is 16-bit PCM
                const bytesPerFrame = 2 * channels;
                for (let offset = 0; offset + bytesPerFrame <= chunk.length; offset += bytesPerFrame) {
                    let sum = 0;
                    for (let ch = 0; ch < channels; ch++) {
                        sum += chunk.readInt16LE(offset + ch * 2);
                    }
                    channelSums.push(Math.round(sum / channels));
                }
            });

            reader.on('end', () => {
                if (bitDepth !== 16) {
                    reject(new Error(`Unsupported WAV bit depth for ASIO playback: ${bitDepth}-bit (${filePath})`));
                    return;
                }
                resolve({ samples: channelSums, sampleRate });
            });

            reader.on('error', reject);

            fs.createReadStream(filePath).pipe(reader);
        });
    }

    // Plays a WAV file through the ASIO output stream. Resolves once the
    // file has finished playing (mirrors the AudioBufferSourceNode.onended
    // contract callers already rely on for the Web Audio path).
    async playFile(filePath, volume = 1.0) {
        const ok = await this.ensureStarted();
        if (!ok) {
            throw new Error('ASIO output is not enabled or available on this system');
        }

        const { samples, sampleRate } = await this._readWavAsInt16Mono(filePath);
        if (sampleRate !== this.config.sampleRate) {
            console.warn(
                `[asio-engine] "${filePath}" is ${sampleRate}Hz but the ASIO stream is running at ${this.config.sampleRate}Hz. ` +
                'Configure cfg_audio_asio.json sampleRate to match the stimulus audio to avoid pitch/speed distortion.'
            );
        }

        const scaled = volume === 1.0
            ? samples
            : samples.map((sample) => Math.max(-32768, Math.min(32767, Math.round(sample * volume))));

        return new Promise((resolve) => {
            this.outputJobs.push({ samples: scaled, position: 0, onDrain: resolve });
        });
    }

    // Begins capturing ASIO input into memory. Call stopCaptureToFile() to
    // write it out as a standard 16-bit mono WAV file.
    async startCapture() {
        const ok = await this.ensureStarted();
        if (!ok) {
            throw new Error('ASIO input is not enabled or available on this system');
        }
        this.captureSamples = [];
        this.captureActive = true;
        return true;
    }

    // Stops capture without writing a file, for a quick "is audio coming in"
    // check (see NativeAudioRecorder.testAudio()).
    stopCaptureDiscard() {
        this.captureActive = false;
        const samples = this.captureSamples;
        this.captureSamples = [];
        return samples.some((sample) => Math.abs(sample) > 50);
    }

    async stopCaptureToFile(outputPath) {
        this.captureActive = false;
        const samples = this.captureSamples;
        this.captureSamples = [];

        fs.mkdirSync(path.dirname(outputPath), { recursive: true });

        const writer = new WavWriter({
            sampleRate: this.config.sampleRate,
            channels: 1,
            bitDepth: 16
        });

        const pcmBuffer = Buffer.alloc(samples.length * 2);
        for (let i = 0; i < samples.length; i++) {
            pcmBuffer.writeInt16LE(samples[i], i * 2);
        }

        return new Promise((resolve, reject) => {
            const fileStream = fs.createWriteStream(outputPath);
            writer.pipe(fileStream);
            fileStream.on('finish', () => resolve(outputPath));
            fileStream.on('error', reject);
            writer.on('error', reject);
            writer.end(pcmBuffer);
        });
    }

    // Cancels whatever is currently queued for output (used when a task lets
    // the participant/technician stop playback early) without tearing down
    // the ASIO stream itself, since it stays open for the rest of the task.
    clearOutputQueue() {
        const jobs = this.outputJobs;
        this.outputJobs = [];
        jobs.forEach((job) => job.onDrain());
    }

    stop() {
        if (this.nodeAsio && this.started) {
            try {
                this.nodeAsio.stop();
            } catch (error) {
                console.warn('[asio-engine] Error stopping ASIO stream:', error.message);
            }
        }
        this.started = false;
        this.captureActive = false;
        this.outputJobs.forEach((job) => job.onDrain());
        this.outputJobs = [];
    }

    shutdown() {
        this.stop();
        if (this.nodeAsio) {
            try {
                this.nodeAsio.deInit();
            } catch (error) {
                console.warn('[asio-engine] Error deinitializing ASIO driver:', error.message);
            }
        }
    }
}

// Single shared engine/stream for the whole app: ASIO drivers are meant to
// be opened once, not per task or per sound.
const sharedEngine = new AsioEngine();

module.exports = sharedEngine;
module.exports.AsioEngine = AsioEngine;
module.exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
