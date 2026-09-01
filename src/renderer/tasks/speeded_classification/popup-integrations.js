// Speeded Classification Task Popup Integration with Onscreen Buttons and Audio
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
        this.stimuli = {};
        this.audioBuffers = {};
        this.audioFilePaths = {};
        this.asioEngine = null;
        this.responseStartTime = null;
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
            this.config = JSON.parse(configData);
        } catch (error) {
            console.log('No configuration found, using defaults');
            this.config = this.getDefaultConfig();
        }
    }

    getDefaultConfig() {
        return {
            task: 'speeded-classification',
            parameters: {
                trials: {
                    practice_phoneme: 1,
                    practice_voice: 1,
                    main_phoneme: 2,
                    main_voice: 2
                },
                timing: {
                    iti: 1000,
                    pre_stimulus_delay: 1500,
                    response_timeout: 10000,
                    error_display_duration: 2000
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
        // Define stimuli with paths to audio files
        this.stimuli = {
            phoneme: {
                practice: [
                    { file: 'ba_practice.wav', category: 'ba', correct_response: 'B' },
                    { file: 'pa_practice.wav', category: 'pa', correct_response: 'P' }
                ],
                main: [
                    { file: 'ba_1.wav', category: 'ba', correct_response: 'B' },
                    { file: 'pa_1.wav', category: 'pa', correct_response: 'P' },
                    { file: 'ba_2.wav', category: 'ba', correct_response: 'B' },
                    { file: 'pa_2.wav', category: 'pa', correct_response: 'P' }
                ]
            },
            voice: {
                practice: [
                    { file: 'male_practice.wav', category: 'male', correct_response: 'Male' },
                    { file: 'female_practice.wav', category: 'female', correct_response: 'Female' }
                ],
                main: [
                    { file: 'male_1.wav', category: 'male', correct_response: 'Male' },
                    { file: 'female_1.wav', category: 'female', correct_response: 'Female' },
                    { file: 'male_2.wav', category: 'male', correct_response: 'Male' },
                    { file: 'female_2.wav', category: 'female', correct_response: 'Female' }
                ]
            }
        };

        // Attempt to load actual audio files
        await this.loadAudioFiles();
    }

    async loadAudioFiles() {
        const path = window.require('path');
        const fs = window.require('fs');
        const { app } = window.require('@electron/remote') || window.require('electron').remote;
        
        // Use app.getAppPath() to get the correct resource path in packaged app
        const appPath = app.getAppPath();
        const audioDir = path.join(appPath, 'src', 'renderer', 'tasks', 'speeded_classification', 'audio');
        
        console.log('Loading audio files from:', audioDir);
        
        for (const [type, phases] of Object.entries(this.stimuli)) {
            for (const [phase, stimuli] of Object.entries(phases)) {
                for (const stimulus of stimuli) {
                    const audioPath = path.join(audioDir, stimulus.file);
                    
                    try {
                        // Check if file exists
                        if (fs.existsSync(audioPath)) {
                            this.audioFilePaths[stimulus.file] = audioPath;
                            await this.loadAudioBuffer(audioPath, stimulus.file);
                            console.log(`Loaded audio file: ${stimulus.file}`);
                        } else {
                            console.warn(`Audio file not found: ${audioPath}`);
                            // Create a fallback tone for missing files
                            this.audioBuffers[stimulus.file] = await this.createFallbackAudio(stimulus);
                        }
                    } catch (error) {
                        console.error(`Error loading audio file ${stimulus.file}:`, error);
                        this.audioBuffers[stimulus.file] = await this.createFallbackAudio(stimulus);
                    }
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
        
        // Create different tones for different stimuli
        const duration = 0.5;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        
        // Different frequencies for different categories
        let frequency = 440; // Default A note
        if (stimulus.category === 'ba' || stimulus.category === 'male') {
            frequency = 220; // Lower tone
        } else if (stimulus.category === 'pa' || stimulus.category === 'female') {
            frequency = 880; // Higher tone
        }
        
        // Generate sine wave
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
            // Apply fade out to avoid clicks
            if (i > data.length * 0.8) {
                data[i] *= (data.length - i) / (data.length * 0.2);
            }
        }
        
        return buffer;
    }

    setupExperimentalPhases() {
        const trialParams = this.config.parameters.trials;
        
        this.phases = [
            {
                name: 'practice_phoneme',
                type: 'phoneme',
                isPractice: true,
                trialCount: trialParams.practice_phoneme,
                title: 'Practice: Phoneme Classification',
                instructions: 'Listen to each sound and classify it by clicking the buttons below.\n\nClick "B" for /ba/ sounds\nClick "P" for /pa/ sounds\n\nYou will receive feedback during practice.',
                responseButtons: [
                    { label: 'B', value: 'B', description: '/ba/ sound' },
                    { label: 'P', value: 'P', description: '/pa/ sound' }
                ],
                stimuli: this.getRandomizedStimuli('phoneme', 'practice', trialParams.practice_phoneme)
            },
            {
                name: 'practice_voice',
                type: 'voice', 
                isPractice: true,
                trialCount: trialParams.practice_voice,
                title: 'Practice: Voice Classification',
                instructions: 'Listen to each voice and classify it by clicking the buttons below.\n\nClick "Male" for male voices\nClick "Female" for female voices\n\nYou will receive feedback during practice.',
                responseButtons: [
                    { label: 'Male', value: 'Male', description: 'Male voice' },
                    { label: 'Female', value: 'Female', description: 'Female voice' }
                ],
                stimuli: this.getRandomizedStimuli('voice', 'practice', trialParams.practice_voice)
            },
            {
                name: 'main_phoneme',
                type: 'phoneme',
                isPractice: false,
                trialCount: trialParams.main_phoneme,
                title: 'Main Task: Phoneme Classification',
                instructions: 'Now for the main task. Listen to each sound and classify it by clicking the buttons below.\n\nClick "B" for /ba/ sounds\nClick "P" for /pa/ sounds\n\nRespond as quickly and accurately as possible.\nNo feedback will be provided.',
                responseButtons: [
                    { label: 'B', value: 'B', description: '/ba/ sound' },
                    { label: 'P', value: 'P', description: '/pa/ sound' }
                ],
                stimuli: this.getRandomizedStimuli('phoneme', 'main', trialParams.main_phoneme)
            },
            {
                name: 'main_voice',
                type: 'voice',
                isPractice: false,
                trialCount: trialParams.main_voice,
                title: 'Main Task: Voice Classification', 
                instructions: 'Final task. Listen to each voice and classify it by clicking the buttons below.\n\nClick "Male" for male voices\nClick "Female" for female voices\n\nRespond as quickly and accurately as possible.\nNo feedback will be provided.',
                responseButtons: [
                    { label: 'Male', value: 'Male', description: 'Male voice' },
                    { label: 'Female', value: 'Female', description: 'Female voice' }
                ],
                stimuli: this.getRandomizedStimuli('voice', 'main', trialParams.main_voice)
            }
        ];

        // Remove phases with 0 trials
        this.phases = this.phases.filter(phase => phase.trialCount > 0);
    }

    getRandomizedStimuli(type, phase, count) {
        const available = [...this.stimuli[type][phase]];
        const selected = [];
        
        for (let i = 0; i < count; i++) {
            if (available.length === 0) {
                // Replenish if we need more trials than available stimuli
                available.push(...this.stimuli[type][phase]);
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
                        <p>This task consists of ${this.phases.length} phases with a total of ${totalTrials} trials.</p>
                        <p>You will classify audio stimuli as quickly and accurately as possible using onscreen buttons.</p>
                        <div class="audio-test">
                            <button id="audio-test-btn" class="task-button task-button-secondary">
                                🔊 Test Audio
                            </button>
                            <p style="font-size: 14px; color: #6e6e73; margin-top: 8px;">
                                Click to test your audio is working
                            </p>
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

                .task-welcome, .phase-instructions {
                    text-align: center;
                    max-width: 600px;
                    padding: 40px;
                }

                .audio-test {
                    margin: 20px 0;
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

    async testAudio() {
        const testBtn = document.getElementById('audio-test-btn');
        const originalText = testBtn.textContent;
        
        testBtn.textContent = '🔊 Playing...';
        testBtn.disabled = true;
        
        try {
            // Play a test tone
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
        this.taskState = 'running';
        this.startTime = new Date();
        
        document.getElementById('begin-task-btn').style.display = 'none';
        document.getElementById('pause-task-btn').disabled = false;
        
        await this.runExperiment();
    }

    async runExperiment() {
        for (this.currentPhaseIndex = 0; this.currentPhaseIndex < this.phases.length; this.currentPhaseIndex++) {
            if (this.taskState === 'stopped') break;
            
            this.currentPhase = this.phases[this.currentPhaseIndex];
            
            // Show phase instructions
            await this.showPhaseInstructions();
            
            // Run trials for this phase
            for (this.currentTrialInPhase = 0; this.currentTrialInPhase < this.currentPhase.trialCount; this.currentTrialInPhase++) {
                if (this.taskState === 'stopped') break;
                
                while (this.isPaused) {
                    await this.wait(100);
                }
                
                await this.runSingleTrial();
                this.totalTrialsCompleted++;
            }
        }
        
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
                        `<div class="preview-button">${button.label}</div>`
                    ).join('')}
                </div>
                <button id="start-phase-btn" class="task-button task-button-primary">
                    Start ${this.currentPhase.isPractice ? 'Practice' : 'Main Task'}
                </button>
            </div>
        `;
        
        return new Promise(resolve => {
            document.getElementById('start-phase-btn').addEventListener('click', resolve);
        });
    }

    async runSingleTrial() {
        const taskStage = document.getElementById('task-stage');
        const progressDisplay = document.getElementById('progress-display');
        const stimulus = this.currentPhase.stimuli[this.currentTrialInPhase];
        
        const trialNumber = this.totalTrialsCompleted + 1;
        const totalTrials = this.phases.reduce((sum, phase) => sum + phase.trialCount, 0);
        
        progressDisplay.textContent = `Trial ${trialNumber} of ${totalTrials} (${this.currentPhase.title})`;
        
        // Fixation cross
        taskStage.innerHTML = '<div class="fixation-cross">+</div>';
        await this.wait(this.config.parameters.timing.pre_stimulus_delay);
        
        // Present stimulus with response buttons
        taskStage.innerHTML = `
            <div class="stimulus-display">
                <div class="stimulus-icon">${this.currentPhase.type === 'phoneme' ? '🔊' : '👤'}</div>
                <div class="stimulus-text">Listen carefully...</div>
                <div class="response-buttons">
                    ${this.currentPhase.responseButtons.map(button => 
                        `<button class="response-button" data-response="${button.value}">
                            ${button.label}
                        </button>`
                    ).join('')}
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
            phase: this.currentPhase.name,
            trial_in_phase: this.currentTrialInPhase + 1,
            global_trial: trialNumber,
            stimulus: stimulus.file,
            correct_response: stimulus.correct_response,
            participant_response: response.response,
            reaction_time: response.time,
            accuracy: response.response === stimulus.correct_response ? 1 : 0,
            stimulus_category: stimulus.category,
            timestamp: new Date().toISOString()
        };
        
        this.results.push(trialResult);
        
        // Show feedback for practice trials
        if (this.currentPhase.isPractice) {
            await this.showFeedback(trialResult);
        }
        
        // Inter-trial interval
        taskStage.innerHTML = '';
        await this.wait(this.config.parameters.timing.iti);
    }

    async playStimulus(stimulus) {
        try {
            if (this.asioEngine && this.asioEngine.isEnabled() && this.audioFilePaths[stimulus.file]) {
                await this.asioEngine.playFile(this.audioFilePaths[stimulus.file], this.config.parameters.audio.volume);
                return;
            }

            if (this.audioContext && this.audioBuffers[stimulus.file]) {
                const source = this.audioContext.createBufferSource();
                const gainNode = this.audioContext.createGain();
                
                source.buffer = this.audioBuffers[stimulus.file];
                source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                gainNode.gain.value = this.config.parameters.audio.volume;
                
                source.start(this.audioContext.currentTime);
                
                // Wait for audio to finish
                return new Promise(resolve => {
                    source.onended = resolve;
                });
            } else {
                console.warn(`No audio buffer for ${stimulus.file}, using silence`);
                await this.wait(500); // Simulate audio duration
            }
        } catch (error) {
            console.error('Error playing stimulus:', error);
            await this.wait(500); // Fallback duration
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
                    <div>The correct answer was: ${trialResult.correct_response}</div>
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
        
        // Calculate summary statistics
        const summary = this.calculateSummary();
        
        taskStage.innerHTML = `
            <div class="task-complete">
                <h3>Task Complete! 🎉</h3>
                <div class="summary">
                    <h4>Performance Summary</h4>
                    <p><strong>Total Trials:</strong> ${summary.totalTrials}</p>
                    <p><strong>Overall Accuracy:</strong> ${(summary.overallAccuracy * 100).toFixed(1)}%</p>
                    <p><strong>Mean Response Time:</strong> ${summary.meanRT.toFixed(0)}ms</p>
                    <p><strong>Practice Accuracy:</strong> ${(summary.practiceAccuracy * 100).toFixed(1)}%</p>
                    <p><strong>Main Task Accuracy:</strong> ${(summary.mainAccuracy * 100).toFixed(1)}%</p>
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
        const practiceTrials = this.results.filter(r => r.phase.includes('practice'));
        const mainTrials = this.results.filter(r => !r.phase.includes('practice'));
        
        return {
            totalTrials: this.results.length,
            overallAccuracy: this.results.reduce((sum, r) => sum + r.accuracy, 0) / this.results.length,
            meanRT: validResponses.reduce((sum, r) => sum + r.reaction_time, 0) / validResponses.length,
            practiceAccuracy: practiceTrials.length > 0 ? 
                practiceTrials.reduce((sum, r) => sum + r.accuracy, 0) / practiceTrials.length : 0,
            mainAccuracy: mainTrials.length > 0 ? 
                mainTrials.reduce((sum, r) => sum + r.accuracy, 0) / mainTrials.length : 0
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
        const { app } = window.require('@electron/remote') || window.require('electron').remote;
        const { getParticipantFolderName } = window.require(path.join(app.getAppPath(), 'src', 'shared', 'storage', 'participant-storage.js'));
        const sessionsFolder = getParticipantFolderName(this.participantId);

        // Get platform-specific sessions directory
        let baseDir;
        if (process.platform === 'win32') {
            // Windows: %APPDATA%/Oats/sessions|participants/
            baseDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Oats', sessionsFolder);
        } else if (process.platform === 'darwin') {
            // macOS: ~/Documents/Oats/sessions|participants/
            baseDir = path.join(os.homedir(), 'Documents', 'Oats', sessionsFolder);
        } else {
            // Linux/other: ~/Documents/Oats/sessions|participants/
            baseDir = path.join(os.homedir(), 'Documents', 'Oats', sessionsFolder);
        }
        
        // Create participant folder
        const participantDir = path.join(baseDir, this.participantId);
        await fs.mkdir(participantDir, { recursive: true });
        
        // Create sct_timestamp folder
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
        const taskDir = path.join(participantDir, `sct_${timestamp}`);
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
        content += '           SPEEDED CLASSIFICATION TASK RESULTS\n';
        content += '='.repeat(60) + '\n\n';
        
        // Session Information
        content += 'SESSION INFORMATION\n';
        content += '-'.repeat(30) + '\n';
        content += `Participant ID: ${this.participantId}\n`;
        content += `Task: Speeded Classification Task\n`;
        content += `Start Time: ${startTime}\n`;
        content += `End Time: ${endTime}\n`;
        content += `Total Duration: ${this.calculateDuration()}\n\n`;
        
        // Configuration
        content += 'TASK CONFIGURATION\n';
        content += '-'.repeat(30) + '\n';
        const config = this.config.parameters;
        content += `Practice Phoneme Trials: ${config.trials.practice_phoneme}\n`;
        content += `Practice Voice Trials: ${config.trials.practice_voice}\n`;
        content += `Main Phoneme Trials: ${config.trials.main_phoneme}\n`;
        content += `Main Voice Trials: ${config.trials.main_voice}\n`;
        content += `Inter-trial Interval: ${config.timing.iti}ms\n`;
        content += `Pre-stimulus Delay: ${config.timing.pre_stimulus_delay}ms\n`;
        content += `Response Timeout: ${config.timing.response_timeout}ms\n`;
        content += `Error Display Duration: ${config.timing.error_display_duration}ms\n`;
        content += `Audio Volume: ${config.audio.volume}\n\n`;
        
        // Performance Summary
        content += 'PERFORMANCE SUMMARY\n';
        content += '-'.repeat(30) + '\n';
        content += `Total Trials Completed: ${summary.totalTrials}\n`;
        content += `Overall Accuracy: ${(summary.overallAccuracy * 100).toFixed(1)}%\n`;
        content += `Mean Response Time: ${summary.meanRT.toFixed(0)}ms\n`;
        content += `Practice Accuracy: ${(summary.practiceAccuracy * 100).toFixed(1)}%\n`;
        content += `Main Task Accuracy: ${(summary.mainAccuracy * 100).toFixed(1)}%\n\n`;
        
        // Phase-by-phase breakdown
        content += 'PHASE BREAKDOWN\n';
        content += '-'.repeat(30) + '\n';
        for (const phase of this.phases) {
            if (phase.trialCount === 0) continue;
            
            const phaseTrials = this.results.filter(r => r.phase === phase.name);
            const phaseAccuracy = phaseTrials.reduce((sum, r) => sum + r.accuracy, 0) / phaseTrials.length;
            const validPhaseTrials = phaseTrials.filter(r => r.participant_response !== 'timeout');
            const phaseMeanRT = validPhaseTrials.length > 0 ? 
                validPhaseTrials.reduce((sum, r) => sum + r.reaction_time, 0) / validPhaseTrials.length : 0;
            
            content += `${phase.title}:\n`;
            content += `  Trials: ${phaseTrials.length}\n`;
            content += `  Accuracy: ${(phaseAccuracy * 100).toFixed(1)}%\n`;
            content += `  Mean RT: ${phaseMeanRT.toFixed(0)}ms\n\n`;
        }
        
        // Detailed Trial Data
        content += 'DETAILED TRIAL DATA\n';
        content += '-'.repeat(60) + '\n';
        content += 'Trial | Phase           | Stimulus     | Category | Correct | Response | RT(ms) | Accurate\n';
        content += '-'.repeat(85) + '\n';
        
        for (const trial of this.results) {
            const trialNum = trial.global_trial.toString().padStart(5);
            const phase = trial.phase.padEnd(15);
            const stimulus = trial.stimulus.padEnd(12);
            const category = trial.stimulus_category.padEnd(8);
            const correct = trial.correct_response.padEnd(7);
            const response = (trial.participant_response === 'timeout' ? 'TIMEOUT' : trial.participant_response).padEnd(8);
            const rt = (trial.participant_response === 'timeout' ? 'N/A' : trial.reaction_time.toString()).padStart(6);
            const accurate = trial.accuracy === 1 ? 'YES' : 'NO';
            
            content += `${trialNum} | ${phase} | ${stimulus} | ${category} | ${correct} | ${response} | ${rt} | ${accurate}\n`;
        }
        
        // Response time distribution
        content += '\n' + 'RESPONSE TIME STATISTICS\n';
        content += '-'.repeat(30) + '\n';
        const validRTs = this.results.filter(r => r.participant_response !== 'timeout').map(r => r.reaction_time);
        if (validRTs.length > 0) {
            validRTs.sort((a, b) => a - b);
            const median = validRTs[Math.floor(validRTs.length / 2)];
            const q1 = validRTs[Math.floor(validRTs.length * 0.25)];
            const q3 = validRTs[Math.floor(validRTs.length * 0.75)];
            const min = Math.min(...validRTs);
            const max = Math.max(...validRTs);
            
            content += `Minimum RT: ${min}ms\n`;
            content += `25th Percentile (Q1): ${q1}ms\n`;
            content += `Median RT: ${median}ms\n`;
            content += `75th Percentile (Q3): ${q3}ms\n`;
            content += `Maximum RT: ${max}ms\n`;
            content += `Standard Deviation: ${this.calculateStandardDeviation(validRTs).toFixed(1)}ms\n\n`;
        }
        
        // Accuracy by category
        content += 'ACCURACY BY CATEGORY\n';
        content += '-'.repeat(30) + '\n';
        const categories = [...new Set(this.results.map(r => r.stimulus_category))];
        for (const category of categories) {
            const categoryTrials = this.results.filter(r => r.stimulus_category === category);
            const categoryAccuracy = categoryTrials.reduce((sum, r) => sum + r.accuracy, 0) / categoryTrials.length;
            content += `${category}: ${(categoryAccuracy * 100).toFixed(1)}% (${categoryTrials.length} trials)\n`;
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

    calculateStandardDeviation(values) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
        return Math.sqrt(variance);
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
window.speedClassificationPopup = new SpeededClassificationPopup();
window.loadSpeededClassificationTask = async (participantId) => {
    await window.speedClassificationPopup.loadTask(participantId);
};