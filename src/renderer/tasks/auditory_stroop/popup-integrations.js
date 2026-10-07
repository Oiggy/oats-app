// Auditory Stroop Task Popup Integration
//
// Auditory Stroop task as in Sommers & Danielson (1999), Psychology and
// Aging 14(3), Experiment 2:
//
//   Stimuli    3 words (mother, father, person) x 4 talkers (2 male m1-m2,
//              2 female f1-f2) = 12 word-voice pairings, listed in
//              stimulus_list.csv; audio in ./audio/<stimulus_id>.wav
//   Task       decide as quickly and accurately as possible whether the word
//              was spoken by a man or a woman (ignore the word's meaning)
//   Conditions congruent   - "father" by a man, "mother" by a woman
//              neutral     - "person" by a man or a woman
//              incongruent - "mother" by a man, "father" by a woman
//   Block      each of the 12 pairings presented 6 times = 72 trials
//              (24 per condition), single block, pseudo-random order
//   Trial      500-Hz warning tone -> 500 ms -> word. RT measured from word
//              onset. Responses slower than 3 s count as incorrect. 2-s delay
//              between the response and the next warning tone.
//   Scoring    RTs > 2 SD from each condition's mean and no-response trials
//              excluded; interference = incongruent RT - neutral RT.
//
// The paper does not describe a practice block for this task; the practice
// phase kept here (default 12 trials with feedback, one of each pairing)
// mirrors the 12 practice trials used for the Garner task.
class AuditoryStroopPopup {
    constructor() {
        this.isOpen = false;
        this.participantId = null;
        this.config = null;
        this.currentPhase = 'welcome'; // welcome, practice, main, complete
        this.currentTrial = 0;
        this.results = [];
        this.audioContext = null;
        this.audioBuffers = {};
        this.audioFilePaths = {};
        this.missingAudio = [];
        this.asioEngine = null;
        this.stimulusList = [];
        this.practiceStimuli = [];
        this.mainStimuli = [];
        this.startTime = null;
        this.isPaused = false;
        this.taskState = 'ready';
        this.cancelResponse = null;
        this.currentSource = null;
    }

    static get CONFIG_VERSION() {
        return 2;
    }

    static get RESPONSE_BUTTONS() {
        return [
            { label: 'M', value: 'M', key: 'm', description: 'male voice' },
            { label: 'F', value: 'F', key: 'f', description: 'female voice' }
        ];
    }

