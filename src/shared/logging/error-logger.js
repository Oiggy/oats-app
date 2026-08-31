// APP ERROR LOGGER
//
// Writes runtime errors to a plain text log file so a technician can find
// out what went wrong on a machine where nobody had DevTools open at the
// time. Used from both the main process (uncaught exceptions, renderer
// crashes) and the renderer (uncaught errors, unhandled promise
// rejections, and everything already reported via console.error across
// the task files). Mirrors the existing dev-mode-logs directory
// convention already used elsewhere in this app.
//
// Logging is best-effort: any failure here is swallowed rather than
// thrown, so a broken log write never takes down the app it's trying to
// help debug.

const fs = require('fs');
const path = require('path');
const os = require('os');

function getLogDir() {
    if (process.platform === 'win32') {
        return path.join(os.homedir(), 'AppData', 'Roaming', 'Oats', 'logs');
    }
    return path.join(os.homedir(), 'Documents', 'Oats', 'logs');
}

function getLogFilePath(date = new Date()) {
    const dateStr = date.toISOString().split('T')[0];
    return path.join(getLogDir(), `app-error-${dateStr}.log`);
}

function formatEntry(context, error) {
    const timestamp = new Date().toISOString();
    const message = error && error.message ? error.message : String(error);
    const stack = error && error.stack ? `\n${error.stack}` : '';
    return `[${timestamp}] ${context}: ${message}${stack}\n`;
}

// Fire-and-forget: appends one entry to today's log file, creating the
// logs directory on first use.
function logError(context, error) {
    try {
        const logDir = getLogDir();
        fs.mkdir(logDir, { recursive: true }, (mkdirError) => {
            if (mkdirError) return;
            fs.appendFile(getLogFilePath(), formatEntry(context, error), () => {
                // Ignore write failures; there is nowhere safer left to report them.
            });
        });
    } catch (loggingError) {
        // Never let a logging failure take down the app.
    }
}

module.exports = { logError, getLogDir, getLogFilePath };
