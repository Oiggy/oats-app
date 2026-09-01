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

module.exports = { isDevModeParticipant, getParticipantFolderName };
