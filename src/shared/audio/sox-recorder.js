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

    cp.on('close', (code) => {
        if (code === 0) return;
        outStream.emit('error', new Error(`sox has exited with error code ${code}.`));
    });

    return {
        process: cp,
        stream: () => outStream,
        stop: () => cp.kill()
    };
}

module.exports = { record };
