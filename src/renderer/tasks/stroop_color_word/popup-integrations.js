// Stroop Color-Word Task Popup Integration
const path = require('path');
// const NativeAudioRecorder = require(path.join(process.cwd(), 'src', 'renderer', 'tasks', 'stroop_color_word', 'native_audio_recorder.js'));
// const SpeechOnsetDetector = require(path.join(process.cwd(), 'src', 'renderer', 'tasks', 'stroop_color_word', 'speech_onset_detector.js'));

class StroopColorWordPopup {
    constructor() {
        this.isOpen = false;
        this.participantId = null;
        this.config = null;
        this.currentPhase = 'welcome';
        this.currentTrial = 0;
        this.results = [];
        this.stimuli = [];
        this.practiceStimuli = [];
        this.mainStimuli = [];
        this.startTime = null;
        this.trialStartTime = null;
        this.isPaused = false;
        this.taskState = 'ready';
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.breakTrials = [];
        this.sessionTimestamp = null; // Add this line
        // NativeAudioRecorder/SpeechOnsetDetector are only available after
        // window.require(...) in loadTask(); instantiating them here would
        // throw a ReferenceError before the object is ever constructed.
        this.audioRecorder = null;
        this.speechDetector = null;
        this.isAudioSetup = false;
        this.currentRecordingPromise = null;
        this.currentTrialTiming = null;
        this.recordingPromises = [];
    }

