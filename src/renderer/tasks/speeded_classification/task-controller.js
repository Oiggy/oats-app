console.log('🚀 Task controller script started');

class SpeededClassificationTask {
    constructor() {
        console.log('🔧 Constructor called');
        this.config = null;
        this.currentPhase = 0;
        this.currentTrial = 0;
        this.trialData = [];
        this.phaseData = [];
        this.startTime = null;
        this.stimulusStartTime = null;
        this.participantId = null;
        this.sessionTimestamp = null;
        
        // Phase definitions
        this.phases = [
            { name: 'practice_phoneme', type: 'phoneme', displayName: 'Practice: Phoneme Classification' },
            { name: 'practice_voice', type: 'voice', displayName: 'Practice: Voice Classification' },
            { name: 'main_phoneme', type: 'phoneme', displayName: 'Main Task: Phoneme Classification' },
            { name: 'main_voice', type: 'voice', displayName: 'Main Task: Voice Classification' }
        ];
        
        // Stimulus mapping
        this.stimuli = [
            { file: 'baab1M1.wav', phoneme: 'B', voice: 'Male' },
            { file: 'baab2F2.wav', phoneme: 'B', voice: 'Female' },
            { file: 'paab1M2.wav', phoneme: 'P', voice: 'Male' },
            { file: 'paab2F1.wav', phoneme: 'P', voice: 'Female' }
        ];
        
        console.log('🔧 Constructor finished, calling init()');
        this.init();
    }
    
    async init() {
        console.log('⚡ Init method started');
        try {
            console.log('📋 Loading configuration...');
            this.updateLoadingStatus('Loading configuration...');
            await this.loadConfiguration();
            console.log('✅ Configuration loaded');
            
            console.log('👤 Getting participant information...');
            this.updateLoadingStatus('Getting participant information...');
            await this.getParticipantInfo();
            console.log('✅ Participant info loaded');
            
            console.log('🔊 Preparing audio files...');
            this.updateLoadingStatus('Preparing audio files...');
            await this.preloadAudio();
            console.log('✅ Audio prepared');
            
            console.log('⚙️ Initializing task...');
            this.updateLoadingStatus('Initializing task...');
            this.bindEvents();
            console.log('✅ Events bound');
            
            console.log('📖 Showing instructions...');
            this.showInstructions();
            console.log('✅ Instructions shown');
            
        } catch (error) {
            console.error('❌ Task initialization failed:', error);
            this.showError('Failed to initialize task: ' + error.message);
        }
    }
    
    async loadConfiguration() {
        try {
            // Determine config path based on platform
            const configPath = this.getConfigPath();
            
            if (window.fs) {
                const configData = await window.fs.readFile(configPath, 'utf8');
                this.config = JSON.parse(configData);
            } else {
                // Fallback for testing - use default config
                this.config = this.getDefaultConfig();
            }
            
            console.log('Loaded configuration:', this.config);
        } catch (error) {
            console.warn('Could not load config file, using defaults:', error);
            this.config = this.getDefaultConfig();
        }
    }
    
    getConfigPath() {
        if (typeof window !== 'undefined' && window.require) {
            const path = window.require('path');
            const os = window.require('os');
            
            if (process.platform === 'win32') {
                return path.join(os.homedir(), 'AppData', 'Roaming', 'Oats', 'task-configurations', 'cfg_speeded_classification_task.json');
            } else {
                return path.join(os.homedir(), 'Documents', 'Oats', 'task-configurations', 'cfg_speeded_classification_task.json');
            }
        }
        return '~/Documents/Oats/task-configurations/cfg_speeded_classification_task.json';
    }
    
    getDefaultConfig() {
        return {
            "task": "speeded-classification",
            "timestamp": new Date().toISOString(),
            "parameters": {
                "trials": {
                    "practice_phoneme": 3,
                    "practice_voice": 5,
                    "main_phoneme": 3,
                    "main_voice": 5
                },
                "timing": {
                    "iti": 2200,
                    "pre_stimulus_delay": 2200,
                    "response_timeout": 5000,
                    "error_display_duration": 3000
                },
                "audio": {
                    "volume": 0.5
                },
                "data": {
                    "crash_recovery": true
                }
            }
        };
    }
    
