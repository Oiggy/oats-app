const fs = require('fs');
const path = require('path');

const assets = [
  // WAV files for speeded classification
  'src/renderer/tasks/speeded_classification/stim_files/paab2F1.wav',
  'src/renderer/tasks/speeded_classification/stim_files/baab1M1.wav',
  'src/renderer/tasks/speeded_classification/stim_files/paab1M2.wav',
  'src/renderer/tasks/speeded_classification/stim_files/baab2F2.wav',
  'src/renderer/tasks/speeded_classification/audio/pa_1.wav',
  'src/renderer/tasks/speeded_classification/audio/pa_2.wav',
  'src/renderer/tasks/speeded_classification/audio/female_2.wav',
  'src/renderer/tasks/speeded_classification/audio/male_2.wav',
  'src/renderer/tasks/speeded_classification/audio/ba_1.wav',
  'src/renderer/tasks/speeded_classification/audio/ba_practice.wav',
  'src/renderer/tasks/speeded_classification/audio/female_practice.wav',
  'src/renderer/tasks/speeded_classification/audio/female_1.wav',
  'src/renderer/tasks/speeded_classification/audio/ba_2.wav',
  'src/renderer/tasks/speeded_classification/audio/male_practice.wav',
  'src/renderer/tasks/speeded_classification/audio/male_1.wav',
  'src/renderer/tasks/speeded_classification/audio/pa_practice.wav',
  // WAV files for auditory stroop
  'src/renderer/tasks/auditory_stroop/audio/nooz2M2.wav',
  'src/renderer/tasks/auditory_stroop/audio/daad2F1.wav',
  'src/renderer/tasks/auditory_stroop/audio/maam1F2.wav',
  'src/renderer/tasks/auditory_stroop/audio/daad1M2.wav',
  'src/renderer/tasks/auditory_stroop/audio/maam1M1.wav',
  'src/renderer/tasks/auditory_stroop/audio/nooz1F1.wav',
  // Text and CSV resources
  'src/renderer/tasks/cvc/vmtcvc.txt',
  'src/renderer/tasks/stroop_color_word/stimulus_data.txt',
  'src/renderer/tasks/reading_span/Sentence Dictionary.csv',
  'src/renderer/tasks/reading_span/Sentence Dictionary copy.csv'
];

const repoRoot = path.join(__dirname, '..');
const missing = [];

for (const relativePath of assets) {
  const absolutePath = path.join(repoRoot, relativePath);
  try {
    fs.accessSync(absolutePath, fs.constants.R_OK);
  } catch {
    missing.push(relativePath);
  }
}

if (missing.length) {
  console.error('Missing assets detected:');
  for (const file of missing) {
    console.error(` - ${file}`);
  }
  process.exitCode = 1;
} else {
  console.log('All referenced audio/text/CSV assets are present and readable.');
}