    async loadTask(participantId) {
        if (this.isOpen) return;
        
        this.participantId = participantId;
        this.loadAsioEngine();
        await this.loadConfiguration();
        await this.initializeAudioContext();
        await this.loadStimuli();
        this.setupStimuli();
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
            
            const configPath = path.join(baseDir, 'cfg_auditory_stroop_task.json');
            const configData = await fs.readFile(configPath, 'utf8');
            const saved = JSON.parse(configData);

            // Configurations saved by the old placeholder version of this task
            // don't describe the paper's design, so they are ignored.
            if (saved.version !== AuditoryStroopPopup.CONFIG_VERSION) {
                console.log('Auditory Stroop configuration is from an older version, using paper defaults');
                this.config = defaults;
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
            task: 'auditory-stroop',
            version: AuditoryStroopPopup.CONFIG_VERSION,
            parameters: {
                trials: {
                    practice: 12,      // not specified in the paper
                    repetitions: 6     // 12 pairings x 6 = 72 trials (24 per condition)
                },
                timing: {
                    warning_tone_frequency: 500,     // Hz
                    warning_tone_duration: 100,      // ms
                    warning_to_stimulus_delay: 500,  // ms, tone offset -> word onset
                    iti: 2000,                       // ms between response and next warning tone
                    response_timeout: 3000,          // ms from word onset; slower = incorrect
                    error_display_duration: 1500     // ms, practice feedback only
                },
                audio: {
                    volume: 0.8
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
    finishEarly() {
        if (this.taskState !== 'running' || this.finishedEarly) return;
        if (!confirm('Finish the task now and go to the results?\n\nDeveloper Mode test: the results will be marked as an incomplete run.')) return;
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
        return path.join(app.getAppPath(), 'src', 'renderer', 'tasks', 'auditory_stroop');
    }

    static getCondition(word, talkerSex) {
        if (word === 'person') return 'neutral';
        if ((word === 'father' && talkerSex === 'male') || (word === 'mother' && talkerSex === 'female')) return 'congruent';
        return 'incongruent';
    }

    // stimulus_list.csv mirrors Auditory_Stroop_Task_Stimuli.xlsx:
    // stimulus_id,word,talker_sex,talker
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
            const word = row.word.toLowerCase();
            const voice = row.talker_sex.toLowerCase();
            return {
                stimulus_id: row.stimulus_id,
                file: row.stimulus_id,
                word,
                voice,
                talker: row.talker.toLowerCase(),
                condition: AuditoryStroopPopup.getCondition(word, voice),
                correct_response: voice === 'male' ? 'M' : 'F'
            };
        });

        await this.loadAudioFiles();
    }

    // Case-insensitive index of the audio folder ("father_m1.wav",
    // "Father_M1.WAV" and "father_m1.mp3" are all found).
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

    // Placeholder used only when a recording is missing so the flow can be
    // tested; missing files are listed on the welcome screen and in results.
    async createFallbackAudio(stimulus) {
        if (!this.audioContext) return null;
        
        const duration = 0.8;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, Math.round(duration * sampleRate), sampleRate);
        const data = buffer.getChannelData(0);
        const frequency = stimulus.voice === 'male' ? 120 : 250;
        
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
            if (i > data.length * 0.8) {
                data[i] *= (data.length - i) / (data.length * 0.2);
            }
        }
        
