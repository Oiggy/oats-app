// AUDIO CHECK (the "Test Audio" button on listening tasks)
//
// Validates the audio path the task's trials will use, before the task
// starts:
//   1. With ASIO, a short beep on each output channel chosen in Audio Setup,
//      one at a time, so the tester can hear that each channel comes out
//      where expected (e.g. Out 1 = left ear, Out 2 = right ear).
//   2. A sample through the task's own playback code (all chosen channels).
//   3. A plain-language verdict: ASIO or not, which device and channels,
//      audio dropouts, and whether Windows sounds share those channels.
// The result is kept by the task and written to its results file.

const ASIO_SETUP_HINT = 'Click AUDIO at the top of the dashboard to connect the interface or change the outputs, then test again.';

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function injectStyles() {
    if (document.getElementById('oats-audio-check-styles')) return;
    const style = document.createElement('style');
    style.id = 'oats-audio-check-styles';
    style.textContent = `
        .oats-audio-check { margin: 16px auto; max-width: 560px; text-align: center; }
        .oats-audio-check-result { margin-top: 12px; text-align: left; font-size: 14px; line-height: 1.45;
            border-radius: 10px; padding: 12px 14px; background: #f5f5f7; color: #1d1d1f; border: 1px solid #d2d2d7; }
        .oats-audio-check-result[hidden] { display: none; }
        .oats-audio-check-result.ok { background: #eefaf1; border-color: #34c759; }
        .oats-audio-check-result.warn { background: #fff8eb; border-color: #ff9500; }
        .oats-audio-check-result.fail { background: #fff1f0; border-color: #ff3b30; }
        .oats-audio-check-result h4 { margin: 0 0 6px; font-size: 15px; }
        .oats-audio-check-result ol, .oats-audio-check-result ul { margin: 6px 0 0 18px; padding: 0; }
        .oats-audio-check-result li { margin: 2px 0; }
        .oats-audio-check-result li.now { font-weight: 600; }
        .oats-audio-check-result li.done::marker { color: #34c759; }
        .oats-audio-check-result .hint { margin-top: 8px; color: #515154; }
    `;
    document.head.appendChild(style);
}

// Markup for tasks that don't have their own Test Audio button.
function html({ buttonId = 'audio-check-btn', resultId = 'audio-check-result', buttonClass = '', caption = '' } = {}) {
    return `
        <div class="oats-audio-check">
            <button type="button" id="${buttonId}" class="${buttonClass}">🔊 Test Audio</button>
            ${caption ? `<div class="hint" style="font-size: 13px; color: #6e6e73; margin-top: 6px;">${caption}</div>` : ''}
            <div class="oats-audio-check-result" id="${resultId}" hidden></div>
        </div>
    `;
}

async function readWindowsOutput() {
    try {
        if (window.dashboard && typeof window.dashboard.getWindowsOutput === 'function') {
            return await window.dashboard.getWindowsOutput();
        }
    } catch (error) {
        // Not available outside the dashboard
    }
    return null;
}

// A beep through Web Audio, for tasks with no sample of their own when ASIO
// isn't running.
function webAudioBeep(volume) {
    return new Promise((resolve) => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = 1000;
            osc.connect(gain);
            gain.connect(ctx.destination);
            const t = ctx.currentTime + 0.05;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(Math.min(0.9, 0.3 * volume), t + 0.01);
            gain.gain.setValueAtTime(Math.min(0.9, 0.3 * volume), t + 0.39);
            gain.gain.linearRampToValueAtTime(0, t + 0.4);
            osc.start(t);
            osc.stop(t + 0.42);
            osc.onended = () => { ctx.close(); resolve({ backend: 'WebAudio', timingReliable: true }); };
        } catch (error) {
            resolve({ backend: 'none', timingReliable: false, error });
        }
    });
}

function channelList(channels) {
    return channels.map((c) => `Out ${c}`).join(' + ');
}

