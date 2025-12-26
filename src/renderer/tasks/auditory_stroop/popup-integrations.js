// Auditory Stroop Task Popup Integration
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
        this.stimuli = {};
        this.startTime = null;
        this.responseStartTime = null;
        this.isPaused = false;
        this.taskState = 'ready';
    }

    async loadTask(participantId) {
        if (this.isOpen) return;
        
        this.participantId = participantId;
        await this.loadConfiguration();
        await this.initializeAudioContext();
        await this.loadStimuli();
        this.setupStimuli();
        this.openTaskPopup();
    }

    async loadConfiguration() {
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
            this.config = JSON.parse(configData);
        } catch (error) {
            console.log('No configuration found, using defaults');
            this.config = this.getDefaultConfig();
        }
    }

    getDefaultConfig() {
        return {
            task: 'auditory-stroop',
            parameters: {
                trials: {
                    practice: 8,
                    main: 20
                },
                timing: {
                    iti: 1200,
                    pre_stimulus_delay: 750,
                    response_timeout: 2500,
                    error_display_duration: 1000
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

    async loadStimuli() {
        // Define stimuli structure based on actual audio files
        this.stimuli = {
            practice: [
                // Use a subset for practice
                { file: 'daad1M2.wav', voice: 'male', word: 'daad', correct_response: 'M' },
                { file: 'daad2F1.wav', voice: 'female', word: 'daad', correct_response: 'F' },
                { file: 'maam1F2.wav', voice: 'female', word: 'maam', correct_response: 'F' },
                { file: 'maam1M1.wav', voice: 'male', word: 'maam', correct_response: 'M' }
            ],
            main: [
                // All available audio files for main task
                { file: 'daad1M2.wav', voice: 'male', word: 'daad', correct_response: 'M' },
                { file: 'daad2F1.wav', voice: 'female', word: 'daad', correct_response: 'F' },
                { file: 'maam1F2.wav', voice: 'female', word: 'maam', correct_response: 'F' },
                { file: 'maam1M1.wav', voice: 'male', word: 'maam', correct_response: 'M' },
                { file: 'nooz1F1.wav', voice: 'female', word: 'nooz', correct_response: 'F' },
                { file: 'nooz2M2.wav', voice: 'male', word: 'nooz', correct_response: 'M' }
            ]
        };

        // Load actual audio files
        await this.loadAudioFiles();
    }

    async loadAudioFiles() {
        const path = window.require('path');
        const fs = window.require('fs');
        const { app } = window.require('@electron/remote') || window.require('electron').remote;
        
        // Use app.getAppPath() to get the correct resource path in packaged app
        const appPath = app.getAppPath();
        const audioDir = path.join(appPath, 'src', 'renderer', 'tasks', 'auditory_stroop', 'audio');
        
        console.log('Loading audio files from:', audioDir);
        
        for (const [phase, stimuli] of Object.entries(this.stimuli)) {
            for (const stimulus of stimuli) {
                const audioPath = path.join(audioDir, stimulus.file);
                
                try {
                    if (fs.existsSync(audioPath)) {
                        await this.loadAudioBuffer(audioPath, stimulus.file);
                        console.log(`Loaded audio file: ${stimulus.file}`);
                    } else {
                        console.warn(`Audio file not found: ${audioPath}`);
                        this.audioBuffers[stimulus.file] = await this.createFallbackAudio(stimulus);
                    }
                } catch (error) {
                    console.error(`Error loading audio file ${stimulus.file}:`, error);
                    this.audioBuffers[stimulus.file] = await this.createFallbackAudio(stimulus);
                }
            }
        }
    }

    async loadAudioBuffer(filePath, filename) {
        const fs = window.require('fs').promises;
        
        try {
            const audioData = await fs.readFile(filePath);
            const arrayBuffer = audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength);
            
            if (this.audioContext) {
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                this.audioBuffers[filename] = audioBuffer;
            }
        } catch (error) {
            console.error(`Failed to load audio buffer for ${filename}:`, error);
            this.audioBuffers[filename] = await this.createFallbackAudio({file: filename});
        }
    }

    async createFallbackAudio(stimulus) {
        if (!this.audioContext) return null;
        
        const duration = 0.8;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        
        // Determine voice gender from filename pattern
        let frequency;
        if (stimulus.file && (stimulus.file.includes('M1.wav') || stimulus.file.includes('M2.wav'))) {
            frequency = 120; // Male voice - lower frequency
        } else if (stimulus.file && (stimulus.file.includes('F1.wav') || stimulus.file.includes('F2.wav'))) {
            frequency = 250; // Female voice - higher frequency
        } else {
            // Fallback based on voice property
            frequency = stimulus.voice === 'male' ? 120 : 250;
        }
        
        // Generate sine wave
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
            if (i > data.length * 0.8) {
                data[i] *= (data.length - i) / (data.length * 0.2);
            }
        }
        
        return buffer;
    }

    setupStimuli() {
        // Randomize stimuli for each phase
        this.practiceStimuli = this.randomizeStimuli('practice', this.config.parameters.trials.practice);
        this.mainStimuli = this.randomizeStimuli('main', this.config.parameters.trials.main);
    }

    randomizeStimuli(phase, count) {
        const available = [...this.stimuli[phase]];
        const selected = [];
        
        for (let i = 0; i < count; i++) {
            if (available.length === 0) {
                available.push(...this.stimuli[phase]);
            }
            const randomIndex = Math.floor(Math.random() * available.length);
            selected.push(available.splice(randomIndex, 1)[0]);
        }
        
        return selected;
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
                    align-items: center;
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
                <p>You will hear words spoken in either a male or female voice. Your task is to identify the voice gender, ignoring the meaning of the word. The task has a practice phase and a main phase.</p>
                
                <div class="audio-test-section">
                    <button id="test-audio-btn" class="task-button task-button-secondary">
                        🔊 Test Audio
                    </button>
                    <p class="audio-caption">Click to check your audio is working</p>
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
        const testBtn = document.getElementById('test-audio-btn');
        const originalText = testBtn.textContent;
        
        testBtn.textContent = '🔊 Playing...';
        testBtn.disabled = true;
        
        try {
            await this.playTestTone();
            testBtn.textContent = '✅ Audio OK';
            setTimeout(() => {
                testBtn.textContent = originalText;
                testBtn.disabled = false;
            }, 2000);
        } catch (error) {
            testBtn.textContent = '❌ Audio Error';
            console.error('Audio test failed:', error);
            setTimeout(() => {
                testBtn.textContent = originalText;
                testBtn.disabled = false;
            }, 2000);
        }
    }

    async playTestTone() {
        if (!this.audioContext) {
            throw new Error('Audio context not available');
        }

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = 440;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.config.parameters.audio.volume * 0.3, this.audioContext.currentTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.5);
        
        return new Promise(resolve => {
            oscillator.onended = resolve;
        });
    }

    startPracticePhase() {
        this.currentPhase = 'practice';
        this.currentTrial = 0;
        this.taskState = 'running';
        this.startTime = new Date();
        
        // Enable pause button
        document.getElementById('pause-task-btn').disabled = false;
        
        this.showPracticeInstructions();
    }

    showPracticeInstructions() {
        const taskStage = document.getElementById('task-stage');
        const progressDisplay = document.getElementById('progress-display');
        
        progressDisplay.textContent = 'Phase 1 of 2: Practice – Auditory Stroop';
        
        taskStage.innerHTML = `
            <div class="instructions-screen">
                <h3>Practice: Auditory Stroop</h3>
                <p>In this practice, you will hear a word spoken in a male or female voice. Identify the voice gender.</p>
                <p><strong>Click M for Male voices.<br>Click F for Female voices.</strong></p>
                <p>You will receive feedback during practice.</p>
                
                <div class="response-buttons-preview">
                    <div class="preview-button">M</div>
                    <div class="preview-button">F</div>
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
        
        progressDisplay.textContent = 'Phase 2 of 2: Main – Auditory Stroop';
        
        taskStage.innerHTML = `
            <div class="instructions-screen">
                <h3>Main Task: Auditory Stroop</h3>
                <p>Now for the main task. You will again hear words spoken in a male or female voice. Identify the voice gender, ignoring the word meaning.</p>
                <p><strong>Click M for Male voices.<br>Click F for Female voices.</strong></p>
                <p>Respond as quickly and accurately as possible. No feedback will be provided in this phase.</p>
                
                <div class="response-buttons-preview">
                    <div class="preview-button">M</div>
                    <div class="preview-button">F</div>
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
        
        for (this.currentTrial = 0; this.currentTrial < stimuli.length; this.currentTrial++) {
            if (this.taskState === 'stopped') break;
            
            while (this.isPaused) {
                await this.wait(100);
            }
            
            await this.runSingleTrial(phase, stimuli[this.currentTrial]);
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
        
        // Fixation cross
        taskStage.innerHTML = '<div class="fixation-cross">+</div>';
        await this.wait(this.config.parameters.timing.pre_stimulus_delay);
        
        // Present stimulus with response buttons
        taskStage.innerHTML = `
            <div class="stimulus-display">
                <div class="stimulus-icon">🔊</div>
                <div class="stimulus-text">Listen carefully...</div>
                <div class="response-buttons">
                    <button class="response-button" data-response="M">M</button>
                    <button class="response-button" data-response="F">F</button>
                </div>
            </div>
        `;
        
        // Play audio stimulus
        await this.playStimulus(stimulus);
        
        // Start response timing
        this.responseStartTime = Date.now();
        
        // Collect response
        const response = await this.collectResponse();
        
        // Record trial result
        const trialResult = {
            phase: phase,
            trial: trialNum,
            global_trial: this.results.length + 1,
            stimulus_file: stimulus.file,
            voice_gender: stimulus.voice,
            word: stimulus.word,
            correct_response: stimulus.correct_response,
            participant_response: response.response,
            reaction_time: response.time,
            accuracy: response.response === stimulus.correct_response ? 1 : 0,
            timestamp: new Date().toISOString()
        };
        
        this.results.push(trialResult);
        
        // Show feedback for practice trials or errors
        if (phase === 'practice' || response.response === 'timeout') {
            await this.showFeedback(trialResult, phase);
        }
        
        // Inter-trial interval
        taskStage.innerHTML = '';
        await this.wait(this.config.parameters.timing.iti);
    }

    async playStimulus(stimulus) {
        try {
            if (this.audioContext && this.audioBuffers[stimulus.file]) {
                const source = this.audioContext.createBufferSource();
                const gainNode = this.audioContext.createGain();
                
                source.buffer = this.audioBuffers[stimulus.file];
                source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                gainNode.gain.value = this.config.parameters.audio.volume;
                
                source.start(this.audioContext.currentTime);
                
                return new Promise(resolve => {
                    source.onended = resolve;
                });
            } else {
                console.warn(`No audio buffer for ${stimulus.file}, using silence`);
                await this.wait(800); // Simulate audio duration
            }
        } catch (error) {
            console.error('Error playing stimulus:', error);
            await this.wait(800); // Fallback duration
        }
    }

    async collectResponse() {
        return new Promise(resolve => {
            const responseButtons = document.querySelectorAll('.response-button');
            let responded = false;
            
            const timeout = setTimeout(() => {
                if (!responded) {
                    responded = true;
                    responseButtons.forEach(btn => btn.removeEventListener('click', handleClick));
                    resolve({
                        response: 'timeout',
                        time: this.config.parameters.timing.response_timeout
                    });
                }
            }, this.config.parameters.timing.response_timeout);
            
            const handleClick = (e) => {
                if (!responded) {
                    responded = true;
                    clearTimeout(timeout);
                    
                    // Visual feedback
                    e.target.classList.add('clicked');
                    
                    const response = e.target.dataset.response;
                    const reactionTime = Date.now() - this.responseStartTime;
                    
                    responseButtons.forEach(btn => btn.removeEventListener('click', handleClick));
                    
                    resolve({
                        response: response,
                        time: reactionTime
                    });
                }
            };
            
            responseButtons.forEach(btn => {
                btn.addEventListener('click', handleClick);
            });
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
        } else if (phase === 'practice') {
            if (trialResult.accuracy === 1) {
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
        }
        
        if (feedbackHTML) {
            taskStage.innerHTML = feedbackHTML;
            await this.wait(this.config.parameters.timing.error_display_duration);
        }
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
        
        // Calculate summary statistics
        const summary = this.calculateSummary();
        
        taskStage.innerHTML = `
            <div class="task-complete">
                <h3>Task Complete! 🎉</h3>
                <div class="summary">
                    <h4>End of Block Summary</h4>
                    <p><strong>Number correct:</strong> ${summary.correctResponses}</p>
                    <p><strong>Accuracy:</strong> ${(summary.accuracy * 100).toFixed(1)}%</p>
                    <p><strong>Average reaction time:</strong> ${summary.meanRT.toFixed(0)}ms</p>
                </div>
                <button id="save-results-btn" class="task-button task-button-primary">
                    Save Results & Exit
                </button>
            </div>
        `;
        
        progressDisplay.textContent = 'Task completed successfully';
        document.getElementById('pause-task-btn').disabled = true;
        
        document.getElementById('save-results-btn').addEventListener('click', () => {
            this.saveResults();
        });
    }

    calculateSummary() {
        const validResponses = this.results.filter(r => r.participant_response !== 'timeout');
        const correctResponses = this.results.filter(r => r.accuracy === 1).length;
        
        return {
            totalTrials: this.results.length,
            correctResponses: correctResponses,
            accuracy: correctResponses / this.results.length,
            meanRT: validResponses.length > 0 ? 
                validResponses.reduce((sum, r) => sum + r.reaction_time, 0) / validResponses.length : 0
        };
    }

    async saveResults() {
        try {
            await this.saveResultsToFile();
            window.dashboard?.showToast('Task results saved successfully', 'success');
            
            setTimeout(() => {
                this.closeTaskPopup();
            }, 1500);
            
        } catch (error) {
            console.error('Error saving results:', error);
            window.dashboard?.showToast('Failed to save results', 'error');
        }
    }

    async saveResultsToFile() {
        const os = window.require('os');
        const path = window.require('path');
        const fs = window.require('fs').promises;
        
        // Get platform-specific sessions directory
        let baseDir;
        if (process.platform === 'win32') {
            baseDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Oats', 'sessions');
        } else if (process.platform === 'darwin') {
            baseDir = path.join(os.homedir(), 'Documents', 'Oats', 'sessions');
        } else {
            baseDir = path.join(os.homedir(), 'Documents', 'Oats', 'sessions');
        }
        
        // Create participant folder
        const participantDir = path.join(baseDir, this.participantId);
        await fs.mkdir(participantDir, { recursive: true });
        
        // Create ast_timestamp folder
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
        const taskDir = path.join(participantDir, `ast_${timestamp}`);
        await fs.mkdir(taskDir, { recursive: true });
        
        // Generate text file content
        const textContent = this.generateResultsTextContent();
        
        // Save as text file
        const filePath = path.join(taskDir, 'results.txt');
        await fs.writeFile(filePath, textContent, 'utf8');
        
        console.log(`Results saved to: ${filePath}`);
    }

    generateResultsTextContent() {
        const summary = this.calculateSummary();
        const startTime = this.startTime ? this.startTime.toLocaleString() : 'Unknown';
        const endTime = new Date().toLocaleString();
        
        let content = '';
        
        // Header
        content += '='.repeat(60) + '\n';
        content += '              AUDITORY STROOP TASK RESULTS\n';
        content += '='.repeat(60) + '\n\n';
        
        // Session Information
        content += 'SESSION INFORMATION\n';
        content += '-'.repeat(30) + '\n';
        content += `Participant ID: ${this.participantId}\n`;
        content += `Task: Auditory Stroop Task\n`;
        content += `Start Time: ${startTime}\n`;
        content += `End Time: ${endTime}\n`;
        content += `Total Duration: ${this.calculateDuration()}\n\n`;
        
        // Configuration
        content += 'TASK CONFIGURATION\n';
        content += '-'.repeat(30) + '\n';
        const config = this.config.parameters;
        content += `Practice Trials: ${config.trials.practice}\n`;
        content += `Main Trials: ${config.trials.main}\n`;
        content += `Inter-trial Interval: ${config.timing.iti}ms\n`;
        content += `Pre-stimulus Delay: ${config.timing.pre_stimulus_delay}ms\n`;
        content += `Response Timeout: ${config.timing.response_timeout}ms\n`;
        content += `Error Display Duration: ${config.timing.error_display_duration}ms\n`;
        content += `Audio Volume: ${config.audio.volume}\n\n`;
        
        // Performance Summary
        content += 'PERFORMANCE SUMMARY\n';
        content += '-'.repeat(30) + '\n';
        content += `Total Trials Completed: ${summary.totalTrials}\n`;
        content += `Number Correct: ${summary.correctResponses}\n`;
        content += `Accuracy: ${(summary.accuracy * 100).toFixed(1)}%\n`;
        content += `Average Reaction Time: ${summary.meanRT.toFixed(0)}ms\n\n`;
        
        // Phase breakdown
        const practiceResults = this.results.filter(r => r.phase === 'practice');
        const mainResults = this.results.filter(r => r.phase === 'main');
        
        content += 'PHASE BREAKDOWN\n';
        content += '-'.repeat(30) + '\n';
        
        if (practiceResults.length > 0) {
            const practiceCorrect = practiceResults.filter(r => r.accuracy === 1).length;
            const practiceAccuracy = practiceCorrect / practiceResults.length;
            const practiceValidRTs = practiceResults.filter(r => r.participant_response !== 'timeout');
            const practiceMeanRT = practiceValidRTs.length > 0 ? 
                practiceValidRTs.reduce((sum, r) => sum + r.reaction_time, 0) / practiceValidRTs.length : 0;
            
            content += `Practice Phase:\n`;
            content += `  Trials: ${practiceResults.length}\n`;
            content += `  Correct: ${practiceCorrect}\n`;
            content += `  Accuracy: ${(practiceAccuracy * 100).toFixed(1)}%\n`;
            content += `  Mean RT: ${practiceMeanRT.toFixed(0)}ms\n\n`;
        }
        
        if (mainResults.length > 0) {
            const mainCorrect = mainResults.filter(r => r.accuracy === 1).length;
            const mainAccuracy = mainCorrect / mainResults.length;
            const mainValidRTs = mainResults.filter(r => r.participant_response !== 'timeout');
            const mainMeanRT = mainValidRTs.length > 0 ? 
                mainValidRTs.reduce((sum, r) => sum + r.reaction_time, 0) / mainValidRTs.length : 0;
            
            content += `Main Phase:\n`;
            content += `  Trials: ${mainResults.length}\n`;
            content += `  Correct: ${mainCorrect}\n`;
            content += `  Accuracy: ${(mainAccuracy * 100).toFixed(1)}%\n`;
            content += `  Mean RT: ${mainMeanRT.toFixed(0)}ms\n\n`;
        }
        
        // Detailed Trial Data
        content += 'DETAILED TRIAL DATA\n';
        content += '-'.repeat(80) + '\n';
        content += 'Trial | Phase    | Stimulus      | Voice  | Word   | Correct | Response | RT(ms) | Accurate\n';
        content += '-'.repeat(90) + '\n';
        
        for (const trial of this.results) {
            const trialNum = trial.global_trial.toString().padStart(5);
            const phase = trial.phase.padEnd(8);
            const stimulus = trial.stimulus_file.padEnd(13);
            const voice = trial.voice_gender.padEnd(6);
            const word = trial.word.padEnd(6);
            const correct = trial.correct_response.padEnd(7);
            const response = (trial.participant_response === 'timeout' ? 'TIMEOUT' : trial.participant_response).padEnd(8);
            const rt = (trial.participant_response === 'timeout' ? 'N/A' : trial.reaction_time.toString()).padStart(6);
            const accurate = trial.accuracy === 1 ? 'YES' : 'NO';
            
            content += `${trialNum} | ${phase} | ${stimulus} | ${voice} | ${word} | ${correct} | ${response} | ${rt} | ${accurate}\n`;
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
        if (this.taskState === 'running') {
            if (!confirm('Are you sure you want to exit? All progress will be lost.')) {
                return;
            }
        }
        this.taskState = 'stopped';
        this.closeTaskPopup();
    }

    closeTaskPopup() {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.remove('open', 'task-modal');
            modalOverlay.setAttribute('aria-hidden', 'true');
            this.isOpen = false;
            this.taskState = 'stopped';
            
            setTimeout(() => {
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
    await window.auditoryStroopPopup.loadTask(participantId);
};