    async getParticipantInfo() {
        // Get participant ID from dashboard or session storage
        this.participantId = this.getStoredParticipantId() || 'test_participant';
        this.sessionTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    }
    
    getStoredParticipantId() {
        // Try to get from various sources
        if (window.sessionStorage) {
            return window.sessionStorage.getItem('currentParticipantId');
        }
        if (window.parent && window.parent.getCurrentParticipantId) {
            return window.parent.getCurrentParticipantId();
        }
        return null;
    }
    
    async preloadAudio() {
        try {
            const audioElement = document.getElementById('stimulus-audio');
            audioElement.volume = this.config.parameters.audio.volume;
            
            console.log('Starting audio preload...');
            
            // Try to preload all audio files
            const loadPromises = this.stimuli.map(stimulus => {
                return this.loadAudioFile(stimulus.file).catch(error => {
                    console.warn(`Failed to preload ${stimulus.file}:`, error);
                    return null; // Continue even if one file fails
                });
            });
            
            await Promise.all(loadPromises);
            console.log('Audio preload completed');
            
        } catch (error) {
            console.warn('Audio preload failed, continuing anyway:', error);
            // Don't throw error - let task continue without preloaded audio
        }
    }

    loadAudioFile(filename) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            
            audio.addEventListener('canplaythrough', () => {
                console.log(`Successfully loaded: ${filename}`);
                resolve();
            });
            
            audio.addEventListener('error', (e) => {
                console.error(`Failed to load audio: ${filename}`, e);
                reject(e);
            });
            
            // Try different path variations
            const paths = [
                `./stim_files/${filename}`,
                `../tasks/speeded_classification/stim_files/${filename}`,
                `./tasks/speeded_classification/stim_files/${filename}`
            ];
            