// Runs the check. options:
//   engine      shared ASIO engine (may be null)
//   volume      the task's stimulus volume
//   playSample  async () => playback timing ({ backend, timingReliable, cancelled });
//               plays the task's own sample. Omit to use a beep on all channels.
//   sampleLabel what the sample is, e.g. "warning beep and a word"
//   button, resultEl  DOM elements to drive
//   revealAfter element to scroll into view when done (the Start button), so
//               the result never leaves it out of sight
async function run(options) {
    injectStyles();
    const { engine, button, resultEl } = options;
    const volume = options.volume == null ? 1 : options.volume;
    const beepLevel = Math.min(0.9, 0.3 * volume);
    const originalText = button ? button.textContent : '';
    if (button) { button.disabled = true; button.textContent = '🔊 Testing…'; }

    const asio = !!(engine && engine.isEnabled());
    const status = engine ? engine.getStatus() : null;
    const channels = asio ? status.outputChannels.map((c) => c + 1) : null;
    const sampleLabel = options.sampleLabel || 'beep on all outputs together';

    const steps = [];
    if (asio) channels.forEach((c) => steps.push(`Beep on Out ${c} only`));
    steps.push(asio ? `${sampleLabel[0].toUpperCase()}${sampleLabel.slice(1)} on ${channelList(channels)}` : `${sampleLabel[0].toUpperCase()}${sampleLabel.slice(1)}`);

    const render = (current) => {
        if (!resultEl) return;
        resultEl.hidden = false;
        resultEl.className = 'oats-audio-check-result';
        resultEl.innerHTML = `<h4>Listen now…</h4><ol>${steps.map((s, i) =>
            `<li class="${i < current ? 'done' : i === current ? 'now' : ''}">${escapeHtml(s)}${i === current ? ' ◀ playing' : ''}</li>`).join('')}</ol>`;
    };

    const result = {
        time: new Date(),
        backend: asio ? 'ASIO' : 'WebAudio',
        asioRunning: asio,
        reason: asio ? null : ((status && status.reason) || 'audio engine unavailable'),
        device: asio ? status.device : null,
        channels,
        problems: [],
        warnings: [],
        ok: false
    };

    try {
        let step = 0;
        if (asio) {
            for (const c of channels) {
                render(step++);
                const timing = await engine.playTone(1000, 400, beepLevel, { outputChannels: [c - 1] });
                if (!timing || timing.cancelled) result.problems.push(`Beep on Out ${c} was interrupted.`);
                else if (timing.timingReliable === false) result.problems.push(`Audio dropout while the beep on Out ${c} played.`);
                await wait(300);
            }
        }
        render(step);
        const sample = options.playSample
            ? await options.playSample()
            : asio
                ? await engine.playTone(1000, 400, beepLevel)
                : await webAudioBeep(volume);
        const sampleBackend = sample && sample.backend ? sample.backend : 'none';
        if (asio) {
            if (sampleBackend !== 'ASIO') result.problems.push(`The sample played through ${sampleBackend === 'none' ? 'no audio output' : 'Windows (Web Audio)'} instead of ASIO; the task would do the same.`);
            else if (sample.cancelled) result.problems.push('The sample was interrupted.');
            else if (sample.timingReliable === false) result.problems.push('Audio dropout while the sample played (timing would be flagged unreliable).');
        } else if (sampleBackend === 'none') {
            result.problems.push('No audio output is working.');
        }
        result.backend = asio && sampleBackend === 'ASIO' ? 'ASIO' : sampleBackend;
    } catch (error) {
        result.problems.push(`Playback failed: ${error.message}`);
    }

    // Windows sounds on the same Focusrite outputs would mix into the stimuli.
    if (asio) {
        const windows = await readWindowsOutput();
        if (windows && windows.focusrite && Array.isArray(windows.channels)) {
            const shared = windows.channels.filter((c) => channels.includes(c));
            if (shared.length) {
                result.warnings.push(`Windows sounds also play on ${channelList(shared)} (${windows.name}), so notifications would mix into the stimuli. Move Windows to other outputs (see the hint in Audio Setup).`);
            }
        }
    }

    result.ok = asio && result.problems.length === 0;
    if (resultEl) showResult(resultEl, result, status);
    if (button) { button.disabled = false; button.textContent = originalText; }
    const reveal = options.revealAfter || resultEl;
    if (reveal && reveal.scrollIntoView) reveal.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return result;
}

function showResult(resultEl, result, status) {
    let cls; let title; let body;
    if (result.ok) {
        cls = result.warnings.length ? 'warn' : 'ok';
        title = `✅ ASIO is working: ${escapeHtml(result.device)}, ${channelList(result.channels)}`;
        body = `<div>You should have heard ${result.channels.map((c) => `a beep on <strong>Out ${c}</strong>`).join(', then ')}, then the sample on all of them.</div>
            <div class="hint">If a beep came from the wrong side or not at all, check the cables and Focusrite Control routing, or change the outputs with the AUDIO button.</div>`;
    } else if (!result.asioRunning) {
        cls = 'fail';
        title = '⚠️ Not using ASIO';
        body = `<div>Sound is going to the Windows default output instead, so the outputs chosen in Audio Setup don't apply and timing is less precise.</div>
            <div class="hint">Reason: ${escapeHtml(result.reason)}. ${ASIO_SETUP_HINT}</div>`;
    } else {
        cls = 'fail';
        title = '❌ ASIO check failed';
        body = `<div class="hint">${ASIO_SETUP_HINT}</div>`;
    }
    const issues = result.problems.concat(result.warnings);
    resultEl.hidden = false;
    resultEl.className = `oats-audio-check-result ${cls}`;
    resultEl.innerHTML = `<h4>${title}</h4>${body}${issues.length ? `<ul>${issues.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>` : ''}`;
}

// One line for results files.
function summarize(result) {
    if (!result) return 'not run';
    const time = result.time.toLocaleTimeString();
    if (result.ok) {
        return `passed at ${time}: ASIO, ${result.device}, ${channelList(result.channels)}` +
            (result.warnings.length ? ` (warning: ${result.warnings.join(' ')})` : '');
    }
    const issues = result.problems.concat(result.warnings);
    if (!result.asioRunning) return `not ASIO at ${time} (${result.reason}); sound went to the Windows default output`;
    return `FAILED at ${time}: ${issues.join(' ')}`;
}

module.exports = { html, run, summarize };
