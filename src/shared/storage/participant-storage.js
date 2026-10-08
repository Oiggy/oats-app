// PARTICIPANT STORAGE ROUTING
//
// Developer Mode auto-fills the pre-task survey with a generated
// "DEV_<timestamp>" participant ID (see dashboard.js autoFillBiodata()) so
// technicians can test tasks without a real participant. That data is
// throwaway, so it's kept out of the same folder as real participant runs
// (a real participant ID is whatever the technician types into the pre-task
// survey, and will never start with "DEV_").
function isDevModeParticipant(participantId) {
    return typeof participantId === 'string' && participantId.startsWith('DEV_');
}

function getParticipantFolderName(participantId) {
    return isDevModeParticipant(participantId) ? 'sessions' : 'participants';
}

// ---- Folder layout (same for every task) --------------------------------
//
//   <Oats>/<participants|sessions>/<participant ID>/<task folder>_<run start>/
//
// <Oats> is %APPDATA%\Oats on Windows, ~/Documents/Oats elsewhere. The run
// start is the ISO time with ':' and '.' replaced, e.g.
//   auditorystrooptask_2026-10-08_13-55-21-514Z
const path = require('path');
const os = require('os');
const fs = require('fs');

const TASK_FOLDERS = {
    'stroop-color-word': 'stroopcolorwordtask',
    'cvc': 'cvctask',
    'reading-span': 'readingspantask',
    'speeded-classification': 'speededclassificationtask',
    'auditory-stroop': 'auditorystrooptask',
    'cast-word': 'speechinnoisewordstask',
    'cast-nonword': 'speechinnoisenonwordstask',
    'hint': 'speechinnoisehinttask',
    'cst': 'speechinnoisecsttask'
};

function getOatsBaseDir() {
    return process.platform === 'win32'
        ? path.join(os.homedir(), 'AppData', 'Roaming', 'Oats')
        : path.join(os.homedir(), 'Documents', 'Oats');
}

function getParticipantDir(participantId) {
    return path.join(getOatsBaseDir(), getParticipantFolderName(participantId), participantId);
}

function formatRunTimestamp(date = new Date()) {
    return date.toISOString().replace(/:/g, '-').replace('.', '-').replace('T', '_');
}

// The folder for one run of a task (created if needed). taskKey is the
// task's id from the dashboard list, e.g. 'auditory-stroop'.
function getTaskRunDir(participantId, taskKey, runStart = new Date()) {
    const name = TASK_FOLDERS[taskKey];
    if (!name) throw new Error(`Unknown task: ${taskKey}`);
    const dir = path.join(getParticipantDir(participantId), `${name}_${formatRunTimestamp(runStart)}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

module.exports = {
    isDevModeParticipant,
    getParticipantFolderName,
    getOatsBaseDir,
    getParticipantDir,
    formatRunTimestamp,
    getTaskRunDir,
    TASK_FOLDERS
};
