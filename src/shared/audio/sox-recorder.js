// SOX INPUT RECORDER
//
// Thin replacement for node-record-lpcm16's built-in 'sox' recorder. That
// module always opens the input device with sox's `--default-device`
// shorthand, which lets sox auto-detect the right OS driver. On at least
// one tested Windows machine (a laptop with a Conexant "Smart Audio" combo
// driver chip), that auto-detection fails with
// "sox: Sorry, there is no default audio device configured", while
// explicitly requesting the legacy WinMM driver (`-t waveaudio -d`) opens
// the exact same physical microphone successfully. Forcing that driver on
// win32 fixes recording there without needing ASIO/ASIO4ALL, and leaves
// other platforms on the previously-working `--default-device` shorthand.
const { spawn } = require('child_process');

function buildInputArgs() {
    if (process.platform === 'win32') {
        return ['-t', 'waveaudio', '-d'];
    }
    return ['--default-device'];
}

function record(options = {}) {
    const args = [
        ...buildInputArgs(),
        '--no-show-progress',
        '--rate', options.sampleRate,
        '--channels', options.channels,
        '--encoding', 'signed-integer',
        '--bits', '16',
        '--type', options.audioType || 'wav',
        '-'
    ];

    const cp = spawn('sox', args, { encoding: 'binary', stdio: 'pipe' });
    const outStream = cp.stdout;

    // Recording always ends by us calling stop() (either on a timer or when
    // the technician cancels), which kills the sox process. A killed
    // process reports a non-zero/null exit code just like a real failure
    // would, so that needs to be distinguished from an actual sox crash.
    let stoppedDeliberately = false;

    cp.on('close', (code) => {
        if (code === 0 || stoppedDeliberately) return;
        outStream.emit('error', new Error(`sox has exited with error code ${code}.`));
    });

    return {
        process: cp,
        stream: () => outStream,
        // Killing a process doesn't synchronously release the OS audio
        // device handle it held (WinMM in particular can lag behind
        // TerminateProcess), so callers that are about to open the same
        // device again need to wait for the process to actually exit
        // first - otherwise the new recording can open the device fine
        // but capture no real audio. Resolving on 'close' rather than
        // 'exit' additionally ensures stdout has finished flushing.
        stop: () => new Promise((resolveStop) => {
            stoppedDeliberately = true;
            if (cp.exitCode !== null || cp.signalCode !== null) {
                resolveStop();
                return;
            }
            cp.once('close', () => resolveStop());
            cp.kill();
        })
    };
}

module.exports = { record };
