// Speeded Classification Task Popup Integration with Onscreen Buttons and Audio
//
// Garner (1974) speeded classification paradigm, implemented as in
// Sommers & Danielson (1999), Psychology and Aging 14(3), Experiment 2:
//
//   Stimuli   8 words (bad, buff, beach, bill / pad, puff, peach, pill)
//             x 8 talkers (4 male m1-m4, 4 female f1-f4) = 64 stimuli,
//             listed in stimulus_list.csv; audio in ./audio/<stimulus_id>.wav
//   Dimensions  phoneme-relevant (respond /b/ vs /p/)
//               voice-relevant   (respond male vs female)
//   Conditions  control     - irrelevant dimension held constant
//                 phoneme: one b/p pair (e.g. buff-puff) by the 4 talkers of
//                          one sex = 8 stimuli, each presented 8 times
//                 voice:   one word by all 8 talkers = 8 stimuli, each x8
//                 (pseudo-random, never the same stimulus twice in a row)
//               orthogonal  - all 64 stimuli once each, pseudo-random
//   Each participant runs all 4 conditions; dimension order and
//   control/orthogonal order are counterbalanced (see Task Configuration).
//   12 practice trials (with feedback) before each condition; no feedback
//   on test trials.
//   Trial: 500-Hz warning tone -> 500 ms -> stimulus. RT is measured from
//   stimulus onset. 3-s response deadline, 2-s silent interval before the
//   next warning tone.
//   Scoring: interference = mean correct RT (orthogonal) - mean correct RT
//   (control), per dimension, after removing RTs > 2 SD from each
//   condition's mean.
class SpeededClassificationPopup {
    constructor() {
        this.isOpen = false;
        this.participantId = null;
        this.config = null;
        this.currentPhase = null;
        this.currentPhaseIndex = 0;
        this.currentTrialInPhase = 0;
        this.phases = [];
        this.results = [];
        this.audioContext = null;
        this.stimulusList = [];
        this.audioBuffers = {};
        this.audioFilePaths = {};
        this.missingAudio = [];
        this.asioEngine = null;
        this.counterbalancing = null;
        this.cancelResponse = null;
    }

    static get CONFIG_VERSION() {
        return 2;
    }

    // b/p minimal pairs used for the phoneme-relevant control condition
    static get PHONEME_PAIRS() {
        return {
            'bad-pad': ['bad', 'pad'],
            'buff-puff': ['buff', 'puff'],
            'beach-peach': ['beach', 'peach'],
            'bill-pill': ['bill', 'pill']
        };
    }

    static get WORDS() {
        return ['bad', 'pad', 'buff', 'puff', 'beach', 'peach', 'bill', 'pill'];
    }

    async loadTask(participantId) {
        if (this.isOpen) return;

        this.participantId = participantId;
        this.loadAsioEngine();
        await this.loadConfiguration();
        await this.initializeAudioContext();
        await this.loadStimuli();
        this.setupExperimentalPhases();
        this.openTaskPopup();
    }

    async loadConfiguration() {
        const defaults = this.getDefaultConfig();
        try {
            const os = window.require('os');
            const path = window.require('path');
            const fs = window.require('fs').promises;
            
            let baseDir;
            if (process.platform === 'win32') {
                baseDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Oats', 'task-configurations');
            } else if (process.platform === 'darwin') {
                baseDir = path.join(os.homedir(), 'Documents', 'Oats', 'task-configurations');
            } else {
                baseDir = path.join(os.homedir(), 'Documents', 'Oats', 'task-configurations');
            }
            
            const configPath = path.join(baseDir, 'cfg_speeded_classification_task.json');
            const configData = await fs.readFile(configPath, 'utf8');
            const saved = JSON.parse(configData);

            // The dashboard's configuration form for this task stores the old
            // placeholder fields (1-2 trials, 10 s timeout, ...), which don't
            // describe the paper's design. From such a file only the playback
            // volume is used; trials and timing follow the paper.
            if (saved.version !== SpeededClassificationPopup.CONFIG_VERSION) {
                this.config = defaults;
                const volume = saved.parameters && saved.parameters.audio && parseFloat(saved.parameters.audio.volume);
                if (!isNaN(volume) && volume > 0) this.config.parameters.audio.volume = volume;
                return;
            }
            this.config = this.mergeConfig(defaults, saved);
        } catch (error) {
            console.log('No configuration found, using defaults');
            this.config = defaults;
        }
    }

    mergeConfig(defaults, saved) {
        const merged = JSON.parse(JSON.stringify(defaults));
        const params = saved.parameters || {};
        for (const section of Object.keys(merged.parameters)) {
            if (params[section] && typeof params[section] === 'object') {
                Object.assign(merged.parameters[section], params[section]);
            }
        }
        merged.timestamp = saved.timestamp || null;
        return merged;
    }

    getDefaultConfig() {
        return {
            task: 'speeded-classification',
            version: SpeededClassificationPopup.CONFIG_VERSION,
            parameters: {
                trials: {
                    practice_per_condition: 12,  // 12 practice trials before each condition
                    control_repetitions: 8,      // 8 stimuli x 8 = 64 control trials
                    orthogonal_repetitions: 1    // 64 stimuli x 1 = 64 orthogonal trials
                },
                counterbalancing: {
                    dimension_order: 'random',           // 'phoneme_first' | 'voice_first' | 'random'
                    condition_order: 'random',           // 'control_first' | 'orthogonal_first' | 'random'
                    phoneme_control_pair: 'random',      // 'bad-pad' | 'buff-puff' | 'beach-peach' | 'bill-pill' | 'random'
                    phoneme_control_talker_sex: 'random',// 'male' | 'female' | 'random'
                    voice_control_word: 'random'         // any of the 8 words | 'random'
                },
                timing: {
                    warning_tone_frequency: 500,      // Hz
                    warning_tone_duration: 100,       // ms
                    warning_to_stimulus_delay: 500,   // ms, tone offset -> stimulus onset
                    iti: 2000,                        // ms silent interval after the response
                    response_timeout: 3000,           // ms from stimulus onset
                    error_display_duration: 1500      // ms, practice feedback only
                },
                audio: {
                    volume: 0.7
                },
                data: {
                    crash_recovery: true
                }
            }
        };
    }

    // Loads the shared ASIO audio engine. Only actually used for playback
    // when a technician has enabled ASIO in cfg_audio_asio.json on a Windows
    // machine with a working driver; otherwise stimuli keep playing through
    // the regular Web Audio path below.
    loadAsioEngine() {
        try {
            const path = window.require('path');
            const { app } = window.require('@electron/remote') || window.require('electron').remote;
            const appPath = app.getAppPath();
            this.asioEngine = window.require(path.join(appPath, 'src', 'shared', 'audio', 'asio-engine.js'));
        } catch (error) {
            console.warn('ASIO audio engine unavailable:', error.message);
            this.asioEngine = null;
        }
    }

    // Shared Test Audio check (beep on each Audio Setup output, then a
    // sample, and a verdict on whether ASIO is really in use).
    getAudioCheck() {
        const path = window.require('path');
        const { app } = window.require('@electron/remote') || window.require('electron').remote;
        return window.require(path.join(app.getAppPath(), 'src', 'shared', 'audio', 'audio-check.js'));
    }

    isDevMode() {
        return typeof this.participantId === 'string' && this.participantId.startsWith('DEV_');
    }

    // Developer Mode only: ends the task now and goes to the results, so a
    // technician can check the output without running every trial. The
    // results say the run was cut short.
    async finishEarly() {
        if (this.taskState !== 'running' || this.finishedEarly) return;
        const finish = await oatsDialog.confirm('Go to the results now? Developer Mode test: the results will be marked as an incomplete run.', { title: 'Finish the task now?', okText: 'Finish now' });
        if (!finish || this.taskState !== 'running' || this.finishedEarly) return;
        this.finishedEarly = true;
        this.isPaused = false;
        if (this.cancelResponse) this.cancelResponse();
        if (this.cancelInstructions) this.cancelInstructions();
        try { if (this.currentSource) this.currentSource.stop(); } catch (e) { /* already stopped */ }
        try { if (this.asioEngine && this.asioEngine.isEnabled()) this.asioEngine.clearOutputQueue(); } catch (e) { /* engine gone */ }
        const finishBtn = document.getElementById('finish-early-btn');
        if (finishBtn) finishBtn.disabled = true;
        // Between phases no trial loop is running to notice the flag.
        if (!this.trialLoopRunning) this.completeTask();
    }

    // Which audio path played the trials, e.g.
    // "ASIO on 72 of 72 trials; timing reliable on 72 of 72".
    describeTrialAudio() {
        const n = this.results.length;
        if (!n) return 'no trials run';
        const counts = {};
        this.results.forEach((t) => {
            const backend = t.audio_backend || 'none';
            counts[backend] = (counts[backend] || 0) + 1;
        });
        const used = Object.keys(counts).map((b) => `${b} on ${counts[b]} of ${n} trials`).join(', ');
        const reliable = this.results.filter((t) => t.timing_reliable === true).length;
        return `${used}; timing reliable on ${reliable} of ${n}`;
    }