        return buffer;
    }

    shuffle(items) {
        const array = [...items];
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Pseudo-random order in which the identical word-voice pairing is
    // never presented on two successive trials.
    shuffleNoImmediateRepeat(items, keyFn = s => s.stimulus_id) {
        if (new Set(items.map(keyFn)).size < 2) return this.shuffle(items);

        for (let attempt = 0; attempt < 500; attempt++) {
            const pool = this.shuffle(items);
            const sequence = [];
            let ok = true;
            while (pool.length) {
                const last = sequence.length ? keyFn(sequence[sequence.length - 1]) : null;
                const counts = {};
                pool.forEach(s => { counts[keyFn(s)] = (counts[keyFn(s)] || 0) + 1; });
                const candidates = pool.map((s, i) => ({ s, i })).filter(({ s }) => keyFn(s) !== last);
                if (!candidates.length) { ok = false; break; }
                const maxCount = Math.max(...candidates.map(({ s }) => counts[keyFn(s)]));
                const forced = maxCount > Math.ceil(pool.length / 2)
                    ? candidates.filter(({ s }) => counts[keyFn(s)] === maxCount)
                    : candidates;
                const choice = forced[Math.floor(Math.random() * forced.length)];
                sequence.push(choice.s);
                pool.splice(choice.i, 1);
            }
            if (ok) return sequence;
        }
        return this.shuffle(items);
    }

    setupStimuli() {
        const trials = this.config.parameters.trials;

        // Main block: every word-voice pairing x repetitions (paper: 12 x 6 = 72)
        const main = [];
        for (let r = 0; r < Math.max(1, trials.repetitions); r++) main.push(...this.stimulusList);
        this.mainStimuli = this.shuffleNoImmediateRepeat(main);

        // Practice: cycles through all pairings so every condition is seen
        const practice = [];
        let pool = [];
        for (let i = 0; i < trials.practice; i++) {
            if (!pool.length) pool = this.shuffle(this.stimulusList);
            practice.push(pool.pop());
        }
        this.practiceStimuli = this.shuffleNoImmediateRepeat(practice);
    }

    renderMissingAudioWarning() {
        if (!this.missingAudio.length) return '';
        return `
            <div class="audio-warning">
                <strong>⚠️ ${this.missingAudio.length} of ${this.stimulusList.length} stimulus recordings are missing</strong>
                and will be replaced by placeholder tones (for testing only — do not run participants).
                Add the files to <code>src/renderer/tasks/auditory_stroop/audio/</code>
                named by stimulus ID (e.g. <code>father_m1.wav</code>).<br>
                Missing: ${this.missingAudio.join(', ')}
            </div>
        `;
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
        this.showWelcomeScreen();
    }

    generateTaskHTML() {
        return `
            <div class="task-header">
                <h2 class="task-title">Auditory Stroop Task</h2>
                <div class="participant-info">Participant: ${this.participantId}</div>
                <button type="button" class="task-close" aria-label="Exit task">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L10 9.293l4.646-4.647a.5.5 0 0 1 .708.708L10.707 10l4.647 4.646a.5.5 0 0 1-.708.708L10 10.707l-4.646 4.647a.5.5 0 0 1-.708-.708L9.293 10 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                    </svg>
                </button>
            </div>

            <div class="task-body">
                <div id="task-stage" class="task-stage">
                    <!-- Task content will be injected here -->
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

                .welcome-screen,
                .instructions-screen {
                    text-align: center;
                    max-width: 600px;
                    padding: 40px;
                }

                .audio-test-section {
                    margin: 24px 0;
                }

                .welcome-screen h3,
                .instructions-screen h3 {
                    margin-bottom: 20px;
                    color: #1d1d1f;
                    font-size: 24px;
                }

                .welcome-screen p,
                .instructions-screen p {
                    margin-bottom: 16px;
                    color: #6e6e73;
                    line-height: 1.6;
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

                .key-hint {
                    display: block;
                    font-size: 12px;
                    font-weight: 500;
                    opacity: 0.7;
                    margin-top: 4px;
                }

                .audio-caption {
                    font-size: 14px;
                    color: #6e6e73;
                    margin-top: 8px;
                }

                .response-buttons-preview {
                    display: flex;
                    gap: 20px;
                    justify-content: center;
                    margin: 20px 0;
                }

                .preview-button {
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

        // Pause button
        modalOverlay.querySelector('#pause-task-btn').addEventListener('click', () => this.togglePause());

        // Prevent accidental closure during task
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay && this.taskState === 'running') {
                e.stopPropagation();
            }
        });
    }

    showWelcomeScreen() {
        const taskStage = document.getElementById('task-stage');
        const progressDisplay = document.getElementById('progress-display');
        
        progressDisplay.textContent = 'Ready to start';
        
        taskStage.innerHTML = `
            <div class="welcome-screen">
                <h3>Welcome to the Auditory Stroop Task</h3>
                <p>You will hear the words <em>mother</em>, <em>father</em> and <em>person</em> spoken by male and female voices. Your task is to decide whether the speaker is a <strong>man</strong> or a <strong>woman</strong>, ignoring the meaning of the word.</p>
                <p>Each trial starts with a short beep, followed by the word. Respond as quickly and accurately as possible using the M and F keys or the onscreen buttons.</p>
                ${this.renderMissingAudioWarning()}
                
                <div class="audio-test-section">
                    <button id="test-audio-btn" class="task-button task-button-secondary">
                        🔊 Test Audio
                    </button>
                    <p class="audio-caption">Checks each audio output with a beep, then plays the warning beep and a word</p>
                    <div class="oats-audio-check-result" id="audio-check-result" hidden></div>
                </div>
                
                <button id="begin-task-btn" class="task-button task-button-primary">
                    Begin Task
                </button>
            </div>
        `;
        
        // Bind welcome screen events
        document.getElementById('test-audio-btn').addEventListener('click', () => this.testAudio());
        document.getElementById('begin-task-btn').addEventListener('click', () => this.startPracticePhase());
    }

    async testAudio() {
        const sample = this.stimulusList.find(s => !this.missingAudio.includes(s.stimulus_id)) || this.stimulusList[0];
        try {
            this.audioCheck = await this.getAudioCheck().run({
                engine: this.asioEngine,
                volume: this.config.parameters.audio.volume,
                button: document.getElementById('test-audio-btn'),
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

    async startPracticePhase() {
        this.finishedEarly = false;
        this.currentTrial = 0;
        this.taskState = 'running';
        this.startTime = new Date();

        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        // Enable pause button
        document.getElementById('pause-task-btn').disabled = false;
        const finishEarlyBtn = document.getElementById('finish-early-btn');
        if (finishEarlyBtn) finishEarlyBtn.disabled = false;

        if (!this.practiceStimuli.length) {
            this.startMainPhase();
            return;
        }
        this.currentPhase = 'practice';
        this.showPracticeInstructions();
    }

    renderButtonPreview() {
        return AuditoryStroopPopup.RESPONSE_BUTTONS.map(b =>
            `<div class="preview-button">${b.label}<span class="key-hint">key: ${b.key.toUpperCase()}</span></div>`
        ).join('');
    }

    showPracticeInstructions() {
        const taskStage = document.getElementById('task-stage');
        const progressDisplay = document.getElementById('progress-display');
        
        progressDisplay.textContent = 'Phase 1 of 2: Practice – Auditory Stroop';
        
        taskStage.innerHTML = `
            <div class="instructions-screen">
                <h3>Practice: Auditory Stroop</h3>
                <p>You will hear a word spoken by a man or a woman. Decide whether the <strong>voice</strong> is male or female — ignore what the word means.</p>
                <p><strong>Press M (or click M) for a male voice.<br>Press F (or click F) for a female voice.</strong></p>
                <p>Respond as quickly and accurately as possible. You will receive feedback during these ${this.practiceStimuli.length} practice trials.</p>
                
                <div class="response-buttons-preview">
                    ${this.renderButtonPreview()}
                </div>
                
                <button id="start-practice-btn" class="task-button task-button-primary">
                    Start Practice
                </button>
            </div>
        `;
        
        document.getElementById('start-practice-btn').addEventListener('click', () => {
            this.runTrialSequence('practice');
        });
    }

    startMainPhase() {
        this.currentPhase = 'main';
        this.currentTrial = 0;
        
        this.showMainInstructions();
    }

    showMainInstructions() {
        const taskStage = document.getElementById('task-stage');
        const progressDisplay = document.getElementById('progress-display');
        
        progressDisplay.textContent = this.practiceStimuli.length
            ? 'Phase 2 of 2: Main – Auditory Stroop'
            : 'Main – Auditory Stroop';
        
        taskStage.innerHTML = `
            <div class="instructions-screen">
                <h3>Main Task: Auditory Stroop</h3>
                <p>You will again hear words spoken by a man or a woman. Decide whether the <strong>voice</strong> is male or female, ignoring the word meaning.</p>
                <p><strong>Press M (or click M) for a male voice.<br>Press F (or click F) for a female voice.</strong></p>
                <p>Respond as quickly and accurately as possible. No feedback will be provided in this phase.</p>
                
                <div class="response-buttons-preview">
                    ${this.renderButtonPreview()}
                </div>
                
                <button id="start-main-btn" class="task-button task-button-primary">
                    Start Main Task
                </button>
            </div>
        `;
        
        document.getElementById('start-main-btn').addEventListener('click', () => {
            this.runTrialSequence('main');
        });
    }

    async runTrialSequence(phase) {
        const stimuli = phase === 'practice' ? this.practiceStimuli : this.mainStimuli;
        this.trialLoopRunning = true;
        
        for (this.currentTrial = 0; this.currentTrial < stimuli.length; this.currentTrial++) {
            if (this.taskState === 'stopped' || this.finishedEarly) break;
            
            while (this.isPaused && !this.finishedEarly) {
                await this.wait(100);
            }
            if (this.finishedEarly) break;
            
            await this.runSingleTrial(phase, stimuli[this.currentTrial]);
        }
        
        this.trialLoopRunning = false;
        if (this.finishedEarly) {
            if (this.taskState === 'running') this.completeTask();
            return;
        }

        if (this.taskState !== 'stopped') {
            if (phase === 'practice') {
                this.startMainPhase();
            } else {
                this.completeTask();
            }
        }
    }

    async runSingleTrial(phase, stimulus) {
        const taskStage = document.getElementById('task-stage');
        const progressDisplay = document.getElementById('progress-display');
        
        const trialNum = this.currentTrial + 1;
        const totalTrials = phase === 'practice' ? this.practiceStimuli.length : this.mainStimuli.length;
        
        progressDisplay.textContent = `${phase === 'practice' ? 'Practice' : 'Main'} Trial ${trialNum} of ${totalTrials}`;
        
        // Warning signal: fixation cross while the 500-Hz tone plays
        taskStage.innerHTML = '<div class="fixation-cross">+</div>';

        const playback = await this.startTrialAudio(stimulus);
        const responsePromise = this.collectResponse(playback.onsetPerf);

        const untilOnset = playback.onsetPerf - performance.now();
        if (untilOnset > 0) await this.wait(untilOnset);

        if (this.taskState !== 'stopped') {
            taskStage.innerHTML = `
                <div class="stimulus-display">
                    <div class="stimulus-icon">🔊</div>
                    <div class="stimulus-text">Listen carefully...</div>
                    <div class="response-buttons">
                        ${AuditoryStroopPopup.RESPONSE_BUTTONS.map(b =>
                            `<button class="response-button" data-response="${b.value}">${b.label}<span class="key-hint">${b.key.toUpperCase()}</span></button>`
                        ).join('')}
                    </div>
                </div>
            `;
        }
        
        const response = await responsePromise;
        if (response.response === 'aborted') return;
        
        // Record trial result
        const trialResult = {
            phase: phase,
            trial: trialNum,
            global_trial: this.results.length + 1,
            stimulus_file: stimulus.stimulus_id,
            voice_gender: stimulus.voice,
            talker: stimulus.talker,
            word: stimulus.word,
            condition: stimulus.condition,
            correct_response: stimulus.correct_response,
            participant_response: response.response,
            response_source: response.source,
            reaction_time: response.time,
            timed_out: response.response === 'timeout',
            // Responses slower than the deadline count as incorrect (paper)
            accuracy: response.response === stimulus.correct_response ? 1 : 0,
            audio_placeholder: this.missingAudio.includes(stimulus.stimulus_id),
            audio_backend: playback.backend,
            timing_reliable: playback.timingReliable,
            timestamp: new Date().toISOString()
        };
        
        this.results.push(trialResult);

        // Let the word finish before the inter-trial delay
        await Promise.race([playback.ended, this.wait(5000)]);
        // An output underrun while the tone or word played shifts the onset
        trialResult.timing_reliable = playback.timingReliable;
        
        // Feedback during practice only (no feedback on test trials)
        if (phase === 'practice') {
            await this.showFeedback(trialResult, phase);
        }
        
        // 2-s delay before the next warning tone
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
            word = [new Float32Array(Math.round(engine.sampleRate * 0.8))];
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

    // Plays warning tone -> delay -> word. Returns the word onset on the
    // performance.now() clock and a promise that resolves when it ends.
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
            return { onsetPerf: performance.now(), ended: this.wait(800), backend: 'none', timingReliable: false };
        }

        const ctx = this.audioContext;
        if (ctx.state === 'suspended') await ctx.resume();

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
            ended = this.wait((stimulusStart - ctx.currentTime) * 1000 + 800);
        }

        return { onsetPerf: this.contextTimeToPerformance(stimulusStart), ended, backend: 'WebAudio', timingReliable: true };
    }

    // Keyboard (M/F) or onscreen-button response, timed from word onset.
    collectResponse(onsetPerf) {
        return new Promise(resolve => {
            const timeoutMs = this.config.parameters.timing.response_timeout;
            const keyMap = {};
            AuditoryStroopPopup.RESPONSE_BUTTONS.forEach(b => { keyMap[b.key] = b.value; });
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
                if (rt < 0) return; // before word onset
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

    async showFeedback(trialResult, phase) {
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
                    <div>Voice was ${trialResult.voice_gender}</div>
                    <div>Response time: ${trialResult.reaction_time}ms</div>
                </div>
            `;
        } else {
            feedbackHTML = `
                <div class="feedback incorrect">
                    <div>❌</div>
                    <div>Incorrect</div>
                    <div>Voice was ${trialResult.voice_gender}</div>
                    <div>Correct answer was: ${trialResult.correct_response}</div>
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
        const fmt = (v) => (v === null || isNaN(v)) ? 'N/A' : `${v.toFixed(0)}ms`;
        const c = summary.conditions;
        
        taskStage.innerHTML = `
            <div class="task-complete">
                <h3>Task Complete! 🎉</h3>
                <div class="summary">
                    <h4>End of Block Summary</h4>
                    <p><strong>Number correct:</strong> ${summary.correctResponses} of ${summary.totalTrials}</p>
                    <p><strong>Accuracy:</strong> ${(summary.accuracy * 100).toFixed(1)}%</p>
                    <p><strong>Mean RT:</strong> congruent ${fmt(c.congruent.meanRT)}, neutral ${fmt(c.neutral.meanRT)}, incongruent ${fmt(c.incongruent.meanRT)}</p>
                    <p><strong>Stroop interference (incongruent − neutral):</strong> ${fmt(summary.interference)}</p>
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

    // Correct, responded trials only; RTs > 2 SD from the condition mean are
    // trimmed and flagged (rt_outlier) on the trial records.
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
        const main = this.results.filter(r => r.phase === 'main');
        const scored = main.length ? main : this.results;
        const validResponses = scored.filter(r => !r.timed_out && r.reaction_time !== null);
        const correctResponses = scored.filter(r => r.accuracy === 1).length;

        const conditions = {};
        for (const condition of ['congruent', 'neutral', 'incongruent']) {
            conditions[condition] = this.summarizeCondition(main.filter(r => r.condition === condition));
        }
        const n = conditions.neutral.meanRT;
        const i = conditions.incongruent.meanRT;
        
        return {
            totalTrials: scored.length,
            correctResponses: correctResponses,
            accuracy: scored.length ? correctResponses / scored.length : 0,
            meanRT: validResponses.length > 0 ? 
                validResponses.reduce((sum, r) => sum + r.reaction_time, 0) / validResponses.length : 0,
            conditions,
            interference: (n !== null && i !== null) ? i - n : null
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
        const os = window.require('os');
        const path = window.require('path');
        const fs = window.require('fs').promises;
        const { app } = window.require('@electron/remote') || window.require('electron').remote;
        const { getParticipantFolderName } = window.require(path.join(app.getAppPath(), 'src', 'shared', 'storage', 'participant-storage.js'));
        const sessionsFolder = getParticipantFolderName(this.participantId);

        // Get platform-specific sessions directory
        let baseDir;
        if (process.platform === 'win32') {
            baseDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Oats', sessionsFolder);
        } else if (process.platform === 'darwin') {
            baseDir = path.join(os.homedir(), 'Documents', 'Oats', sessionsFolder);
        } else {
            baseDir = path.join(os.homedir(), 'Documents', 'Oats', sessionsFolder);
        }
        
        // Create participant folder
        const participantDir = path.join(baseDir, this.participantId);
        await fs.mkdir(participantDir, { recursive: true });
        
        // Create ast_timestamp folder
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
        const taskDir = path.join(participantDir, `ast_${timestamp}`);
        await fs.mkdir(taskDir, { recursive: true });
        
        // Human-readable report (also computes the outlier flags)
        const textContent = this.generateResultsTextContent();
        const filePath = path.join(taskDir, 'results.txt');
        await fs.writeFile(filePath, textContent, 'utf8');

        // Trial-level data for analysis
        await fs.writeFile(path.join(taskDir, 'trials.csv'), this.generateTrialsCSV(), 'utf8');
        
        console.log(`Results saved to: ${filePath}`);
    }

    generateTrialsCSV() {
        const columns = [
            'participant_id', 'global_trial', 'phase', 'trial', 'stimulus_file', 'word', 'talker',
            'voice_gender', 'condition', 'correct_response', 'participant_response', 'response_source',
            'reaction_time', 'timed_out', 'accuracy', 'rt_outlier', 'audio_placeholder', 'audio_backend', 'timing_reliable', 'timestamp'
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
        content += '              AUDITORY STROOP TASK RESULTS\n';
        content += '='.repeat(60) + '\n\n';
        
        // Session Information
        content += 'SESSION INFORMATION\n';
        content += '-'.repeat(30) + '\n';
        content += `Participant ID: ${this.participantId}\n`;
        content += `Task: Auditory Stroop Task (Sommers & Danielson, 1999)\n`;
        content += `Audio Backend: ${this.describeAudioBackend()}\n`;
        content += `Stimulus Level: ${this.logStimulusLevel('Auditory Stroop')}\n`;
        content += `Audio Playback: ${this.describeTrialAudio()}\n`;
        content += `Audio Check: ${this.getAudioCheck().summarize(this.audioCheck)}\n`;
        if (this.finishedEarly) content += `NOTE: Developer Mode test, finished early after ${this.results.length} trials (incomplete run)\n`;
        content += `Start Time: ${startTime}\n`;
        content += `End Time: ${endTime}\n`;
        content += `Total Duration: ${this.calculateDuration()}\n\n`;
        
        // Configuration
        content += 'TASK CONFIGURATION\n';
        content += '-'.repeat(30) + '\n';
        const config = this.config.parameters;
        content += `Practice Trials: ${this.practiceStimuli.length}\n`;
        content += `Repetitions per Word-Voice Pairing: ${config.trials.repetitions} (${this.mainStimuli.length} main trials)\n`;
        content += `Warning Tone: ${config.timing.warning_tone_frequency}Hz, ${config.timing.warning_tone_duration}ms\n`;
        content += `Warning Tone -> Word Delay: ${config.timing.warning_to_stimulus_delay}ms\n`;
        content += `Response Deadline (from word onset): ${config.timing.response_timeout}ms\n`;
        content += `Delay after Response: ${config.timing.iti}ms\n`;
        content += `Practice Feedback Duration: ${config.timing.error_display_duration}ms\n`;
        content += `Audio Volume: ${config.audio.volume}\n`;
        content += `Audio Output: ${this.describeTrialAudio()}\n`;
        if (this.missingAudio.length) {
            content += `WARNING: ${this.missingAudio.length} stimulus recordings were missing and replaced by placeholder tones: ${this.missingAudio.join(', ')}\n`;
        }
        content += '\n';

        // Stroop analysis
        content += 'STROOP RESULTS (main trials only)\n';
        content += '-'.repeat(60) + '\n';
        content += 'RTs from correct trials, measured from word onset; responses slower\n';
        content += `than ${config.timing.response_timeout}ms count as incorrect; RTs > 2 SD from each condition\n`;
        content += 'mean removed. Interference = incongruent RT - neutral RT.\n\n';
        content += 'Condition    | Trials | Correct | Accuracy | No-resp | Mean RT | SD     | RTs used | Trimmed\n';
        content += '-'.repeat(95) + '\n';
        for (const condition of ['congruent', 'neutral', 'incongruent']) {
            const c = summary.conditions[condition];
            content += `${condition.padEnd(12)} | ${String(c.total).padStart(6)} | ${String(c.correct).padStart(7)} | ${fmtPct(c.accuracy).padStart(8)} | ${String(c.timeouts).padStart(7)} | ${fmtMs(c.meanRT).padStart(7)} | ${fmtMs(c.sdRT).padStart(6)} | ${String(c.nCorrectRTs - c.nTrimmed).padStart(8)} | ${String(c.nTrimmed).padStart(7)}\n`;
        }
        content += `\nStroop Interference (incongruent - neutral): ${fmtMs(summary.interference)}ms\n`;
        const cg = summary.conditions.congruent.meanRT;
        const nt = summary.conditions.neutral.meanRT;
        content += `Facilitation (neutral - congruent): ${(cg !== null && nt !== null) ? fmtMs(nt - cg) : 'N/A'}ms\n\n`;
        
        // Performance Summary
        content += 'PERFORMANCE SUMMARY\n';
        content += '-'.repeat(30) + '\n';
        content += `Main Trials Completed: ${summary.totalTrials}\n`;
        content += `Number Correct: ${summary.correctResponses}\n`;
        content += `Accuracy: ${(summary.accuracy * 100).toFixed(1)}%\n`;
        content += `Average Reaction Time (untrimmed, responded trials): ${summary.meanRT.toFixed(0)}ms\n\n`;
        
        // Phase breakdown
        const practiceResults = this.results.filter(r => r.phase === 'practice');
        const mainResults = this.results.filter(r => r.phase === 'main');
        
        content += 'PHASE BREAKDOWN\n';
        content += '-'.repeat(30) + '\n';
        
        for (const [label, phaseResults] of [['Practice Phase', practiceResults], ['Main Phase', mainResults]]) {
            if (!phaseResults.length) continue;
            const phaseCorrect = phaseResults.filter(r => r.accuracy === 1).length;
            const validRTs = phaseResults.filter(r => !r.timed_out && r.reaction_time !== null);
            const phaseMeanRT = validRTs.length > 0 ?
                validRTs.reduce((sum, r) => sum + r.reaction_time, 0) / validRTs.length : 0;
            content += `${label}:\n`;
            content += `  Trials: ${phaseResults.length}\n`;
            content += `  Correct: ${phaseCorrect}\n`;
            content += `  Accuracy: ${(phaseCorrect / phaseResults.length * 100).toFixed(1)}%\n`;
            content += `  Mean RT (untrimmed): ${phaseMeanRT.toFixed(0)}ms\n\n`;
        }
        
        // Detailed Trial Data
        content += 'DETAILED TRIAL DATA\n';
        content += '-'.repeat(80) + '\n';
        content += 'Trial | Phase    | Stimulus   | Voice  | Word   | Condition   | Correct | Response | RT(ms) | Accurate | Outlier\n';
        content += '-'.repeat(110) + '\n';
        
        for (const trial of this.results) {
            const trialNum = trial.global_trial.toString().padStart(5);
            const phase = trial.phase.padEnd(8);
            const stimulus = trial.stimulus_file.padEnd(10);
            const voice = trial.voice_gender.padEnd(6);
            const word = trial.word.padEnd(6);
            const condition = trial.condition.padEnd(11);
            const correct = trial.correct_response.padEnd(7);
            const response = (trial.timed_out ? 'TIMEOUT' : trial.participant_response).padEnd(8);
            const rt = (trial.reaction_time === null ? 'N/A' : trial.reaction_time.toString()).padStart(6);
            const accurate = (trial.accuracy === 1 ? 'YES' : 'NO').padEnd(8);
            const outlier = trial.rt_outlier ? 'YES' : '';
            
            content += `${trialNum} | ${phase} | ${stimulus} | ${voice} | ${word} | ${condition} | ${correct} | ${response} | ${rt} | ${accurate} | ${outlier}\n`;
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

    exitTask() {
        // A finished run whose results haven't been saved yet is saved on
        // the way out (Save Results & Exit) rather than thrown away.
        if (this.taskState === 'completed') {
            if (!this.savingResults) this.saveResults();
            return;
        }
        if (this.taskState === 'running') {
            if (!confirm('Are you sure you want to exit? All progress will be lost.')) {
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
window.auditoryStroopPopup = new AuditoryStroopPopup();
window.loadAuditoryStroopTask = async (participantId) => {
    // A fresh object per run, so nothing (trials, results folder, audio
    // check, flags) carries over from a previous run or participant.
    if (window.auditoryStroopPopup && window.auditoryStroopPopup.isOpen) return;
    window.auditoryStroopPopup = new AuditoryStroopPopup();
    await window.auditoryStroopPopup.loadTask(participantId);
};