    async loadTask(participantId) {
        const path = window.require('path');
        const { app } = window.require('@electron/remote') || window.require('electron').remote;
        const appPath = app.getAppPath();
        
        const NativeAudioRecorder = window.require(path.join(appPath, 'src', 'renderer', 'tasks', 'stroop_color_word', 'native_audio_recorder.js'));
        const SpeechOnsetDetector = window.require(path.join(appPath, 'src', 'renderer', 'tasks', 'stroop_color_word', 'speech_onset_detector.js'));
        
        this.audioRecorder = new NativeAudioRecorder();
        this.speechDetector = new SpeechOnsetDetector();
        
        if (this.isOpen) return;
        
        this.participantId = participantId;
        await this.loadConfiguration();
        await this.loadStimuli();
        this.setupStimuli();
        this.calculateBreakPoints();
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
            
            const configPath = path.join(baseDir, 'cfg_stroop_color_word_task.json');
            const configData = await fs.readFile(configPath, 'utf8');
            this.config = JSON.parse(configData);
        } catch (error) {
            console.log('No configuration found, using defaults');
            this.config = this.getDefaultConfig();
        }
    }

    getDefaultConfig() {
        return {
            task: 'stroop-color-word',
            parameters: {
                trials: {
                    practice: 6,
                    main: 10
                },
                timing: {
                    pre_stimulus_delay: 200,
                    recording_duration: 3000
                },
                audio: {
                    recording_level: 50
                },
                data: {
                    crash_recovery: true
                }
            }
        };
    }

    async loadStimuli() {
        try {
            const path = window.require('path');
            const fs = window.require('fs').promises;
            const { app } = window.require('@electron/remote') || window.require('electron').remote;
            
            // Use app.getAppPath() to get the correct resource path in packaged app
            const appPath = app.getAppPath();
            const stimuliPath = path.join(appPath, 'src', 'renderer', 'tasks', 'stroop_color_word', 'stimulus_data.txt');
            
            console.log('Attempting to load stimuli from:', stimuliPath);
            
            const stimuliData = await fs.readFile(stimuliPath, 'utf8');
            
            // Parse the COMMA-separated values (not tab-separated)
            const lines = stimuliData.trim().split('\n');
            const headers = lines[0].split(',');
            
            console.log('Headers:', headers);
            
            this.stimuli = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                const stimulus = {};
                headers.forEach((header, index) => {
                    stimulus[header.trim()] = values[index]?.trim() || '';
                });
                this.stimuli.push(stimulus);
            }
            
            console.log(`Loaded ${this.stimuli.length} stimuli from stimulus_data.txt`);
            console.log('First few stimuli:', this.stimuli.slice(0, 3));
            
        } catch (error) {
            console.error('Error loading stimuli:', error);
            throw error;
        }
    }

    createFallbackStimuli() {
        return [
            { stim1: 'RED', textColor: 'red', condition1: 'congruent' },
            { stim1: 'BLUE', textColor: 'blue', condition1: 'congruent' },
            { stim1: 'GREEN', textColor: 'green', condition1: 'congruent' },
            { stim1: 'RED', textColor: 'blue', condition1: 'incongruent' },
            { stim1: 'BLUE', textColor: 'green', condition1: 'incongruent' },
            { stim1: 'GREEN', textColor: 'red', condition1: 'incongruent' },
            { stim1: 'DEEP', textColor: 'red', condition1: 'neutral' },
            { stim1: 'BRIGHT', textColor: 'blue', condition1: 'neutral' }
        ];
    }

    setupStimuli() {
        // Randomize and select stimuli for practice and main phases
        this.practiceStimuli = this.selectRandomStimuli(this.config.parameters.trials.practice);
        this.mainStimuli = this.selectRandomStimuli(this.config.parameters.trials.main);
    }

    selectRandomStimuli(count) {
        const shuffled = [...this.stimuli].sort(() => Math.random() - 0.5);
        const selected = [];
        
        for (let i = 0; i < count; i++) {
            selected.push(shuffled[i % shuffled.length]);
        }
        
        return selected;
    }

    calculateBreakPoints() {
        const mainTrials = this.config.parameters.trials.main;
        this.breakTrials = [];
        
        if (mainTrials > 3) {
            const break1 = Math.floor(mainTrials / 3);
            const break2 = Math.floor((mainTrials * 2) / 3);
            
            if (break1 > 0) this.breakTrials.push(break1);
            if (break2 > break1 && break2 < mainTrials) this.breakTrials.push(break2);
        }
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
                <h2 class="task-title">Stroop Color-Word Task</h2>
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

                .welcome-screen, .break-screen {
                    text-align: center;
                    max-width: 700px;
                    padding: 40px;
                }

                .welcome-screen h3, .break-screen h3 {
                    margin-bottom: 20px;
                    color: #1d1d1f;
                    font-size: 24px;
                }

                .welcome-screen p, .break-screen p {
                    margin-bottom: 16px;
                    color: #6e6e73;
                    line-height: 1.6;
                    text-align: left;
                }

                .fixation-cross {
                    font-size: 64px;
                    font-weight: bold;
                    color: #1d1d1f;
                    user-select: none;
                }

                .stimulus-display {
                    text-align: center;
                    font-size: 72px;
                    font-weight: bold;
                    font-family: 'Arial', sans-serif;
                    user-select: none;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                }

                .recording-indicator {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    background: #ff3b30;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 600;
                    animation: pulse-record 1s infinite;
                }

                @keyframes pulse-record {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
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
        
        const breakInfo = this.breakTrials.length > 0 ? 
            `During the main task, you will receive scheduled breaks after trials ${this.breakTrials.join(' and ')}.` : 
            'No breaks are scheduled for the main task.';
        
        taskStage.innerHTML = `
            <div class="welcome-screen">
                <h3>Welcome to the Stroop Color-Word Task</h3>
                <p>You will see color words (e.g., RED, BLUE, GREEN) displayed in different ink colors. Your job is to say the ink color aloud, not read the word.</p>
                
                <p>First, you will complete a short practice phase. Then, you will complete the main phase, where your voice will be recorded for each trial.</p>
                
                <p>${breakInfo}</p>
                
                <p>The number of main trials is divided by three, and breaks occur at those points (the experimenter can calculate the exact trial counts for breaks in advance).</p>
                
                <div class="audio-test-section">
                    <button id="test-audio-btn" class="task-button task-button-secondary">
                        🎤 Test Microphone
                    </button>
                    <p class="audio-caption">Click to test your microphone is working</p>
                </div>
                
                <button id="start-practice-btn" class="task-button task-button-primary">
                    Start Practice
                </button>
            </div>
        `;
        
        // Bind events
        document.getElementById('test-audio-btn').addEventListener('click', () => this.testMicrophone());
        document.getElementById('start-practice-btn').addEventListener('click', () => this.startPracticePhase());
    }

    // Add microphone test method
    async testMicrophone() {
        const testBtn = document.getElementById('test-audio-btn');
        const originalText = testBtn.textContent;
        
        testBtn.textContent = '🎤 Testing...';
        testBtn.disabled = true;
        
        try {
            const testResult = await this.audioRecorder.testAudio();
            
            if (testResult) {
                testBtn.textContent = '✅ Microphone OK';
            } else {
                testBtn.textContent = '❌ Microphone Error';
            }
            
            setTimeout(() => {
                testBtn.textContent = originalText;
                testBtn.disabled = false;
            }, 3000);
            
        } catch (error) {
            testBtn.textContent = '❌ Setup Error';
            console.error('Microphone test failed:', error);
            
            setTimeout(() => {
                testBtn.textContent = originalText;
                testBtn.disabled = false;
            }, 3000);
        }
    }

    startPracticePhase() {
        this.currentPhase = 'practice';
        this.currentTrial = 0;
        this.taskState = 'running';
        this.startTime = new Date();
        
        // Enable pause button
        document.getElementById('pause-task-btn').disabled = false;
        
        this.runTrialSequence('practice');
    }

    startMainPhase() {
        this.currentPhase = 'main';
        this.currentTrial = 0;
        
        this.runTrialSequence('main');
    }

    async runTrialSequence(phase) {
        const stimuli = phase === 'practice' ? this.practiceStimuli : this.mainStimuli;
        
        for (this.currentTrial = 0; this.currentTrial < stimuli.length; this.currentTrial++) {
            if (this.taskState === 'stopped') break;
            
            while (this.isPaused) {
                await this.wait(100);
            }
            
            // Check for breaks in main phase
            if (phase === 'main' && this.breakTrials.includes(this.currentTrial + 1)) {
                await this.showBreakScreen();
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

    async showBreakScreen() {
        const taskStage = document.getElementById('task-stage');
        const progressDisplay = document.getElementById('progress-display');
        
        progressDisplay.textContent = `Break after trial ${this.currentTrial + 1}`;
        
        taskStage.innerHTML = `
            <div class="break-screen">
                <h3>Break Time</h3>
                <p>You have completed ${this.currentTrial + 1} trials out of ${this.mainStimuli.length}.</p>
                <p>Take a moment to rest. Press continue when you're ready to proceed.</p>
                
                <button id="continue-btn" class="task-button task-button-primary">
                    Continue
                </button>
            </div>
        `;
        
        return new Promise(resolve => {
            document.getElementById('continue-btn').addEventListener('click', resolve);
        });
    }

    async runSingleTrial(phase, stimulus) {
        console.log('Running trial with stimulus:', stimulus);
        
        const taskStage = document.getElementById('task-stage');
        const progressDisplay = document.getElementById('progress-display');
        
        const trialNum = this.currentTrial + 1;
        const totalTrials = phase === 'practice' ? this.practiceStimuli.length : this.mainStimuli.length;
        
        progressDisplay.textContent = `${phase === 'practice' ? 'Practice' : 'Main'} Trial ${trialNum} of ${totalTrials}`;
        
        // Initialize timing object
        this.currentTrialTiming = {
            audioStartTime: null,
            stimulusOnsetTime: null,
            stimulusOffset: null,
            speechOnsetTime: null,
            rtSeconds: null,
            rtConfidence: null
        };
        
        // Fixation cross
        taskStage.innerHTML = '<div class="fixation-cross">+</div>';
        await this.wait(this.config.parameters.timing.pre_stimulus_delay);
        
        // Pre-load microphone for main phase
        if (phase === 'main') {
            await this.audioRecorder.preloadMicrophone();
        }
        
        // Start recording BEFORE stimulus display for main phase
        let recordingPromise = null;
        if (phase === 'main') {
            const filename = `trial_${this.results.length + 1}.wav`;
            const outputPath = await this.getAudioOutputPath(filename);
            const recordingDuration = this.config.parameters.timing.recording_duration;
            
            recordingPromise = this.audioRecorder.startRecordingWithPreciseTiming(
                outputPath, 
                recordingDuration
            );
            
            // Get audio start time immediately
            this.currentTrialTiming.audioStartTime = this.audioRecorder.getHighResolutionTime();
        }
        
        // Present stimulus and get precise timing
        const displayWord = stimulus.stim1 || 'ERROR';
        const displayColor = stimulus.textColor || 'black';
        
        taskStage.innerHTML = `
            <div class="stimulus-display" style="color: ${displayColor};">
                ${displayWord}
            </div>
            ${phase === 'main' ? '<div class="recording-indicator">● REC</div>' : ''}
        `;
        
        // Force repaint and get stimulus onset time
        await this.forceRepaint();
        this.currentTrialTiming.stimulusOnsetTime = this.audioRecorder.getHighResolutionTime();
        
        if (phase === 'main') {
            this.currentTrialTiming.stimulusOffset = 
                this.currentTrialTiming.stimulusOnsetTime - this.currentTrialTiming.audioStartTime;
        }
        
        // Wait for recording to complete
        if (recordingPromise) {
            const recordingResult = await recordingPromise;
            
            // Queue speech analysis for later processing
            this.recordingPromises.push(
                this.analyzeRecordingAsync(recordingResult.outputPath, this.currentTrialTiming.stimulusOffset)
            );
        } else {
            // For practice trials, just wait the recording duration
            await this.wait(this.config.parameters.timing.recording_duration);
        }
        
        // Record trial result with timing data
        const trialResult = {
            phase: phase,
            trial: trialNum,
            global_trial: this.results.length + 1,
            word: stimulus.stim1,
            ink_color: stimulus.textColor,
            condition: stimulus.condition1,
            recording_file: phase === 'main' ? `trial_${this.results.length + 1}.wav` : 'none',
            timestamp: new Date().toISOString(),
            
            // New timing parameters
            audio_start_time: this.currentTrialTiming.audioStartTime,
            stimulus_onset_time: this.currentTrialTiming.stimulusOnsetTime,
            stimulus_offset: this.currentTrialTiming.stimulusOffset,
            speech_onset_time: null, // Will be filled by analysis
            rt_seconds: null, // Will be filled by analysis
            rt_confidence: null // Will be filled by analysis
        };
        
        this.results.push(trialResult);
        
        // Brief pause before next trial
        taskStage.innerHTML = '';
        await this.wait(500);
    }

    // Add method to force repaint for precise timing
    async forceRepaint() {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });
    }
    
    async startRecording() {
        try {
            console.log('Recording initialized');
            this.recordingStartTime = Date.now();
            this.isAudioSetup = true;
            
        } catch (error) {
            console.error('Error initializing audio recording:', error);
            throw error;
        }
    }

    async stopRecording() {
        try {
            const recordingDuration = this.config.parameters.timing.recording_duration;
            const filename = `trial_${this.results.length + 1}.wav`;
            const outputPath = await this.getAudioOutputPath(filename);
            
            // Start and complete recording in one call
            await this.audioRecorder.startRecording(outputPath, recordingDuration);
            
            console.log(`Audio recorded to: ${outputPath}`);
            
        } catch (error) {
            console.error('Error recording audio:', error);
            // Don't throw - allow task to continue even if recording fails
        }
    }

    async getAudioOutputPath(filename) {
        const os = window.require('os');
        const path = window.require('path');
        const fs = window.require('fs').promises;
        const { app } = window.require('@electron/remote') || window.require('electron').remote;
        const { getParticipantFolderName } = window.require(path.join(app.getAppPath(), 'src', 'shared', 'storage', 'participant-storage.js'));
        const sessionsFolder = getParticipantFolderName(this.participantId);

        // Get the same directory structure as results
        let baseDir;
        if (process.platform === 'win32') {
            baseDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Oats', sessionsFolder);
        } else if (process.platform === 'darwin') {
            baseDir = path.join(os.homedir(), 'Documents', 'Oats', sessionsFolder);
        } else {
            baseDir = path.join(os.homedir(), 'Documents', 'Oats', sessionsFolder);
        }
        
        // Initialize timestamp if not already set
        if (!this.sessionTimestamp) {
            this.sessionTimestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
        }
        
        const taskDir = path.join(baseDir, this.participantId, `scw_${this.sessionTimestamp}`);
        
        // Ensure directory exists
        await fs.mkdir(taskDir, { recursive: true });
        
        return path.join(taskDir, filename);
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

    // Add async speech analysis
    async analyzeRecordingAsync(audioPath, stimulusOffset) {
        try {
            const analysisResult = await this.speechDetector.analyzeWavFile(audioPath, stimulusOffset);
            
            // Find the corresponding trial result and update it
            const trialIndex = this.results.length - 1;
            if (trialIndex >= 0) {
                this.results[trialIndex].speech_onset_time = analysisResult.speechOnsetTime;
                this.results[trialIndex].rt_seconds = analysisResult.rtSeconds;
                this.results[trialIndex].rt_confidence = analysisResult.rtConfidence;
                
                console.log(`Speech analysis completed for trial ${trialIndex + 1}:`, {
                    rt_ms: analysisResult.rtSeconds ? (analysisResult.rtSeconds * 1000).toFixed(1) : 'N/A',
                    confidence: analysisResult.rtConfidence ? analysisResult.rtConfidence.toFixed(3) : 'N/A'
                });
            }
            
        } catch (error) {
            console.error('Speech analysis failed:', error);
        }
    }

    // Update completeTask to wait for all analyses
    async completeTask() {
        this.taskState = 'completed';
        const taskStage = document.getElementById('task-stage');
        const progressDisplay = document.getElementById('progress-display');
        
        // Show processing message
        taskStage.innerHTML = `
            <div class="task-complete">
                <h3>Processing Audio...</h3>
                <p>Analyzing speech recordings for reaction time computation...</p>
            </div>
        `;
        
        progressDisplay.textContent = 'Processing audio recordings...';
        
        // Wait for all speech analyses to complete
        if (this.recordingPromises.length > 0) {
            await Promise.all(this.recordingPromises);
        }
        
        // Calculate summary statistics
        const summary = this.calculateSummary();
        
        taskStage.innerHTML = `
            <div class="task-complete">
                <h3>Task Complete!</h3>
                <div class="summary">
                    <h4>End of Block Summary</h4>
                    <p><strong>Number of trials completed:</strong> ${summary.totalTrials}</p>
                    <p><strong>Average reaction time:</strong> ${summary.meanRT.toFixed(0)}ms</p>
                    <p><strong>Mean RT confidence:</strong> ${summary.meanConfidence.toFixed(3)}</p>
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

    // Update summary calculation
    calculateSummary() {
        const totalTrials = this.results.length;
        const validRTs = this.results.filter(r => r.rt_seconds !== null && r.rt_seconds > 0);
        const meanRT = validRTs.length > 0 ? 
            validRTs.reduce((sum, r) => sum + (r.rt_seconds * 1000), 0) / validRTs.length : 0;
        
        const validConfidences = this.results.filter(r => r.rt_confidence !== null);
        const meanConfidence = validConfidences.length > 0 ?
            validConfidences.reduce((sum, r) => sum + r.rt_confidence, 0) / validConfidences.length : 0;
        
        return {
            totalTrials: totalTrials,
            meanRT: meanRT,
            meanConfidence: meanConfidence
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
            baseDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Oats', sessionsFolder);
        } else if (process.platform === 'darwin') {
            baseDir = path.join(os.homedir(), 'Documents', 'Oats', sessionsFolder);
        } else {
            baseDir = path.join(os.homedir(), 'Documents', 'Oats', sessionsFolder);
        }
        
        // Create participant folder
        const participantDir = path.join(baseDir, this.participantId);
        await fs.mkdir(participantDir, { recursive: true });
        
        // Use the same timestamp that was used for audio files
        if (!this.sessionTimestamp) {
            this.sessionTimestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
        }
        
        const taskDir = path.join(participantDir, `scw_${this.sessionTimestamp}`);
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
        content += '             STROOP COLOR-WORD TASK RESULTS\n';
        content += '='.repeat(60) + '\n\n';
        
        // Session Information
        content += 'SESSION INFORMATION\n';
        content += '-'.repeat(30) + '\n';
        content += `Participant ID: ${this.participantId}\n`;
        content += `Task: Stroop Color-Word Task\n`;
        content += `Start Time: ${startTime}\n`;
        content += `End Time: ${endTime}\n`;
        content += `Total Duration: ${this.calculateDuration()}\n\n`;
        
        // Configuration
        content += 'TASK CONFIGURATION\n';
        content += '-'.repeat(30) + '\n';
        const config = this.config.parameters;
        content += `Practice Trials: ${config.trials.practice}\n`;
        content += `Main Trials: ${config.trials.main}\n`;
        content += `Pre-stimulus Delay: ${config.timing.pre_stimulus_delay}ms\n`;
        content += `Recording Duration: ${config.timing.recording_duration}ms\n`;
        content += `Audio Recording Level: ${config.audio.recording_level}%\n\n`;
        
        // Break Points
        if (this.breakTrials.length > 0) {
            content += 'BREAK POINTS\n';
            content += '-'.repeat(30) + '\n';
            content += `Breaks occurred after trials: ${this.breakTrials.join(', ')}\n\n`;
        }
        
        // Performance Summary
        content += 'PERFORMANCE SUMMARY\n';
        content += '-'.repeat(30) + '\n';
        content += `Total Trials Completed: ${summary.totalTrials}\n`;
        content += `Average Reaction Time: ${summary.meanRT.toFixed(0)}ms\n`;
        content += `Mean RT Confidence: ${summary.meanConfidence.toFixed(3)}\n`;
        content += `Valid Speech Detections: ${summary.validDetections}/${summary.totalTrials}\n`;
        content += `Note: RT computed from speech onset detection in audio recordings\n\n`;
        
        // Phase breakdown
        const practiceResults = this.results.filter(r => r.phase === 'practice');
        const mainResults = this.results.filter(r => r.phase === 'main');
        
        content += 'PHASE BREAKDOWN\n';
        content += '-'.repeat(30) + '\n';
        
        if (practiceResults.length > 0) {
            content += `Practice Phase:\n`;
            content += `  Trials: ${practiceResults.length}\n`;
            content += `  Note: No RT analysis for practice trials\n\n`;
        }
        
        if (mainResults.length > 0) {
            const mainValidRTs = mainResults.filter(r => r.rt_seconds !== null && r.rt_seconds > 0);
            const mainMeanRT = mainValidRTs.length > 0 ? 
                mainValidRTs.reduce((sum, r) => sum + (r.rt_seconds * 1000), 0) / mainValidRTs.length : 0;
            const mainValidConfidences = mainResults.filter(r => r.rt_confidence !== null);
            const mainMeanConfidence = mainValidConfidences.length > 0 ?
                mainValidConfidences.reduce((sum, r) => sum + r.rt_confidence, 0) / mainValidConfidences.length : 0;
                
            content += `Main Phase:\n`;
            content += `  Trials: ${mainResults.length}\n`;
            content += `  Valid Speech Detections: ${mainValidRTs.length}\n`;
            content += `  Mean RT: ${mainMeanRT.toFixed(0)}ms\n`;
            content += `  Mean Confidence: ${mainMeanConfidence.toFixed(3)}\n\n`;
        }
        
        // Detailed Trial Data
        content += 'DETAILED TRIAL DATA\n';
        content += '-'.repeat(140) + '\n';
        content += 'Trial | Phase    | Word     | InkColor | Condition   | AudioStart   | StimulusOnset | Offset    | SpeechOnset  | RT(ms) | Confidence | Recording\n';
        content += '-'.repeat(140) + '\n';
        
        for (const trial of this.results) {
            const trialNum = trial.global_trial.toString().padStart(5);
            const phase = trial.phase.padEnd(8);
            const word = (trial.word || 'N/A').padEnd(8);
            const inkColor = (trial.ink_color || 'N/A').padEnd(8);
            const condition = (trial.condition || 'N/A').padEnd(11);
            const audioStart = trial.audio_start_time ? trial.audio_start_time.toFixed(6).padEnd(12) : 'N/A'.padEnd(12);
            const stimulusOnset = trial.stimulus_onset_time ? trial.stimulus_onset_time.toFixed(6).padEnd(13) : 'N/A'.padEnd(13);
            const offset = trial.stimulus_offset ? trial.stimulus_offset.toFixed(6).padEnd(9) : 'N/A'.padEnd(9);
            const speechOnset = trial.speech_onset_time ? trial.speech_onset_time.toFixed(6).padEnd(12) : 'N/A'.padEnd(12);
            const rt = trial.rt_seconds ? (trial.rt_seconds * 1000).toFixed(1).padStart(6) : 'N/A'.padStart(6);
            const confidence = trial.rt_confidence ? trial.rt_confidence.toFixed(3).padEnd(10) : 'N/A'.padEnd(10);
            const recording = trial.recording_file || 'none';
            
            content += `${trialNum} | ${phase} | ${word} | ${inkColor} | ${condition} | ${audioStart} | ${stimulusOnset} | ${offset} | ${speechOnset} | ${rt} | ${confidence} | ${recording}\n`;
        }
        
        // Speech Analysis Summary
        content += '\n' + 'SPEECH ANALYSIS DETAILS\n';
        content += '-'.repeat(40) + '\n';
        const analysisResults = this.results.filter(r => r.phase === 'main');
        const successful = analysisResults.filter(r => r.rt_seconds !== null).length;
        const failed = analysisResults.length - successful;
        
        content += `Total Main Trials: ${analysisResults.length}\n`;
        content += `Successful Speech Detections: ${successful}\n`;
        content += `Failed Speech Detections: ${failed}\n`;
        
        if (successful > 0) {
            const validRTs = analysisResults.filter(r => r.rt_seconds !== null);
            const rtRange = {
                min: Math.min(...validRTs.map(r => r.rt_seconds * 1000)),
                max: Math.max(...validRTs.map(r => r.rt_seconds * 1000))
            };
            const confidenceRange = {
                min: Math.min(...validRTs.map(r => r.rt_confidence)),
                max: Math.max(...validRTs.map(r => r.rt_confidence))
            };
            
            content += `RT Range: ${rtRange.min.toFixed(1)} - ${rtRange.max.toFixed(1)}ms\n`;
            content += `Confidence Range: ${confidenceRange.min.toFixed(3)} - ${confidenceRange.max.toFixed(3)}\n`;
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
window.stroopColorWordPopup = new StroopColorWordPopup();
window.loadStroopColorWordTask = async (participantId) => {
    await window.stroopColorWordPopup.loadTask(participantId);
};