            audio.src = paths[0]; // Start with the first path
            console.log(`Attempting to load: ${audio.src}`);
            audio.load();
        });
    }
    
    bindEvents() {
        document.getElementById('start-button').addEventListener('click', () => this.startPhase());
        document.getElementById('continue-button').addEventListener('click', () => this.continueToNextPhase());
        document.getElementById('finish-button').addEventListener('click', () => this.finishTask());
        document.getElementById('retry-button').addEventListener('click', () => this.init());
        document.getElementById('exit-button').addEventListener('click', () => this.exitTask());
        
        // Response buttons
        document.getElementById('response-1').addEventListener('click', () => this.handleResponse(1));
        document.getElementById('response-2').addEventListener('click', () => this.handleResponse(2));
    }
    
    updateLoadingStatus(status) {
        const statusElement = document.getElementById('loading-status');
        if (statusElement) {
            statusElement.textContent = status;
        }
    }
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }
    
    showTrialState(stateId) {
        document.querySelectorAll('.trial-state').forEach(state => {
            state.classList.remove('active');
        });
        document.getElementById(stateId).classList.add('active');
    }
    
    showInstructions() {
        const phase = this.phases[this.currentPhase];
        const instructionTitle = document.getElementById('instruction-title');
        const instructionText = document.getElementById('instruction-text');
        
        instructionTitle.textContent = `${phase.displayName} - Instructions`;
        
        if (phase.type === 'phoneme') {
            instructionText.innerHTML = `
                <div class="sentence">In this task, you will hear syllables that start with either <strong>B</strong> or <strong>P</strong>.</div>
                <div class="sentence">Listen carefully and click the button that matches what you hear:</div>
                <ul>
                    <li><strong>B</strong> - for syllables starting with B sound (like "baab")</li>
                    <li><strong>P</strong> - for syllables starting with P sound (like "paab")</li>
                </ul>
                <div class="sentence">Respond as quickly and accurately as possible.</div>
            `;
        } else {
            instructionText.innerHTML = `
                <div class="sentence">In this task, you will hear syllables spoken by different voices.</div>
                <div class="sentence">Listen carefully and click the button that matches the speaker's gender:</div>
                <ul>
                    <li><strong>Male</strong> - for male voices</li>
                    <li><strong>Female</strong> - for female voices</li>
                </ul>
                <div class="sentence">Respond as quickly and accurately as possible.</div>
            `;
        }
        
        this.showScreen('instruction-screen');
    }
    
    startPhase() {
        this.currentTrial = 0;
        this.phaseData = [];
        this.updateProgress();
        this.runTrial();
    }
    
    updateProgress() {
        const phase = this.phases[this.currentPhase];
        const totalTrials = this.config.parameters.trials[phase.name];
        const progress = (this.currentTrial / totalTrials) * 100;
        
        document.getElementById('progress-fill').style.width = `${progress}%`;
        document.getElementById('current-phase').textContent = phase.displayName;
        document.getElementById('trial-counter').textContent = `${this.currentTrial}/${totalTrials}`;
    }
    
    async runTrial() {
        this.showScreen('trial-screen');
        
        // Pre-stimulus delay
        this.showTrialState('pre-stimulus');
        await this.delay(this.config.parameters.timing.pre_stimulus_delay);
        
        // Present stimulus
        await this.presentStimulus();
        
        // Collect response
        await this.collectResponse();
    }
    
    async presentStimulus() {
        this.showTrialState('stimulus-presentation');
        
        // Select random stimulus
        const stimulus = this.stimuli[Math.floor(Math.random() * this.stimuli.length)];
        this.currentStimulus = stimulus;
        this.stimulusStartTime = Date.now();
        
        // Play audio
        const audioElement = document.getElementById('stimulus-audio');
        audioElement.src = `./stim_files/${stimulus.file}`;
        
        try {
            await audioElement.play();
            
            // Wait for audio to finish, then show response options
            audioElement.addEventListener('ended', () => {
                setTimeout(() => {
                    this.showResponseOptions();
                }, 200);
            }, { once: true });
            
        } catch (error) {
            console.error('Audio playback failed:', error);
            // Continue to response collection anyway
            setTimeout(() => {
                this.showResponseOptions();
            }, 1000);
        }
    }
    
    showResponseOptions() {
        const phase = this.phases[this.currentPhase];
        const prompt = document.getElementById('response-prompt');
        const button1 = document.getElementById('button-1-label');
        const button2 = document.getElementById('button-2-label');
        
        if (phase.type === 'phoneme') {
            prompt.textContent = 'Which sound did you hear?';
            button1.textContent = 'B';
            button2.textContent = 'P';
        } else {
            prompt.textContent = 'What was the speaker\'s gender?';
            button1.textContent = 'Male';
            button2.textContent = 'Female';
        }
        
        this.showTrialState('response-collection');
        this.startResponseTimeout();
    }
    
    async collectResponse() {
        return new Promise((resolve) => {
            this.responseResolver = resolve;
        });
    }
    
    handleResponse(responseOption) {
        if (!this.responseResolver) return;
        
        const reactionTime = Date.now() - this.stimulusStartTime;
        const phase = this.phases[this.currentPhase];
        
        let response, correct;
        
        if (phase.type === 'phoneme') {
            response = responseOption === 1 ? 'B' : 'P';
            correct = response === this.currentStimulus.phoneme;
        } else {
            response = responseOption === 1 ? 'Male' : 'Female';
            correct = response === this.currentStimulus.voice;
        }
        
        this.recordTrialData(response, correct, reactionTime);
        this.showFeedback(correct);
        
        this.responseResolver();
        this.responseResolver = null;
    }
    
    startResponseTimeout() {
        const timeoutBar = document.getElementById('timeout-bar');
        const timeout = this.config.parameters.timing.response_timeout;
        
        timeoutBar.style.transition = `transform ${timeout}ms linear`;
        timeoutBar.style.transform = 'scaleX(0)';
        
        this.responseTimeout = setTimeout(() => {
            if (this.responseResolver) {
                this.handleTimeout();
            }
        }, timeout);
    }
    
    handleTimeout() {
        if (!this.responseResolver) return;
        
        const reactionTime = Date.now() - this.stimulusStartTime;
        this.recordTrialData('timeout', false, reactionTime);
        this.showFeedback(false, true);
        
        this.responseResolver();
        this.responseResolver = null;
    }
    
    recordTrialData(response, correct, reactionTime) {
        const phase = this.phases[this.currentPhase];
        const trialRecord = {
            participantId: this.participantId,
            phase: phase.name,
            phaseType: phase.type,
            trialNumber: this.currentTrial + 1,
            stimulusFile: this.currentStimulus.file,
            correctPhoneme: this.currentStimulus.phoneme,
            correctVoice: this.currentStimulus.voice,
            participantResponse: response,
            accuracy: response === 'timeout' ? 'no_response' : (correct ? 'correct' : 'incorrect'),
            reactionTime: reactionTime,
            timestamp: new Date().toISOString(),
            config: this.config.parameters
        };
        
        this.phaseData.push(trialRecord);
        this.trialData.push(trialRecord);
        
        // Auto-save if crash recovery is enabled
        if (this.config.parameters.data.crash_recovery) {
            this.autoSave();
        }
    }
    
    async showFeedback(correct, timeout = false) {
        const feedbackIcon = document.getElementById('feedback-icon');
        const feedbackText = document.getElementById('feedback-text');
        
        if (timeout) {
            feedbackIcon.textContent = '⏰';
            feedbackIcon.className = 'feedback-icon timeout';
            feedbackText.textContent = 'No Response';
            feedbackText.className = 'feedback-text timeout';
        } else if (correct) {
            feedbackIcon.textContent = '✓';
            feedbackIcon.className = 'feedback-icon correct';
            feedbackText.textContent = 'Correct!';
            feedbackText.className = 'feedback-text correct';
        } else {
            feedbackIcon.textContent = '✗';
            feedbackIcon.className = 'feedback-icon incorrect';
            feedbackText.textContent = 'Incorrect';
            feedbackText.className = 'feedback-text incorrect';
        }
        
        this.showTrialState('feedback');
        
        const duration = timeout ? 
            this.config.parameters.timing.error_display_duration : 
            this.config.parameters.timing.iti;
            
        await this.delay(duration);
        
        this.nextTrial();
    }
    
    nextTrial() {
        this.currentTrial++;
        const phase = this.phases[this.currentPhase];
        const totalTrials = this.config.parameters.trials[phase.name];
        
        if (this.currentTrial < totalTrials) {
            this.updateProgress();
            this.runTrial();
        } else {
            this.completePhase();
        }
    }
    
    completePhase() {
        if (this.currentPhase < this.phases.length - 1) {
            this.showPhaseTransition();
        } else {
            this.completeTask();
        }
    }
    
    showPhaseTransition() {
        const messages = {
            0: "Now you'll classify by voice gender.",
            1: "Now the main task begins. Classify phonemes quickly and accurately.",
            2: "Now classify voice gender as fast and accurately as possible."
        };
        
        const transitionTitle = document.getElementById('transition-title');
        const transitionMessage = document.getElementById('transition-message');
        
        transitionTitle.textContent = 'Phase Complete!';
        transitionMessage.textContent = messages[this.currentPhase];
        
        this.showScreen('transition-screen');
    }
    
    continueToNextPhase() {
        this.currentPhase++;
        this.showInstructions();
    }
    
    async completeTask() {
        await this.saveAllData();
        this.showTaskComplete();
    }
    
    showTaskComplete() {
        const resultsSummary = document.getElementById('results-summary');
        const totalTrials = this.trialData.length;
        const correctTrials = this.trialData.filter(t => t.accuracy === 'correct').length;
        const accuracy = ((correctTrials / totalTrials) * 100).toFixed(1);
        
        resultsSummary.innerHTML = `
            <h4>Performance Summary:</h4>
            <p>Total Trials: ${totalTrials}</p>
            <p>Correct Responses: ${correctTrials}</p>
            <p>Overall Accuracy: ${accuracy}%</p>
        `;
        
        this.showScreen('complete-screen');
    }
    
    async saveAllData() {
        try {
            const dataPath = this.getDataPath();
            const content = this.generateDataFileContent();
            
            if (window.fs) {
                await this.ensureDirectoryExists(dataPath);
                await window.fs.writeFile(
                    `${dataPath}/results.txt`, 
                    content, 
                    'utf8'
                );
                console.log('Data saved successfully to:', dataPath);
            } else {
                console.log('Data would be saved to:', dataPath);
                console.log('Data content:', content);
            }
        } catch (error) {
            console.error('Failed to save data:', error);
        }
    }
    
    getDataPath() {
        if (typeof window !== 'undefined' && window.require) {
            const path = window.require('path');
            const os = window.require('os');
            
            const baseDir = process.platform === 'win32' ? 
                path.join(os.homedir(), 'AppData', 'Roaming', 'Oats') :
                path.join(os.homedir(), 'Documents', 'Oats');
                
            return path.join(baseDir, 'sessions', this.participantId, `sct_${this.sessionTimestamp}`);
        }
        
        return `~/Documents/Oats/sessions/${this.participantId}/sct_${this.sessionTimestamp}`;
    }
    
    async ensureDirectoryExists(dirPath) {
        if (window.fs) {
            try {
                await window.fs.access(dirPath);
            } catch {
                await window.fs.mkdir(dirPath, { recursive: true });
            }
        }
    }
    
    generateDataFileContent() {
        let content = '';
        content += '# OATS - Speeded Classification Task Results\n';
        content += `# Participant: ${this.participantId}\n`;
        content += `# Session: ${this.sessionTimestamp}\n`;
        content += `# Task Configuration: ${JSON.stringify(this.config.parameters)}\n`;
        content += '# ==========================================\n\n';
        
        content += 'ParticipantID\tPhase\tTrialNumber\tStimulusFile\tCorrectPhoneme\tCorrectVoice\tParticipantResponse\tAccuracy\tReactionTime\tTimestamp\n';
        
        for (const trial of this.trialData) {
            content += `${trial.participantId}\t${trial.phase}\t${trial.trialNumber}\t${trial.stimulusFile}\t${trial.correctPhoneme}\t${trial.correctVoice}\t${trial.participantResponse}\t${trial.accuracy}\t${trial.reactionTime}\t${trial.timestamp}\n`;
        }
        
        return content;
    }
    
    async autoSave() {
        // Implement periodic auto-save for crash recovery
        if (this.trialData.length % 5 === 0) { // Save every 5 trials
            try {
                const tempPath = this.getDataPath() + '_temp';
                const content = this.generateDataFileContent();
                
                if (window.fs) {
                    await this.ensureDirectoryExists(tempPath);
                    await window.fs.writeFile(`${tempPath}/partial_results.txt`, content, 'utf8');
                }
            } catch (error) {
                console.warn('Auto-save failed:', error);
            }
        }
    }
    
    showError(message) {
        document.getElementById('error-message').textContent = message;
        this.showScreen('error-screen');
    }
    
    finishTask() {
        if (window.parent && window.parent.returnToDashboard) {
            window.parent.returnToDashboard();
        } else {
            alert('Task completed! Please close this window.');
        }
    }
    
    exitTask() {
        if (confirm('Are you sure you want to exit the task? Progress may be lost.')) {
            this.finishTask();
        }
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// NEW VERSION - checks if DOM is already loaded
function initializeTask() {
    console.log('🌐 Initializing task instance');
    new SpeededClassificationTask();
}

// Check if DOM is already loaded (it usually is when script is injected)
if (document.readyState === 'loading') {
    // DOM is still loading, wait for it
    document.addEventListener('DOMContentLoaded', initializeTask);
} else {
    // DOM is already loaded, initialize immediately
    console.log('🌐 DOM already ready, initializing immediately');
    initializeTask();
}