    // Short label for the results file naming the channels this task used.
    describeAudioBackend() {
        if (!(this.asioEngine && this.asioEngine.isEnabled())) return 'Web Audio (ASIO unavailable)';
        return this.asioEngine.describeBackend();
    }

    // Logs the stimulus volume this participant heard (dB re. the stimulus
    // files, plus estimated dB SPL if calibrated in Audio Setup) to the shared
    // stimulus-levels.csv, and returns the line for the results file.
    logStimulusLevel(taskName) {
        try {
            const path = window.require('path');
            const { app } = window.require('@electron/remote') || window.require('electron').remote;
            const levels = window.require(path.join(app.getAppPath(), 'src', 'shared', 'audio', 'stimulus-level.js'));
            return levels.logStimulusLevel({
                participantId: this.participantId,
                task: taskName,
                volume: this.config.parameters.audio.volume,
                backend: this.asioEngine && this.asioEngine.isEnabled() ? 'ASIO' : 'fallback'
            });
        } catch (error) {
            console.error('Could not log stimulus level:', error);
            return 'unavailable';
        }
    }

    async initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
            this.audioContext = null;
        }
    }

    getTaskDir() {
        const path = window.require('path');
        const { app } = window.require('@electron/remote') || window.require('electron').remote;
        return path.join(app.getAppPath(), 'src', 'renderer', 'tasks', 'speeded_classification');
    }

    // stimulus_list.csv mirrors Speeded_Classification_Task_Stimuli.xlsx:
    // stimulus_id,word,initial_phoneme,talker_sex,talker
    async loadStimuli() {
        const path = window.require('path');
        const fs = window.require('fs').promises;

        const csvPath = path.join(this.getTaskDir(), 'stimulus_list.csv');
        const csv = await fs.readFile(csvPath, 'utf8');
        const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const header = lines.shift().split(',').map(h => h.trim());

        this.stimulusList = lines.map(line => {
            const cells = line.split(',').map(c => c.trim());
            const row = {};
            header.forEach((key, i) => { row[key] = cells[i]; });
            return {
                stimulus_id: row.stimulus_id,
                word: row.word.toLowerCase(),
                initial_phoneme: row.initial_phoneme.toLowerCase(),
                talker_sex: row.talker_sex.toLowerCase(),
                talker: row.talker.toLowerCase()
            };
        });

        await this.loadAudioFiles();
    }

    // Builds a case-insensitive index of the audio folder so that e.g.
    // "bad_m1.wav", "Bad_M1.WAV" or "bad_m1.mp3" are all found.
    buildAudioIndex(audioDir) {
        const fs = window.require('fs');
        const path = window.require('path');
        const index = {};
        if (!fs.existsSync(audioDir)) return index;
        const preference = ['.wav', '.mp3', '.flac', '.ogg'];
        for (const file of fs.readdirSync(audioDir)) {
            const ext = path.extname(file).toLowerCase();
            if (!preference.includes(ext)) continue;
            const key = path.basename(file, path.extname(file)).toLowerCase();
            const existing = index[key];
            if (!existing || preference.indexOf(ext) < preference.indexOf(path.extname(existing).toLowerCase())) {
                index[key] = path.join(audioDir, file);
            }
        }
        return index;
    }

    async loadAudioFiles() {
        const path = window.require('path');
        const audioDir = path.join(this.getTaskDir(), 'audio');
        const index = this.buildAudioIndex(audioDir);

        console.log('Loading audio files from:', audioDir);
        this.missingAudio = [];

        for (const stimulus of this.stimulusList) {
            const audioPath = index[stimulus.stimulus_id.toLowerCase()];
            try {
                if (audioPath) {
                    this.audioFilePaths[stimulus.stimulus_id] = audioPath;
                    await this.loadAudioBuffer(audioPath, stimulus);
                } else {
                    console.warn(`Audio file not found for stimulus: ${stimulus.stimulus_id}`);
                    this.missingAudio.push(stimulus.stimulus_id);
                    this.audioBuffers[stimulus.stimulus_id] = await this.createFallbackAudio(stimulus);
                }
            } catch (error) {
                console.error(`Error loading audio file ${stimulus.stimulus_id}:`, error);
                this.missingAudio.push(stimulus.stimulus_id);
                this.audioBuffers[stimulus.stimulus_id] = await this.createFallbackAudio(stimulus);
            }
        }
    }

    async loadAudioBuffer(filePath, stimulus) {
        const fs = window.require('fs').promises;
        const audioData = await fs.readFile(filePath);
        const arrayBuffer = audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength);
        if (this.audioContext) {
            this.audioBuffers[stimulus.stimulus_id] = await this.audioContext.decodeAudioData(arrayBuffer);
        }
    }

    // Placeholder sound used only when a recording is missing, so the task
    // flow can still be tested. Missing files are listed on the welcome
    // screen and in the saved results.
    async createFallbackAudio(stimulus) {
        if (!this.audioContext) return null;
        
        const duration = 0.5;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, Math.round(duration * sampleRate), sampleRate);
        const data = buffer.getChannelData(0);
        
        const frequency = stimulus.talker_sex === 'male' ? 150 : 300;
        const burst = stimulus.initial_phoneme === 'p' ? 0.02 : 0;
        
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            data[i] = t < burst ? (Math.random() * 2 - 1) * 0.2 : Math.sin(2 * Math.PI * frequency * t) * 0.3;
            if (i > data.length * 0.8) {
                data[i] *= (data.length - i) / (data.length * 0.2);
            }
        }
        
        return buffer;
    }

    pickRandom(items) {
        return items[Math.floor(Math.random() * items.length)];
    }

    shuffle(items) {
        const array = [...items];
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Pseudo-random order in which the identical stimulus is never
    // presented on two successive trials (paper, control conditions).
    shuffleNoImmediateRepeat(items, keyFn = s => s.stimulus_id) {
        const distinct = new Set(items.map(keyFn)).size;
        if (distinct < 2) return this.shuffle(items);

        for (let attempt = 0; attempt < 500; attempt++) {
            const pool = this.shuffle(items);
            const sequence = [];
            let ok = true;
            while (pool.length) {
                const last = sequence.length ? keyFn(sequence[sequence.length - 1]) : null;
                // Prefer the stimulus with the most remaining copies to avoid dead ends
                const counts = {};
                pool.forEach(s => { counts[keyFn(s)] = (counts[keyFn(s)] || 0) + 1; });
                const candidates = pool
                    .map((s, i) => ({ s, i }))
                    .filter(({ s }) => keyFn(s) !== last);
                if (!candidates.length) { ok = false; break; }
                const maxCount = Math.max(...candidates.map(({ s }) => counts[keyFn(s)]));
                const remaining = pool.length;
                const forced = maxCount > Math.ceil(remaining / 2)
                    ? candidates.filter(({ s }) => counts[keyFn(s)] === maxCount)
                    : candidates;
                const choice = this.pickRandom(forced);
                sequence.push(choice.s);
                pool.splice(choice.i, 1);
            }
            if (ok) return sequence;
        }
        return this.shuffle(items);
    }

    resolveCounterbalancing() {
        const cb = this.config.parameters.counterbalancing;
        const pairs = SpeededClassificationPopup.PHONEME_PAIRS;

        const dimensionOrder = cb.dimension_order === 'phoneme_first' ? ['phoneme', 'voice']
            : cb.dimension_order === 'voice_first' ? ['voice', 'phoneme']
            : this.pickRandom([['phoneme', 'voice'], ['voice', 'phoneme']]);

        const conditionOrder = cb.condition_order === 'control_first' ? ['control', 'orthogonal']
            : cb.condition_order === 'orthogonal_first' ? ['orthogonal', 'control']
            : this.pickRandom([['control', 'orthogonal'], ['orthogonal', 'control']]);

        const phonemePair = pairs[cb.phoneme_control_pair] ? cb.phoneme_control_pair : this.pickRandom(Object.keys(pairs));
        const phonemeSex = ['male', 'female'].includes(cb.phoneme_control_talker_sex)
            ? cb.phoneme_control_talker_sex : this.pickRandom(['male', 'female']);
        const voiceWord = SpeededClassificationPopup.WORDS.includes(cb.voice_control_word)
            ? cb.voice_control_word : this.pickRandom(SpeededClassificationPopup.WORDS);

        return {
            dimension_order: dimensionOrder,
            condition_order: conditionOrder,
            phoneme_control_pair: phonemePair,
            phoneme_control_talker_sex: phonemeSex,
            voice_control_word: voiceWord,
            requested: { ...cb }
        };
    }

    getConditionStimulusSet(dimension, condition, cb) {
        if (condition === 'orthogonal') {
            return [...this.stimulusList];
        }
        if (dimension === 'phoneme') {
            const words = SpeededClassificationPopup.PHONEME_PAIRS[cb.phoneme_control_pair];
            return this.stimulusList.filter(s => words.includes(s.word) && s.talker_sex === cb.phoneme_control_talker_sex);
        }
        return this.stimulusList.filter(s => s.word === cb.voice_control_word);
    }

    getCorrectResponse(stimulus, dimension) {
        return dimension === 'phoneme' ? stimulus.initial_phoneme : stimulus.talker_sex;
    }

    buildTestSequence(set, condition) {
        const trials = this.config.parameters.trials;
        const reps = condition === 'control'
            ? Math.max(1, trials.control_repetitions)
            : Math.max(1, trials.orthogonal_repetitions);
        const items = [];
        for (let r = 0; r < reps; r++) items.push(...set);
        return condition === 'control' || reps > 1 ? this.shuffleNoImmediateRepeat(items) : this.shuffle(items);
    }

    // Practice trials are drawn from the same stimulus set as the upcoming
    // condition, balanced across the two response categories.
    buildPracticeSequence(set, dimension, count) {
        if (count <= 0) return [];
        const categories = [...new Set(set.map(s => this.getCorrectResponse(s, dimension)))];
        const pools = {};
        const draw = (category) => {
            if (!pools[category] || !pools[category].length) {
                pools[category] = this.shuffle(set.filter(s => this.getCorrectResponse(s, dimension) === category));
            }
            return pools[category].pop();
        };
        const items = [];
        for (let i = 0; i < count; i++) {
            items.push(draw(categories[i % categories.length]));
        }
        return this.shuffleNoImmediateRepeat(items);
    }

    getResponseButtons(dimension) {
        return dimension === 'phoneme'
            ? [
                { label: 'B', value: 'b', key: 'b', description: 'word starts with /b/' },
                { label: 'P', value: 'p', key: 'p', description: 'word starts with /p/' }
            ]
            : [
                { label: 'Male', value: 'male', key: 'm', description: 'male voice' },
                { label: 'Female', value: 'female', key: 'f', description: 'female voice' }
            ];
    }

    getInstructions(dimension, isPractice, practiceCount) {
        const task = dimension === 'phoneme'
            ? 'Decide whether each word begins with a <strong>B</strong> or a <strong>P</strong> sound. Ignore whether the speaker is male or female.\n\nPress the <strong>B</strong> key (or click B) for words starting with B.\nPress the <strong>P</strong> key (or click P) for words starting with P.'
            : 'Decide whether each word is spoken by a <strong>male</strong> or a <strong>female</strong> voice. Ignore what the word is.\n\nPress the <strong>M</strong> key (or click Male) for a male voice.\nPress the <strong>F</strong> key (or click Female) for a female voice.';
        const tail = isPractice
            ? `\n\nEach trial starts with a short beep, followed by the word. Respond as quickly and accurately as possible.\nYou will first do ${practiceCount} practice trials with feedback.`
            : '\n\nThe practice is over. Respond as quickly and accurately as possible.\nNo feedback will be provided.';
        return task + tail;
    }

    setupExperimentalPhases() {
        const trialParams = this.config.parameters.trials;
        const cb = this.resolveCounterbalancing();
        this.counterbalancing = cb;
        this.phases = [];

        let blockNumber = 0;
        const totalBlocks = cb.dimension_order.length * cb.condition_order.length;
        const dimensionLabel = { phoneme: 'Phoneme Classification', voice: 'Voice Classification' };

        for (const dimension of cb.dimension_order) {
            for (const condition of cb.condition_order) {
                blockNumber++;
                const set = this.getConditionStimulusSet(dimension, condition, cb);
                const responseButtons = this.getResponseButtons(dimension);
                const practiceCount = trialParams.practice_per_condition;

                if (practiceCount > 0) {
                    const stimuli = this.buildPracticeSequence(set, dimension, practiceCount);
                    this.phases.push({
                        name: `practice_${dimension}_${condition}`,
                        type: dimension,
                        dimension,
                        condition,
                        block: blockNumber,
                        isPractice: true,
                        trialCount: stimuli.length,
                        title: `Block ${blockNumber} of ${totalBlocks} – Practice: ${dimensionLabel[dimension]}`,
                        instructions: this.getInstructions(dimension, true, practiceCount),
                        responseButtons,
                        stimuli
                    });
                }

                const stimuli = this.buildTestSequence(set, condition);
                this.phases.push({
                    name: `main_${dimension}_${condition}`,
                    type: dimension,
                    dimension,
                    condition,
                    block: blockNumber,
                    isPractice: false,
                    trialCount: stimuli.length,
                    title: `Block ${blockNumber} of ${totalBlocks} – ${dimensionLabel[dimension]}`,
                    instructions: this.getInstructions(dimension, false, practiceCount),
                    responseButtons,
                    stimuli,
                    stimulusSet: set.map(s => s.stimulus_id)
                });
            }
        }

        // Remove phases with 0 trials
        this.phases = this.phases.filter(phase => phase.trialCount > 0);
    }

    renderMissingAudioWarning() {
        if (!this.missingAudio.length) return '';
        const shown = this.missingAudio.slice(0, 20).join(', ');
        const more = this.missingAudio.length > 20 ? ` … and ${this.missingAudio.length - 20} more` : '';
        return `
            <div class="audio-warning">
                <strong>⚠️ ${this.missingAudio.length} of ${this.stimulusList.length} stimulus recordings are missing</strong>
                and will be replaced by placeholder tones (for testing only — do not run participants).
                Add the files to <code>src/renderer/tasks/speeded_classification/audio/</code>
                named by stimulus ID (e.g. <code>bad_m1.wav</code>).<br>
                Missing: ${shown}${more}
            </div>
        `;
    }

    // Experimenter-facing counterbalancing choices, shown on the welcome
    // screen. "Random" draws the value when the task starts; the values
    // actually used are written to the results file.
    renderCounterbalancingControls() {
        const cb = this.config.parameters.counterbalancing;
        const select = (id, key, options) => `
            <div>
                <label for="${id}">${options.label}</label>
                <select id="${id}" data-cb="${key}">
                    ${options.values.map(([value, text]) =>
                        `<option value="${value}" ${cb[key] === value ? 'selected' : ''}>${text}</option>`
                    ).join('')}
                </select>
            </div>`;
        const words = SpeededClassificationPopup.WORDS.map(w => [w, w]);
        return `
            <details class="counterbalancing-panel">
                <summary>Counterbalancing (experimenter)</summary>
                <div class="counterbalancing-grid">
                    ${select('cb-dimension-order', 'dimension_order', { label: 'Dimension order', values: [['random', 'Random'], ['phoneme_first', 'Phoneme-relevant first'], ['voice_first', 'Voice-relevant first']] })}
                    ${select('cb-condition-order', 'condition_order', { label: 'Control / orthogonal order', values: [['random', 'Random'], ['control_first', 'Control first'], ['orthogonal_first', 'Orthogonal first']] })}
                    ${select('cb-phoneme-pair', 'phoneme_control_pair', { label: 'Phoneme control: b/p pair', values: [['random', 'Random'], ['bad-pad', 'bad – pad'], ['buff-puff', 'buff – puff'], ['beach-peach', 'beach – peach'], ['bill-pill', 'bill – pill']] })}
                    ${select('cb-phoneme-sex', 'phoneme_control_talker_sex', { label: 'Phoneme control: talkers', values: [['random', 'Random'], ['male', 'Male (m1–m4)'], ['female', 'Female (f1–f4)']] })}
                    ${select('cb-voice-word', 'voice_control_word', { label: 'Voice control: word', values: [['random', 'Random'], ...words] })}
                </div>
            </details>
        `;
    }

    readCounterbalancingControls() {
        document.querySelectorAll('[data-cb]').forEach(el => {
            this.config.parameters.counterbalancing[el.dataset.cb] = el.value;
        });
    }

    openTaskPopup() {
        const modalOverlay = document.getElementById('modal-overlay');
        const modalContent = modalOverlay.querySelector('.modal-content');
        
        modalOverlay.classList.add('task-modal');
        modalContent.innerHTML = this.generateTaskHTML();
        modalOverlay.classList.add('open');
        modalOverlay.setAttribute('aria-hidden', 'false');
        this.isOpen = true;
        
        this.bindTaskEvents();

        // Every new screen starts at the top (the window keeps its scroll
        // position otherwise, hiding the start of the next instructions)
        const stage = document.getElementById('task-stage');
        if (stage) new MutationObserver(() => { stage.scrollTop = 0; }).observe(stage, { childList: true });
        this.initializeTask();
    }

    generateTaskHTML() {
        const totalTrials = this.phases.reduce((sum, phase) => sum + phase.trialCount, 0);
        
        return `
            <div class="task-header">
                <h2 class="task-title">Speeded Classification Task</h2>
                <div class="participant-info">Participant: ${this.participantId}</div>
                <button type="button" class="task-close" aria-label="Exit task">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L10 9.293l4.646-4.647a.5.5 0 0 1 .708.708L10.707 10l4.647 4.646a.5.5 0 0 1-.708.708L10 10.707l-4.646 4.647a.5.5 0 0 1-.708-.708L9.293 10 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                    </svg>
                </button>
            </div>

            <div class="task-body">
                <div id="task-stage" class="task-stage">
                    <div class="task-welcome">
                        <h3>Welcome to the Speeded Classification Task</h3>
                        <p>You will hear spoken words. In each block you will classify every word either by its first sound (B or P) or by the speaker's voice (male or female).</p>
                        <p>Each trial starts with a short beep, followed half a second later by the word. Respond as quickly and accurately as possible using the keyboard keys or the onscreen buttons.</p>
                        <p>This task has ${this.phases.filter(p => !p.isPractice).length} blocks (${totalTrials} trials in total, including practice).</p>
                        ${this.renderMissingAudioWarning()}
                        ${this.renderCounterbalancingControls()}
                        <div class="audio-test">
                            <button id="audio-test-btn" class="task-button task-button-secondary">
                                🔊 Test Audio
                            </button>
                            <p style="font-size: 14px; color: #6e6e73; margin-top: 8px;">
                                Checks each audio output with a beep, then plays the warning beep and a word
                            </p>
                            <div class="oats-audio-check-result" id="audio-check-result" hidden></div>
                        </div>
                        <button id="begin-task-btn" class="task-button task-button-primary">
                            Begin Task
                        </button>
                    </div>
                </div>
            </div>

            <div class="task-footer">
                <div class="task-progress">
                    <span id="progress-display">Ready to start</span>
                </div>
                <div class="task-controls">
                    <button id="pause-task-btn" class="task-button task-button-secondary" disabled>
                        Pause
                    </button>
                    ${this.isDevMode() ? `<button id="finish-early-btn" class="task-button task-button-secondary" disabled title="Developer Mode only: end now and go to the results">
                        Finish Now (Dev)
                    </button>` : ''}
                    <button id="exit-task-btn" class="task-button task-button-danger">
                        Exit Task
                    </button>
                </div>
            </div>

            <style>
                .task-modal .modal-content {
                    width: 90vw;
                    height: 85vh;
                    max-width: 1000px;
                    max-height: 700px;
                    display: flex;
                    flex-direction: column;
                }

                .task-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 20px 24px;
                    border-bottom: 1px solid #e5e5e7;
                    background: #f5f5f7;
                }

                .task-title {
                    font-size: 20px;
                    font-weight: 600;
                    color: #1d1d1f;
                    margin: 0;
                }

                .participant-info {
                    font-size: 14px;
                    color: #6e6e73;
                    background: white;
                    padding: 4px 12px;
                    border-radius: 12px;
                    border: 1px solid #e5e5e7;
                }

                .task-close {
                    background: none;
                    border: none;
                    padding: 8px;
                    cursor: pointer;
                    border-radius: 6px;
                    color: #6e6e73;
                    transition: all 0.2s ease;
                }

                .task-close:hover {
                    background-color: #e5e5e7;
                    color: #1d1d1f;
                }

                .task-body {
                    flex: 1;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: white;
                }

                .task-stage {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    /* scroll rather than cut off content that doesn't fit */
                    overflow-y: auto;
                    align-items: safe center;
                    justify-content: center;
                    position: relative;
                    font-size: 16px;
                }

                .task-welcome, .phase-instructions {
                    text-align: center;
                    max-width: 600px;
                    padding: 40px;
                }

                .audio-test {
                    margin: 20px 0;
                }

                .audio-warning {
                    background: #fff3cd;
                    border: 2px solid #ffc107;
                    color: #664d03;
                    border-radius: 10px;
                    padding: 12px 16px;
                    margin: 16px 0;
                    font-size: 14px;
                    text-align: left;
                    max-height: 120px;
                    overflow-y: auto;
                }

                .counterbalancing-panel {
                    text-align: left;
                    background: #f8f9fa;
                    border: 1px solid #e5e5e7;
                    border-radius: 10px;
                    padding: 12px 16px;
                    margin: 16px 0;
                }

                .counterbalancing-panel summary {
                    cursor: pointer;
                    font-weight: 600;
                    color: #1d1d1f;
                    font-size: 14px;
                }

                .counterbalancing-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px 16px;
                    margin-top: 12px;
                }

                .counterbalancing-grid label {
                    display: block;
                    font-size: 12px;
                    color: #6e6e73;
                    margin-bottom: 4px;
                }

                .counterbalancing-grid select {
                    width: 100%;
                    padding: 6px 8px;
                    font-size: 13px;
                    border: 1px solid #d2d2d7;
                    border-radius: 6px;
                    background: white;
                }

                .key-hint {
                    display: block;
                    font-size: 12px;
                    font-weight: 500;
                    opacity: 0.7;
                    margin-top: 4px;
                }

                .task-welcome h3, .phase-instructions h3 {
                    margin-bottom: 20px;
                    color: #1d1d1f;
                    font-size: 24px;
                }

                .task-welcome p, .phase-instructions p {
                    margin-bottom: 16px;
                    color: #6e6e73;
                    line-height: 1.6;
                }

                .phase-instructions {
                    background: #f8f9fa;
                    border-radius: 12px;
                    border: 2px solid #007aff;
                }

                .response-buttons-preview {
                    display: flex;
                    gap: 20px;
                    justify-content: center;
                    margin: 20px 0;
                }

                .response-buttons-preview .preview-button {
                    padding: 10px 20px;
                    border: 2px solid #007aff;
                    background: white;
                    border-radius: 8px;
                    font-weight: 600;
                    color: #007aff;
                    font-size: 16px;
                }

                .fixation-cross {
                    font-size: 64px;
                    font-weight: bold;
                    color: #1d1d1f;
                    user-select: none;
                }

                .stimulus-display {
                    text-align: center;
                }

                .stimulus-icon {
                    font-size: 48px;
                    color: #007aff;
                    margin-bottom: 16px;
                    animation: pulse 1.5s infinite;
                }

                .stimulus-text {
                    font-size: 18px;
                    color: #6e6e73;
                    margin-bottom: 20px;
                }

                .response-buttons {
                    display: flex;
                    gap: 30px;
                    justify-content: center;
                    margin-top: 20px;
                }

                .response-button {
                    padding: 15px 30px;
                    border: 3px solid #007aff;
                    background: white;
                    border-radius: 12px;
                    font-weight: 700;
                    cursor: pointer;
                    color: #007aff;
                    font-size: 18px;
                    min-width: 100px;
                    transition: all 0.2s ease;
                    user-select: none;
                }

                .response-button:hover {
                    background: #007aff;
                    color: white;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
                }

                .response-button:active {
                    transform: translateY(0);
                    box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
                }

                .response-button.clicked {
                    background: #007aff;
                    color: white;
                    transform: scale(0.95);
                }

                .feedback {
                    text-align: center;
                    padding: 20px;
                    border-radius: 12px;
                    font-size: 18px;
                    font-weight: 600;
                }

                .feedback.correct {
                    background: #d1e7dd;
                    color: #0f5132;
                    border: 2px solid #34c759;
                }

                .feedback.incorrect {
                    background: #f8d7da;
                    color: #721c24;
                    border: 2px solid #ff3b30;
                }

                .feedback.timeout {
                    background: #fff3cd;
                    color: #664d03;
                    border: 2px solid #ffc107;
                }

                .task-button {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 16px;
                    margin: 8px;
                }

                .task-button-primary {
                    background: #007aff;
                    color: white;
                }

                .task-button-primary:hover:not(:disabled) {
                    background: #0056cc;
                    transform: translateY(-1px);
                }

                .task-button-secondary {
                    background: #f1f3f4;
                    color: #5f6368;
                }

                .task-button-secondary:hover:not(:disabled) {
                    background: #e8eaed;
                }

                .task-button-danger {
                    background: #ff3b30;
                    color: white;
                }

                .task-button-danger:hover:not(:disabled) {
                    background: #cc2e24;
                }

                .task-button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }

                .task-footer {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 24px;
                    border-top: 1px solid #e5e5e7;
                    background: #f5f5f7;
                }

                .task-progress {
                    font-size: 14px;
                    color: #6e6e73;
                    font-weight: 500;
                }

                .task-controls {
                    display: flex;
                    gap: 12px;
                }

                .task-complete {
                    text-align: center;
                    padding: 40px;
                }

                .task-complete h3 {
                    color: #34c759;
                    margin-bottom: 20px;
                    font-size: 28px;
                }

                .task-complete .summary {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 12px;
                    margin: 20px 0;
                }

                .task-complete .summary h4 {
                    margin-bottom: 12px;
                    color: #1d1d1f;
                }

                .task-complete .summary p {
                    margin: 8px 0;
                    color: #6e6e73;
                }

                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.8; }
                }
            </style>
        `;
    }

    bindTaskEvents() {
        const modalOverlay = document.getElementById('modal-overlay');
        
        // Close button
        modalOverlay.querySelector('.task-close').addEventListener('click', () => this.exitTask());

        // Exit button
        modalOverlay.querySelector('#exit-task-btn').addEventListener('click', () => this.exitTask());
        const finishBtn = modalOverlay.querySelector('#finish-early-btn');
        if (finishBtn) finishBtn.addEventListener('click', () => this.finishEarly());

        // Begin button
        modalOverlay.querySelector('#begin-task-btn').addEventListener('click', () => this.startExperiment());

        // Audio test button
        modalOverlay.querySelector('#audio-test-btn').addEventListener('click', () => this.testAudio());

        // Pause button
        modalOverlay.querySelector('#pause-task-btn').addEventListener('click', () => this.togglePause());

        // Prevent accidental closure during task
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay && this.taskState === 'running') {
                e.stopPropagation();
            }
        });
    }

    // Plays the warning tone followed by one real stimulus so the
    // experimenter can check presentation level before starting.
    async testAudio() {
        const sample = this.stimulusList.find(s => !this.missingAudio.includes(s.stimulus_id)) || this.stimulusList[0];
        try {
            this.audioCheck = await this.getAudioCheck().run({
                engine: this.asioEngine,
                volume: this.config.parameters.audio.volume,
                button: document.getElementById('audio-test-btn'),
                resultEl: document.getElementById('audio-check-result'),
                revealAfter: document.getElementById('begin-task-btn'),
                sampleLabel: 'warning beep and a word',
                playSample: async () => {
                    const playback = await this.startTrialAudio(sample);
                    await playback.ended;
                    return playback;
                }
            });
        } catch (error) {
            console.error('Audio test failed:', error);
        }
    }

    initializeTask() {
        this.taskState = 'ready';
        this.currentPhaseIndex = 0;
        this.currentTrialInPhase = 0;
        this.totalTrialsCompleted = 0;
        this.results = [];
        this.isPaused = false;
        this.startTime = null;
    }

    async startExperiment() {
        // Build the trial sequence with the experimenter's counterbalancing choices
        this.readCounterbalancingControls();
        this.setupExperimentalPhases();

        this.taskState = 'running';
        this.finishedEarly = false;
        this.startTime = new Date();
        
        document.getElementById('begin-task-btn').style.display = 'none';
        document.getElementById('pause-task-btn').disabled = false;
        const finishEarlyBtn = document.getElementById('finish-early-btn');
        if (finishEarlyBtn) finishEarlyBtn.disabled = false;

        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        await this.runExperiment();
    }

    async runExperiment() {
        this.trialLoopRunning = true;
        for (this.currentPhaseIndex = 0; this.currentPhaseIndex < this.phases.length; this.currentPhaseIndex++) {
            if (this.taskState === 'stopped' || this.finishedEarly) break;
            
            this.currentPhase = this.phases[this.currentPhaseIndex];
            
            // Show phase instructions
            await this.showPhaseInstructions();
            if (this.taskState === 'stopped' || this.finishedEarly) break;
            
            // Run trials for this phase
            for (this.currentTrialInPhase = 0; this.currentTrialInPhase < this.currentPhase.trialCount; this.currentTrialInPhase++) {
                if (this.taskState === 'stopped' || this.finishedEarly) break;
                
                while (this.isPaused && !this.finishedEarly) {
                    await this.wait(100);
                }
                if (this.finishedEarly) break;
                
                await this.runSingleTrial();
                this.totalTrialsCompleted++;
            }
        }
        
        this.trialLoopRunning = false;
        if (this.taskState !== 'stopped') {
            this.completeTask();
        }
    }

    async showPhaseInstructions() {
        const taskStage = document.getElementById('task-stage');
        const progressDisplay = document.getElementById('progress-display');
        
        progressDisplay.textContent = `Phase ${this.currentPhaseIndex + 1} of ${this.phases.length}: ${this.currentPhase.title}`;
        
        taskStage.innerHTML = `
            <div class="phase-instructions">
                <h3>${this.currentPhase.title}</h3>
                <p>${this.currentPhase.instructions.replace(/\n/g, '<br>')}</p>
                <div class="response-buttons-preview">
                    ${this.currentPhase.responseButtons.map(button => 
                        `<div class="preview-button">${button.label}<span class="key-hint">key: ${button.key.toUpperCase()}</span></div>`
                    ).join('')}
                </div>
                <button id="start-phase-btn" class="task-button task-button-primary">
                    Start ${this.currentPhase.isPractice ? 'Practice' : 'Block'}
                </button>
            </div>
        `;
        
        return new Promise(resolve => {
            document.getElementById('start-phase-btn').addEventListener('click', resolve);
            this.cancelInstructions = resolve;
        });
    }

    async runSingleTrial() {
        const taskStage = document.getElementById('task-stage');
        const progressDisplay = document.getElementById('progress-display');
        const stimulus = this.currentPhase.stimuli[this.currentTrialInPhase];
        
        const trialNumber = this.totalTrialsCompleted + 1;
        const totalTrials = this.phases.reduce((sum, phase) => sum + phase.trialCount, 0);
        
        progressDisplay.textContent = `Trial ${trialNumber} of ${totalTrials} (${this.currentPhase.title})`;
        
        // Warning signal: fixation cross on screen while the 500-Hz tone plays
        taskStage.innerHTML = '<div class="fixation-cross">+</div>';

        // Schedules warning tone -> delay -> stimulus; returns the stimulus
        // onset (performance.now() clock) and a promise for playback end.
        const playback = await this.startTrialAudio(stimulus);

        // Responses are collected from stimulus onset, as in the paper
        const responsePromise = this.collectResponse(playback.onsetPerf, this.currentPhase.responseButtons);

        const untilOnset = playback.onsetPerf - performance.now();
        if (untilOnset > 0) await this.wait(untilOnset);

        if (this.taskState !== 'stopped') {
            taskStage.innerHTML = `
                <div class="stimulus-display">
                    <div class="stimulus-icon">${this.currentPhase.type === 'phoneme' ? '🔊' : '👤'}</div>
                    <div class="stimulus-text">Listen carefully...</div>
                    <div class="response-buttons">
                        ${this.currentPhase.responseButtons.map(button => 
                            `<button class="response-button" data-response="${button.value}">
                                ${button.label}<span class="key-hint">${button.key.toUpperCase()}</span>
                            </button>`
                        ).join('')}
                    </div>
                </div>
            `;
        }
        
        const response = await responsePromise;
        if (response.response === 'aborted') return;

        const correctResponse = this.getCorrectResponse(stimulus, this.currentPhase.dimension);
        
        // Record trial result
        const trialResult = {
            phase: this.currentPhase.name,
            block: this.currentPhase.block,
            dimension: this.currentPhase.dimension,
            condition: this.currentPhase.condition,
            is_practice: this.currentPhase.isPractice,
            trial_in_phase: this.currentTrialInPhase + 1,
            global_trial: trialNumber,
            stimulus: stimulus.stimulus_id,
            word: stimulus.word,
            initial_phoneme: stimulus.initial_phoneme,
            talker: stimulus.talker,
            talker_sex: stimulus.talker_sex,
            stimulus_category: correctResponse,
            correct_response: correctResponse,
            participant_response: response.response,
            response_source: response.source,
            reaction_time: response.time,
            timed_out: response.response === 'timeout',
            accuracy: response.response === correctResponse ? 1 : 0,
            audio_placeholder: this.missingAudio.includes(stimulus.stimulus_id),
            audio_backend: playback.backend,
            timing_reliable: playback.timingReliable,
            timestamp: new Date().toISOString()
        };
        
        this.results.push(trialResult);

        // Let the word finish before the silent interval starts
        await Promise.race([playback.ended, this.wait(5000)]);
        // An output underrun while the tone or word played shifts the onset
        trialResult.timing_reliable = playback.timingReliable;
        
        // Feedback on practice trials only (none on test trials)
        if (this.currentPhase.isPractice) {
            await this.showFeedback(trialResult);
        }
        
        // 2-s silent interval before the next warning tone
        taskStage.innerHTML = '';
        await this.wait(this.config.parameters.timing.iti);
    }

    // ASIO: warning tone, silent gap and word go out as one continuous sound
    // on the Audio Setup output channels, so the tone-to-word gap is sample-exact
    // and the word onset comes from the interface's own clock (known before
    // the word is heard, so responses are timed from true word onset).
    async startTrialAudioAsio(stimulus) {
        const timing = this.config.parameters.timing;
        const engine = this.asioEngine;
        const filePath = this.audioFilePaths[stimulus.stimulus_id];
        const buffer = this.audioBuffers[stimulus.stimulus_id];
        let word;
        if (filePath) {
            word = await engine.loadFile(filePath);
        } else if (buffer) {
            word = await engine.resampleAudioBuffer(buffer);
        } else {
            word = [new Float32Array(Math.round(engine.sampleRate * 0.5))];
        }

        let onStarted;
        const started = new Promise((resolve) => { onStarted = resolve; });
        const played = engine.playSequence([
            { toneHz: timing.warning_tone_frequency, durationMs: timing.warning_tone_duration, level: 0.3, rampMs: 5 },
            { silenceMs: timing.warning_to_stimulus_delay },
            word
        ], {
            volume: this.config.parameters.audio.volume,
            onStart: onStarted
        });

        const first = await Promise.race([started, played, this.wait(2000).then(() => null)]);
        if (!first || first.cancelled || first.partOnsetPerfMs[2] == null) {
            engine.clearOutputQueue();
            throw new Error('ASIO did not start playback');
        }

        const playback = { onsetPerf: first.partOnsetPerfMs[2], backend: 'ASIO', timingReliable: true };
        playback.ended = played.then((result) => {
            playback.timingReliable = !result.cancelled && result.timingReliable !== false;
            return result;
        }, () => { playback.timingReliable = false; });
        return playback;
    }

    // Maps an AudioContext time to the performance.now() clock, taking
    // output latency into account when the browser exposes it.
    contextTimeToPerformance(contextTime) {
        const ctx = this.audioContext;
        if (ctx.getOutputTimestamp) {
            const ts = ctx.getOutputTimestamp();
            if (ts && ts.performanceTime > 0 && ts.contextTime > 0) {
                return ts.performanceTime + (contextTime - ts.contextTime) * 1000;
            }
        }
        return performance.now() + (contextTime - ctx.currentTime) * 1000;
    }

    async startTrialAudio(stimulus) {
        const timing = this.config.parameters.timing;
        const volume = this.config.parameters.audio.volume;
        const toneSec = timing.warning_tone_duration / 1000;
        const delaySec = timing.warning_to_stimulus_delay / 1000;
        if (this.asioEngine && this.asioEngine.isEnabled()) {
            try {
                return await this.startTrialAudioAsio(stimulus);
            } catch (error) {
                console.error('ASIO playback failed, falling back to Web Audio:', error);
            }
        }

        if (!this.audioContext) {
            await this.wait(timing.warning_tone_duration + timing.warning_to_stimulus_delay);
            return { onsetPerf: performance.now(), ended: this.wait(500), backend: 'none', timingReliable: false };
        }

        const ctx = this.audioContext;
        if (ctx.state === 'suspended') await ctx.resume();

        // Everything is scheduled on the audio clock so the
        // tone-to-stimulus interval is sample-accurate.
        const toneStart = ctx.currentTime + 0.05;
        const toneEnd = toneStart + toneSec;
        const stimulusStart = toneEnd + delaySec;

        const oscillator = ctx.createOscillator();
        const toneGain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = timing.warning_tone_frequency;
        oscillator.connect(toneGain);
        toneGain.connect(ctx.destination);
        const toneLevel = volume * 0.3;
        toneGain.gain.setValueAtTime(0, toneStart);
        toneGain.gain.linearRampToValueAtTime(toneLevel, toneStart + 0.005);
        toneGain.gain.setValueAtTime(toneLevel, Math.max(toneStart + 0.005, toneEnd - 0.005));
        toneGain.gain.linearRampToValueAtTime(0, toneEnd);
        oscillator.start(toneStart);
        oscillator.stop(toneEnd + 0.01);

        let ended;
        const buffer = this.audioBuffers[stimulus.stimulus_id];
        if (buffer) {
            const source = ctx.createBufferSource();
            const gainNode = ctx.createGain();
            source.buffer = buffer;
            source.connect(gainNode);
            gainNode.connect(ctx.destination);
            gainNode.gain.value = volume;
            ended = new Promise(resolve => { source.onended = resolve; });
            source.start(stimulusStart);
            this.currentSource = source;
        } else {
            console.warn(`No audio buffer for ${stimulus.stimulus_id}, using silence`);
            ended = this.wait((stimulusStart - ctx.currentTime) * 1000 + 500);
        }

        return { onsetPerf: this.contextTimeToPerformance(stimulusStart), ended, backend: 'WebAudio', timingReliable: true };
    }

    // Collects a keyboard or onscreen-button response. RT is measured from
    // stimulus onset; responses before onset are ignored; no response within
    // response_timeout ms of onset ends the trial as a timeout.
    collectResponse(onsetPerf, responseButtons) {
        return new Promise(resolve => {
            const timeoutMs = this.config.parameters.timing.response_timeout;
            const keyMap = {};
            responseButtons.forEach(b => { keyMap[b.key.toLowerCase()] = b.value; });
            const stage = document.getElementById('task-stage');
            let done = false;

            const eventTime = (e) => {
                const now = performance.now();
                return (e && e.timeStamp > 0 && Math.abs(now - e.timeStamp) < 1000) ? e.timeStamp : now;
            };

            const cleanup = () => {
                clearTimeout(timer);
                document.removeEventListener('keydown', onKey);
                if (stage) stage.removeEventListener('click', onClick);
                this.cancelResponse = null;
            };

            const finish = (value, time, source, buttonEl) => {
                if (done) return;
                const rt = time - onsetPerf;
                if (rt < 0) return; // before stimulus onset
                done = true;
                cleanup();
                if (rt > timeoutMs) {
                    resolve({ response: 'timeout', time: null, source: 'none' });
                    return;
                }
                if (buttonEl) buttonEl.classList.add('clicked');
                resolve({ response: value, time: Math.round(rt), source });
            };

            const onKey = (e) => {
                if (e.repeat) return;
                const value = keyMap[(e.key || '').toLowerCase()];
                if (!value) return;
                e.preventDefault();
                const btn = stage ? stage.querySelector(`.response-button[data-response="${value}"]`) : null;
                finish(value, eventTime(e), 'keyboard', btn);
            };

            const onClick = (e) => {
                const btn = e.target.closest ? e.target.closest('.response-button') : null;
                if (!btn) return;
                finish(btn.dataset.response, eventTime(e), 'button', btn);
            };

            const timer = setTimeout(() => {
                if (done) return;
                done = true;
                cleanup();
                resolve({ response: 'timeout', time: null, source: 'none' });
            }, Math.max(0, onsetPerf + timeoutMs - performance.now()));

            document.addEventListener('keydown', onKey);
            if (stage) stage.addEventListener('click', onClick);

            this.cancelResponse = () => {
                if (done) return;
                done = true;
                cleanup();
                resolve({ response: 'aborted', time: null, source: 'none' });
            };
        });
    }

    formatResponseLabel(value) {
        const labels = { b: 'B', p: 'P', male: 'Male', female: 'Female' };
        return labels[value] || value;
    }

    async showFeedback(trialResult) {
        const taskStage = document.getElementById('task-stage');
        let feedbackHTML = '';
        
        if (trialResult.participant_response === 'timeout') {
            feedbackHTML = `
                <div class="feedback timeout">
                    <div>⏱️</div>
                    <div>Too slow! Please respond faster.</div>
                </div>
            `;
        } else if (trialResult.accuracy === 1) {
            feedbackHTML = `
                <div class="feedback correct">
                    <div>✅</div>
                    <div>Correct!</div>
                    <div>Response time: ${trialResult.reaction_time}ms</div>
                </div>
            `;
        } else {
            feedbackHTML = `
                <div class="feedback incorrect">
                    <div>❌</div>
                    <div>Incorrect</div>
                    <div>The correct answer was: ${this.formatResponseLabel(trialResult.correct_response)}</div>
                </div>
            `;
        }
        
        taskStage.innerHTML = feedbackHTML;
        await this.wait(this.config.parameters.timing.error_display_duration);
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pause-task-btn');
        pauseBtn.textContent = this.isPaused ? 'Resume' : 'Pause';
        
        const progressDisplay = document.getElementById('progress-display');
        if (this.isPaused) {
            progressDisplay.textContent += ' (PAUSED)';
        } else {
            progressDisplay.textContent = progressDisplay.textContent.replace(' (PAUSED)', '');
        }
    }

    completeTask() {
        this.taskState = 'completed';
        const taskStage = document.getElementById('task-stage');
        const progressDisplay = document.getElementById('progress-display');
        
        const summary = this.calculateSummary();
        const g = summary.garner;
        const fmt = (v) => (v === null || isNaN(v)) ? 'N/A' : `${v.toFixed(0)}ms`;
        
        taskStage.innerHTML = `
            <div class="task-complete">
                <h3>Task Complete! 🎉</h3>
                <div class="summary">
                    <h4>Performance Summary</h4>
                    <p><strong>Test Trials:</strong> ${summary.mainTrials} (+ ${summary.practiceTrials} practice)</p>
                    <p><strong>Test Accuracy:</strong> ${(summary.mainAccuracy * 100).toFixed(1)}%</p>
                    <p><strong>Phoneme relevant:</strong> control ${fmt(g.phoneme.control.meanRT)}, orthogonal ${fmt(g.phoneme.orthogonal.meanRT)} → interference ${fmt(g.phoneme.interference)}</p>
                    <p><strong>Voice relevant:</strong> control ${fmt(g.voice.control.meanRT)}, orthogonal ${fmt(g.voice.orthogonal.meanRT)} → interference ${fmt(g.voice.interference)}</p>
                    <p><strong>Audio:</strong> ${this.describeTrialAudio()}</p>
                    ${this.finishedEarly ? `<p><strong>⚠️ Developer Mode test:</strong> finished early after ${this.results.length} trials</p>` : ''}
                </div>
                <button id="save-results-btn" class="task-button task-button-primary">
                    Save Results & Exit
                </button>
            </div>
        `;
        
        progressDisplay.textContent = 'Task completed successfully';
        document.getElementById('pause-task-btn').disabled = true;
        const finishEarlyBtn = document.getElementById('finish-early-btn');
        if (finishEarlyBtn) finishEarlyBtn.disabled = true;
        
        document.getElementById('save-results-btn').addEventListener('click', () => {
            this.saveResults();
        });
    }

    // ---------------------------------------------------------------
    // Scoring (Sommers & Danielson, 1999, Experiment 2)
    // ---------------------------------------------------------------

    mean(values) {
        return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    }

    sampleSD(values) {
        if (values.length < 2) return null;
        const m = this.mean(values);
        return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
    }

    // RT summary for one condition: no-response trials and errors are
    // excluded, then RTs more than 2 SD from the condition mean are trimmed.
    // Trimmed trials are flagged on the trial records (rt_outlier).
    summarizeCondition(trials) {
        const total = trials.length;
        const correct = trials.filter(t => t.accuracy === 1).length;
        const timeouts = trials.filter(t => t.timed_out).length;
        const rtTrials = trials.filter(t => t.accuracy === 1 && !t.timed_out && t.reaction_time !== null);
        const rts = rtTrials.map(t => t.reaction_time);
        const m = this.mean(rts);
        const sd = this.sampleSD(rts);

        trials.forEach(t => { t.rt_outlier = false; });
        const kept = [];
        rtTrials.forEach(t => {
            if (sd !== null && Math.abs(t.reaction_time - m) > 2 * sd) {
                t.rt_outlier = true;
            } else {
                kept.push(t.reaction_time);
            }
        });

        return {
            total,
            correct,
            accuracy: total ? correct / total : null,
            timeouts,
            nCorrectRTs: rts.length,
            nTrimmed: rts.length - kept.length,
            meanRT: this.mean(kept),
            sdRT: this.sampleSD(kept),
            untrimmedMeanRT: m
        };
    }

    calculateSummary() {
        const main = this.results.filter(r => !r.is_practice);
        const practice = this.results.filter(r => r.is_practice);
        const validResponses = main.filter(r => !r.timed_out && r.reaction_time !== null);

        const garner = {};
        for (const dimension of ['phoneme', 'voice']) {
            garner[dimension] = {};
            for (const condition of ['control', 'orthogonal']) {
                const trials = main.filter(r => r.dimension === dimension && r.condition === condition);
                garner[dimension][condition] = this.summarizeCondition(trials);
            }
            const c = garner[dimension].control.meanRT;
            const o = garner[dimension].orthogonal.meanRT;
            garner[dimension].interference = (c !== null && o !== null) ? o - c : null;
            garner[dimension].percentIncrease = (c !== null && o !== null && c > 0) ? (o - c) / c * 100 : null;
        }

        return {
            totalTrials: this.results.length,
            mainTrials: main.length,
            practiceTrials: practice.length,
            overallAccuracy: this.results.length ? this.results.reduce((s, r) => s + r.accuracy, 0) / this.results.length : 0,
            meanRT: validResponses.length ? this.mean(validResponses.map(r => r.reaction_time)) : 0,
            practiceAccuracy: practice.length ? practice.reduce((s, r) => s + r.accuracy, 0) / practice.length : 0,
            mainAccuracy: main.length ? main.reduce((s, r) => s + r.accuracy, 0) / main.length : 0,
            garner
        };
    }

    async saveResults() {
        // One save per run, even if the button is clicked twice
        if (this.savingResults) return;
        this.savingResults = true;
        const saveBtn = document.getElementById('save-results-btn');
        if (saveBtn) saveBtn.disabled = true;
        try {
            await this.saveResultsToFile();
            window.dashboard?.showToast('Task results saved successfully', 'success');
            
            setTimeout(() => {
                this.closeTaskPopup();
            }, 1500);
            
        } catch (error) {
            console.error('Error saving results:', error);
            window.dashboard?.showToast('Failed to save results', 'error');
            this.savingResults = false;
            if (saveBtn) saveBtn.disabled = false;
        }
    }

    async saveResultsToFile() {
        const path = window.require('path');
        const fs = window.require('fs').promises;
        const { app } = window.require('@electron/remote') || window.require('electron').remote;
        const { getTaskRunDir } = window.require(path.join(app.getAppPath(), 'src', 'shared', 'storage', 'participant-storage.js'));

        // <participant>/speededclassificationtask_<run start>/
        const taskDir = getTaskRunDir(this.participantId, 'speeded-classification', this.startTime || new Date());
        
        // Human-readable report (also computes the outlier flags)
        const textContent = this.generateResultsTextContent();
        const filePath = path.join(taskDir, 'results.txt');
        await fs.writeFile(filePath, textContent, 'utf8');

        // Trial-level data for analysis
        const csvPath = path.join(taskDir, 'trials.csv');
        await fs.writeFile(csvPath, this.generateTrialsCSV(), 'utf8');
        
        console.log(`Results saved to: ${filePath}`);
    }

    generateTrialsCSV() {
        const columns = [
            'participant_id', 'global_trial', 'block', 'phase', 'is_practice', 'dimension', 'condition',
            'trial_in_phase', 'stimulus', 'word', 'initial_phoneme', 'talker', 'talker_sex',
            'correct_response', 'participant_response', 'response_source', 'reaction_time',
            'timed_out', 'accuracy', 'rt_outlier', 'audio_placeholder', 'audio_backend', 'timing_reliable', 'timestamp'
        ];
        const escape = (v) => {
            const s = v === null || v === undefined ? '' : String(v);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const lines = [columns.join(',')];
        for (const trial of this.results) {
            const row = { participant_id: this.participantId, ...trial };
            lines.push(columns.map(c => escape(row[c])).join(','));
        }
        return lines.join('\n') + '\n';
    }

    generateResultsTextContent() {
        const summary = this.calculateSummary();
        const startTime = this.startTime ? this.startTime.toLocaleString() : 'Unknown';
        const endTime = new Date().toLocaleString();
        const fmtMs = (v) => (v === null || v === undefined || isNaN(v)) ? 'N/A' : v.toFixed(1);
        const fmtPct = (v) => (v === null || v === undefined || isNaN(v)) ? 'N/A' : `${(v * 100).toFixed(1)}%`;
        
        let content = '';
        
        // Header
        content += '='.repeat(60) + '\n';
        content += '           SPEEDED CLASSIFICATION TASK RESULTS\n';
        content += '='.repeat(60) + '\n\n';
        
        // Session Information
        content += 'SESSION INFORMATION\n';
        content += '-'.repeat(30) + '\n';
        content += `Participant ID: ${this.participantId}\n`;
        content += `App Version: ${globalThis.oatsAppInfo?.line() ?? 'unknown'}\n`;
        content += `Task: Speeded Classification Task (Garner, 1974; Sommers & Danielson, 1999)\n`;
        content += `Audio Backend: ${this.describeAudioBackend()}\n`;
        content += `Stimulus Level: ${this.logStimulusLevel('Speeded Classification')}\n`;
        content += `Audio Playback: ${this.describeTrialAudio()}\n`;
        content += `Audio Check: ${this.getAudioCheck().summarize(this.audioCheck)}\n`;
        if (this.finishedEarly) content += `NOTE: Developer Mode test, finished early after ${this.results.length} trials (incomplete run)\n`;
        content += `Start Time: ${startTime}\n`;
        content += `End Time: ${endTime}\n`;
        content += `Total Duration: ${this.calculateDuration()}\n\n`;

        // Counterbalancing actually used
        const cb = this.counterbalancing;
        content += 'COUNTERBALANCING (as run)\n';
        content += '-'.repeat(30) + '\n';
        content += `Dimension Order: ${cb.dimension_order.join(' -> ')}\n`;
        content += `Condition Order (within each dimension): ${cb.condition_order.join(' -> ')}\n`;
        content += `Phoneme-relevant Control Pair: ${cb.phoneme_control_pair} (${cb.phoneme_control_talker_sex} talkers)\n`;
        content += `Voice-relevant Control Word: ${cb.voice_control_word} (all 8 talkers)\n`;
        content += `Requested Settings: ${JSON.stringify(cb.requested)}\n\n`;
        
        // Configuration
        content += 'TASK CONFIGURATION\n';
        content += '-'.repeat(30) + '\n';
        const config = this.config.parameters;
        content += `Practice Trials per Condition: ${config.trials.practice_per_condition}\n`;
        content += `Control Repetitions per Stimulus: ${config.trials.control_repetitions}\n`;
        content += `Orthogonal Repetitions per Stimulus: ${config.trials.orthogonal_repetitions}\n`;
        content += `Warning Tone: ${config.timing.warning_tone_frequency}Hz, ${config.timing.warning_tone_duration}ms\n`;
        content += `Warning Tone -> Stimulus Delay: ${config.timing.warning_to_stimulus_delay}ms\n`;
        content += `Response Deadline (from stimulus onset): ${config.timing.response_timeout}ms\n`;
        content += `Silent Interval after Response: ${config.timing.iti}ms\n`;
        content += `Practice Feedback Duration: ${config.timing.error_display_duration}ms\n`;
        content += `Audio Volume: ${config.audio.volume}\n`;
        content += `Audio Output: ${this.describeTrialAudio()}\n`;
        if (this.missingAudio.length) {
            content += `WARNING: ${this.missingAudio.length} stimulus recordings were missing and replaced by placeholder tones: ${this.missingAudio.join(', ')}\n`;
        }
        content += '\n';

        // Garner interference
        content += 'GARNER INTERFERENCE (test trials only)\n';
        content += '-'.repeat(60) + '\n';
        content += 'RTs from correct trials, measured from stimulus onset; no-response\n';
        content += 'trials excluded; RTs > 2 SD from each condition mean removed.\n';
        content += 'Interference = orthogonal RT - control RT.\n\n';
        content += 'Dimension        | Control M (SD)      | Orthogonal M (SD)   | Interference | % Increase\n';
        content += '-'.repeat(90) + '\n';
        for (const dimension of ['phoneme', 'voice']) {
            const d = summary.garner[dimension];
            const label = (dimension === 'phoneme' ? 'Phoneme relevant' : 'Voice relevant').padEnd(16);
            const ctrl = `${fmtMs(d.control.meanRT)} (${fmtMs(d.control.sdRT)})`.padEnd(19);
            const orth = `${fmtMs(d.orthogonal.meanRT)} (${fmtMs(d.orthogonal.sdRT)})`.padEnd(19);
            const pct = d.percentIncrease === null ? 'N/A' : `${d.percentIncrease.toFixed(1)}%`;
            content += `${label} | ${ctrl} | ${orth} | ${fmtMs(d.interference).padStart(12)} | ${pct}\n`;
        }
        content += '\n';

        content += 'ACCURACY AND TRIAL COUNTS (test trials only)\n';
        content += '-'.repeat(60) + '\n';
        content += 'Dimension | Condition  | Trials | Correct | Accuracy | No-resp | RTs used | RTs trimmed\n';
        content += '-'.repeat(90) + '\n';
        for (const dimension of ['phoneme', 'voice']) {
            for (const condition of ['control', 'orthogonal']) {
                const c = summary.garner[dimension][condition];
                content += `${dimension.padEnd(9)} | ${condition.padEnd(10)} | ${String(c.total).padStart(6)} | ${String(c.correct).padStart(7)} | ${fmtPct(c.accuracy).padStart(8)} | ${String(c.timeouts).padStart(7)} | ${String(c.nCorrectRTs - c.nTrimmed).padStart(8)} | ${String(c.nTrimmed).padStart(11)}\n`;
            }
        }
        content += '\n';
        
        // Performance Summary
        content += 'PERFORMANCE SUMMARY\n';
        content += '-'.repeat(30) + '\n';
        content += `Total Trials Completed: ${summary.totalTrials} (${summary.mainTrials} test, ${summary.practiceTrials} practice)\n`;
        content += `Practice Accuracy: ${(summary.practiceAccuracy * 100).toFixed(1)}%\n`;
        content += `Test Accuracy: ${(summary.mainAccuracy * 100).toFixed(1)}%\n`;
        content += `Mean Test RT (all responded trials, untrimmed): ${summary.meanRT ? summary.meanRT.toFixed(0) : 'N/A'}ms\n\n`;
        
        // Phase-by-phase breakdown
        content += 'PHASE BREAKDOWN\n';
        content += '-'.repeat(30) + '\n';
        for (const phase of this.phases) {
            const phaseTrials = this.results.filter(r => r.phase === phase.name);
            if (!phaseTrials.length) continue;
            const phaseAccuracy = phaseTrials.reduce((sum, r) => sum + r.accuracy, 0) / phaseTrials.length;
            const validPhaseTrials = phaseTrials.filter(r => !r.timed_out && r.reaction_time !== null);
            const phaseMeanRT = validPhaseTrials.length > 0 ? 
                validPhaseTrials.reduce((sum, r) => sum + r.reaction_time, 0) / validPhaseTrials.length : 0;
            
            content += `${phase.title} [${phase.dimension}-relevant, ${phase.condition}${phase.isPractice ? ', practice' : ''}]:\n`;
            content += `  Trials: ${phaseTrials.length}\n`;
            content += `  Accuracy: ${(phaseAccuracy * 100).toFixed(1)}%\n`;
            content += `  Mean RT (untrimmed): ${phaseMeanRT.toFixed(0)}ms\n`;
            if (phase.stimulusSet) {
                content += phase.stimulusSet.length === this.stimulusList.length
                    ? `  Stimulus Set: all ${phase.stimulusSet.length} stimuli\n`
                    : `  Stimulus Set (${phase.stimulusSet.length}): ${phase.stimulusSet.join(', ')}\n`;
            }
            content += '\n';
        }
        
        // Detailed Trial Data
        content += 'DETAILED TRIAL DATA\n';
        content += '-'.repeat(60) + '\n';
        content += 'Trial | Phase                     | Stimulus  | Correct | Response | RT(ms) | Accurate | Outlier\n';
        content += '-'.repeat(95) + '\n';
        
        for (const trial of this.results) {
            const trialNum = trial.global_trial.toString().padStart(5);
            const phase = trial.phase.padEnd(25);
            const stimulus = trial.stimulus.padEnd(9);
            const correct = trial.correct_response.padEnd(7);
            const response = (trial.timed_out ? 'TIMEOUT' : trial.participant_response).padEnd(8);
            const rt = (trial.reaction_time === null ? 'N/A' : trial.reaction_time.toString()).padStart(6);
            const accurate = (trial.accuracy === 1 ? 'YES' : 'NO').padEnd(8);
            const outlier = trial.rt_outlier ? 'YES' : '';
            
            content += `${trialNum} | ${phase} | ${stimulus} | ${correct} | ${response} | ${rt} | ${accurate} | ${outlier}\n`;
        }
        
        content += '\n' + '='.repeat(60) + '\n';
        content += 'End of Results\n';
        content += '='.repeat(60) + '\n';
        
        return content;
    }

    calculateDuration() {
        if (!this.startTime) return 'Unknown';
        const durationMs = new Date() - this.startTime;
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }

    async exitTask() {
        // A finished run whose results haven't been saved yet is saved on
        // the way out (Save Results & Exit) rather than thrown away.
        if (this.taskState === 'completed') {
            if (!this.savingResults) this.saveResults();
            return;
        }
        if (this.taskState === 'running') {
            const exit = await oatsDialog.confirm('The run will stop and its progress will be lost.', { title: 'Exit the task?', okText: 'Exit', danger: true });
            if (!exit) return;
            // The task kept running behind the dialog: it may have finished
            if (this.taskState === 'completed') {
                if (!this.savingResults) this.saveResults();
                return;
            }
        }
        this.taskState = 'stopped';
        this.closeTaskPopup();
    }

    closeTaskPopup() {
        this.taskState = 'stopped';
        this.isPaused = false;
        if (this.cancelResponse) this.cancelResponse();
        if (this.cancelInstructions) this.cancelInstructions();
        try { if (this.currentSource) this.currentSource.stop(); } catch (e) { /* already stopped */ }
        try { if (this.asioEngine && this.asioEngine.isEnabled()) this.asioEngine.clearOutputQueue(); } catch (e) { /* engine gone */ }

        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.remove('open', 'task-modal');
            modalOverlay.setAttribute('aria-hidden', 'true');
            this.isOpen = false;
            
            setTimeout(() => {
                // Unless something was opened again in the meantime
                if (modalOverlay.classList.contains('open')) return;
                const modalContent = modalOverlay.querySelector('.modal-content');
                modalContent.innerHTML = '';
            }, 300);
        }
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Create global instance and expose the function
window.speedClassificationPopup = new SpeededClassificationPopup();
window.loadSpeededClassificationTask = async (participantId) => {
    // A fresh object per run, so nothing (trials, results folder, audio
    // check, flags) carries over from a previous run or participant.
    if (window.speedClassificationPopup && window.speedClassificationPopup.isOpen) return;
    window.speedClassificationPopup = new SpeededClassificationPopup();
    await window.speedClassificationPopup.loadTask(participantId);
};
