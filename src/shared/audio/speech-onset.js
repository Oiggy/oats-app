// SPEECH ONSET IN A STIMULUS FILE
//
// Stimulus recordings start with some silence before the word (at least
// 50 ms in the current files, more for some words), so the start of the
// file is not the start of the word. Reaction times in the listening tasks
// are measured from the speech onset found here instead.
//
// Speech onset = the first sample within 60 dB of the file's peak. The
// leading silence in the files is digital zero, and a -60 dB threshold
// still catches soft first sounds (the "f" of "father", the "p" of
// "puff") that a louder threshold would miss, while skipping the very faint
// lead-in noise some files have.

const THRESHOLD_DB = -60;

// audioBuffer: a decoded Web Audio AudioBuffer. Returns milliseconds from
// the start of the file (0 if the file is silent).
function detectSpeechOnsetMs(audioBuffer) {
    if (!audioBuffer) return 0;
    const channels = [];
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) channels.push(audioBuffer.getChannelData(c));

    let peak = 0;
    for (const data of channels) {
        for (let i = 0; i < data.length; i++) {
            const a = Math.abs(data[i]);
            if (a > peak) peak = a;
        }
    }
    if (peak === 0) return 0;

    const threshold = peak * Math.pow(10, THRESHOLD_DB / 20);
    for (let i = 0; i < audioBuffer.length; i++) {
        for (const data of channels) {
            if (Math.abs(data[i]) > threshold) return (i / audioBuffer.sampleRate) * 1000;
        }
    }
    return 0;
}

module.exports = { detectSpeechOnsetMs, THRESHOLD_DB };
