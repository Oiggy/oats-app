// STIMULUS LEVEL LOGGING
//
// Records the stimulus volume each participant heard, so presentation levels
// can be compared and averaged across a study. Task volume is a linear gain
// on the stimulus files (1.0 = 100% = the level the files were recorded at),
// logged here as dB relative to that.
//
// The gain alone is not SPL: what reaches the ear also depends on the
// interface/amp knobs and the earphones. If the lab measures the SPL produced
// at 100% volume with its fixed hardware settings (sound level meter +
// coupler) and enters it in Audio Setup, an estimated dB SPL is logged too:
//     estimated dB SPL = calibration (dB SPL at 100%) + gain dB
//
// Every logged task run is appended to <Oats data folder>/stimulus-levels.csv
// (one row per participant per task) in addition to that task's results file.

const fs = require('fs');
const path = require('path');
const os = require('os');
const asioEngine = require('./asio-engine');
const { isDevModeParticipant } = require('../storage/participant-storage');

const LOG_FILE_NAME = 'stimulus-levels.csv';
const HEADER = 'timestamp,participant_id,developer_mode,task,volume_percent,gain_db,' +
    'calibration_db_spl_at_100,estimated_db_spl,audio_backend\n';

function getOatsDir() {
    if (process.platform === 'win32') {
        return path.join(os.homedir(), 'AppData', 'Roaming', 'Oats');
    }
    return path.join(os.homedir(), 'Documents', 'Oats');
}

function gainToDb(gain) {
    return gain > 0 ? 20 * Math.log10(gain) : -Infinity;
}

// Read straight from the saved audio config so the running engine's
// in-memory settings aren't touched.
function getCalibration() {
    try {
        const value = JSON.parse(fs.readFileSync(asioEngine.getConfigPath(), 'utf8')).calibrationDbSplAt100;
        return typeof value === 'number' && Number.isFinite(value) ? value : null;
    } catch (error) {
        return null;
    }
}

// { volumePercent, gainDb, calibration, estimatedDbSpl } for a task volume.
function describe(volume) {
    const gainDb = gainToDb(volume);
    const calibration = getCalibration();
    return {
        volumePercent: Math.round(volume * 100),
        gainDb,
        calibration,
        estimatedDbSpl: calibration != null && Number.isFinite(gainDb) ? calibration + gainDb : null
    };
}

function formatDb(value) {
    if (value === -Infinity) return '-inf';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

// Human-readable line for a results file.
function formatLevel(volume) {
    const level = describe(volume);
    let text = `${level.volumePercent}% (${formatDb(level.gainDb)} dB re. stimulus file level)`;
    text += level.estimatedDbSpl != null
        ? `, estimated ${level.estimatedDbSpl.toFixed(1)} dB SPL (calibration ${level.calibration.toFixed(1)} dB SPL at 100%)`
        : ', dB SPL not calibrated';
    return text;
}

function csvField(value) {
    const s = value == null ? '' : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Appends one row to stimulus-levels.csv and returns the results-file text.
function logStimulusLevel({ participantId, task, volume, backend }) {
    const level = describe(volume);
    const row = [
        new Date().toISOString(),
        participantId,
        isDevModeParticipant(participantId) ? 'yes' : 'no',
        task,
        level.volumePercent,
        Number.isFinite(level.gainDb) ? level.gainDb.toFixed(2) : '-inf',
        level.calibration != null ? level.calibration.toFixed(1) : '',
        level.estimatedDbSpl != null ? level.estimatedDbSpl.toFixed(1) : '',
        backend
    ].map(csvField).join(',') + '\n';

    const dir = getOatsDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, LOG_FILE_NAME);
    if (!fs.existsSync(file)) fs.writeFileSync(file, HEADER, 'utf8');
    fs.appendFileSync(file, row, 'utf8');

    return formatLevel(volume);
}

module.exports = { gainToDb, describe, formatLevel, logStimulusLevel, LOG_FILE_NAME };
