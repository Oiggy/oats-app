// PSYCHOMETRIC FITTING: which program runs the fit
//
// The Speech-in-Noise tasks fit psychometric functions with the Python
// scripts in this folder (psignifit). The Windows installer ships them as one
// self-contained program, resources/psychometric/oats-psychometric.exe (built
// by .github/workflows/windows-installer.yml), so an installed copy of OATS
// needs no Python. Running from source, the scripts run in the 'psignifit'
// conda environment (scripts/Speech_in_noise_setup_windows.bat; packages in
// requirements.txt).

const fs = require('fs');
const path = require('path');

function bundledProgram() {
    if (!process.resourcesPath) return null;
    const name = process.platform === 'win32' ? 'oats-psychometric.exe' : 'oats-psychometric';
    const program = path.join(process.resourcesPath, 'psychometric', name);
    return fs.existsSync(program) ? program : null;
}

// scriptPath: one of the *_psychometric.py scripts; scriptArgs: its arguments.
// Returns { command, args } for child_process.spawn.
function psychometricCommand(scriptPath, scriptArgs) {
    const program = bundledProgram();
    if (program) {
        // sin_psychometric.py -> "sin" (see oats_psychometric.py)
        const kind = path.basename(scriptPath).replace(/_psychometric\.py$/, '');
        return { command: program, args: [kind, ...scriptArgs] };
    }
    return {
        command: 'conda',
        args: ['run', '--no-capture-output', '-n', 'psignifit', 'python', scriptPath, ...scriptArgs]
    };
}

module.exports = { psychometricCommand };
