// Stroop Color-Word Task Popup Integration
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
    }

    async loadTask(participantId) {
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
            
            const stimuliPath = path.join(process.cwd(), 'src', 'renderer', 'tasks', 'stroop_color_word', 'stimulus_data.txt');
            console.log('Attempting to load stimuli from:', stimuliPath);
            
            const stimuliData = await fs.readFile(stimuliPath, 'utf8');
            
            // Parse the COMMA-separated values (not tab-separated)
            const lines = stimuliData.trim().split('\n');
            const headers = lines[0].split(','); // Changed from '\t' to ','
            
            console.log('Headers:', headers);
            
            this.stimuli = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(','); // Changed from '\t' to ','
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
            // Create fallback stimuli
            this.stimuli = this.createFallbackStimuli();
            console.log('Using fallback stimuli');
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
                
                <button id="start-practice-btn" class="task-button task-button-primary">
                    Start Practice
                </button>
            </div>
        `;
        
        document.getElementById('start-practice-btn').addEventListener('click', () => this.startPracticePhase());
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
        const taskStage = document.getElementById('task-stage');
        const progressDisplay = document.getElementById('progress-display');
        
        const trialNum = this.currentTrial + 1;
        const totalTrials = phase === 'practice' ? this.practiceStimuli.length : this.mainStimuli.length;
        
        progressDisplay.textContent = `${phase === 'practice' ? 'Practice' : 'Main'} Trial ${trialNum} of ${totalTrials}`;
        
        // Start trial timing
        this.trialStartTime = Date.now();
        
        // Fixation cross
        taskStage.innerHTML = '<div class="fixation-cross">+</div>';
        await this.wait(this.config.parameters.timing.pre_stimulus_delay);
        
        // Start recording for main phase
        if (phase === 'main') {
            await this.startRecording();
        }
        
        // Present stimulus
        taskStage.innerHTML = `
            <div class="stimulus-display" style="color: ${stimulus.textColor};">
                ${stimulus.stim1}
            </div>
            ${phase === 'main' ? '<div class="recording-indicator">● REC</div>' : ''}
        `;
        
        // Wait for recording duration
        await this.wait(this.config.parameters.timing.recording_duration);
        
        // Stop recording for main phase
        if (phase === 'main') {
            await this.stopRecording();
        }
        
        // Calculate response time
        const responseTime = Date.now() - this.trialStartTime;
        
        // Record trial result
        const trialResult = {
            phase: phase,
            trial: trialNum,
            global_trial: this.results.length + 1,
            word: stimulus.stim1,
            ink_color: stimulus.textColor,
            condition: stimulus.condition1,
            response_time: responseTime,
            recording_file: phase === 'main' ? `trial_${this.results.length + 1}.wav` : 'none',
            timestamp: new Date().toISOString()
        };
        
        this.results.push(trialResult);
        
        // Brief pause before next trial
        taskStage.innerHTML = '';
        await this.wait(500);
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 44100,
                    channelCount: 1,
                    volume: this.config.parameters.audio.recording_level / 100
                }
            });
            
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.start();
        } catch (error) {
            console.error('Error starting recording:', error);
        }
    }

    async stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            return new Promise(resolve => {
                this.mediaRecorder.onstop = async () => {
                    // Create audio blob
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                    
                    // Save audio file
                    await this.saveAudioFile(audioBlob, `trial_${this.results.length + 1}.wav`);
                    
                    resolve();
                };
                this.mediaRecorder.stop();
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            });
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
                <h3>Task Complete!</h3>
                <div class="summary">
                    <h4>End of Block Summary</h4>
                    <p><strong>Number of trials completed:</strong> ${summary.totalTrials}</p>
                    <p><strong>Accuracy:</strong> ${summary.accuracy}% (estimated)</p>
                    <p><strong>Average response time:</strong> ${summary.meanRT.toFixed(0)}ms</p>
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

    async saveAudioFile(audioBlob, filename) {
        try {
            const os = window.require('os');
            const path = window.require('path');
            const fs = window.require('fs').promises;
            
            // Get the same directory structure as results
            let baseDir;
            if (process.platform === 'win32') {
                baseDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Oats', 'sessions');
            } else if (process.platform === 'darwin') {
                baseDir = path.join(os.homedir(), 'Documents', 'Oats', 'sessions');
            } else {
                baseDir = path.join(os.homedir(), 'Documents', 'Oats', 'sessions');
            }
            
            // Initialize timestamp if not already set
            if (!this.sessionTimestamp) {
                this.sessionTimestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
            }
            
            const taskDir = path.join(baseDir, this.participantId, `scw_${this.sessionTimestamp}`);
            
            // Ensure directory exists
            await fs.mkdir(taskDir, { recursive: true });
            
            // Convert blob to buffer
            const arrayBuffer = await audioBlob.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            // Save audio file
            const audioPath = path.join(taskDir, filename);
            await fs.writeFile(audioPath, buffer);
            
            console.log(`Audio saved to: ${audioPath}`);
            
        } catch (error) {
            console.error('Error saving audio file:', error);
        }
    }

    calculateSummary() {
        const totalTrials = this.results.length;
        const meanRT = totalTrials > 0 ? 
            this.results.reduce((sum, r) => sum + r.response_time, 0) / totalTrials : 0;
        
        return {
            totalTrials: totalTrials,
            accuracy: 'N/A', // Voice responses require manual scoring
            meanRT: meanRT
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
        content += `Average Response Time: ${summary.meanRT.toFixed(0)}ms\n`;
        content += `Note: Voice responses require manual scoring for accuracy\n\n`;
        
        // Phase breakdown
        const practiceResults = this.results.filter(r => r.phase === 'practice');
        const mainResults = this.results.filter(r => r.phase === 'main');
        
        content += 'PHASE BREAKDOWN\n';
        content += '-'.repeat(30) + '\n';
        
        if (practiceResults.length > 0) {
            const practiceMeanRT = practiceResults.reduce((sum, r) => sum + r.response_time, 0) / practiceResults.length;
            content += `Practice Phase:\n`;
            content += `  Trials: ${practiceResults.length}\n`;
            content += `  Mean RT: ${practiceMeanRT.toFixed(0)}ms\n\n`;
        }
        
        if (mainResults.length > 0) {
            const mainMeanRT = mainResults.reduce((sum, r) => sum + r.response_time, 0) / mainResults.length;
            content += `Main Phase:\n`;
            content += `  Trials: ${mainResults.length}\n`;
            content += `  Mean RT: ${mainMeanRT.toFixed(0)}ms\n\n`;
        }
        
        // Detailed Trial Data
        content += 'DETAILED TRIAL DATA\n';
        content += '-'.repeat(90) + '\n';
        content += 'Trial | Phase    | Word     | InkColor | Condition   | RT(ms) | Recording\n';
        content += '-'.repeat(90) + '\n';
        
        for (const trial of this.results) {
            const trialNum = trial.global_trial.toString().padStart(5);
            const phase = trial.phase.padEnd(8);
            const word = trial.word.padEnd(8);
            const inkColor = trial.ink_color.padEnd(8);
            const condition = trial.condition.padEnd(11);
            const rt = trial.response_time.toString().padStart(6);
            const recording = trial.recording_file;
            
            content += `${trialNum} | ${phase} | ${word} | ${inkColor} | ${condition} | ${rt} | ${recording}\n`;
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