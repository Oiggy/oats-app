class PracticeCastTask {
    constructor(participantId) {
        this.participantId = participantId;
        this.config = null;
        this.audioContext = null;
        this.audioBuffers = {};
        this.currentSource = null;
        
        // Task state
        this.currentPage = 'instruction'; // 'instruction' or 'player'
        this.currentIndex = 0;
        this.audioFiles = [];
        this.textItems = [];
        this.totalItems = 0;
        
        // Response timer
        this.responseTimer = null;
        this.responseMs = 0;
        this.responseRunning = false;
        
        // UI elements
        this.modalOverlay = null;
        this.modalContent = null;
    }

    async init() {
        try {
            await this.loadConfiguration();
            await this.initializeAudioContext();
            await this.loadStimuli();
            this.createTaskModal();
            this.showInstructionPage();
        } catch (error) {
            console.error('Error initializing Practice CaST task:', error);
            alert('Failed to initialize task. Please check configuration.');
        }
    }

    async loadConfiguration() {
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
        
        const configPath = path.join(baseDir, 'cfg_practice_cast_task.json');
        const configData = await fs.readFile(configPath, 'utf8');
        this.config = JSON.parse(configData);
        
        console.log('Practice CaST Configuration loaded:', this.config);
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
        const path = window.require('path');
        const fs = window.require('fs').promises;
        const { app } = window.require('@electron/remote') || window.require('electron').remote;
        
        const appPath = app.getAppPath();
        const audioDir = path.join(appPath, 'src', 'renderer', 'tasks', 'sin', 'practice_cast', 'audio');
        const textPath = path.join(appPath, 'src', 'renderer', 'tasks', 'sin', 'practice_cast', 'cast_list.txt');
        
        console.log('Loading from:', audioDir);
        
        // Load audio files
        try {
            const files = await fs.readdir(audioDir);
            this.audioFiles = files
                .filter(f => f.endsWith('.wav'))
                .sort((a, b) => {
                    // Sort by leading number: "1_xxx.wav", "2_xxx.wav", etc.
                    const numA = parseInt(a.split('_')[0]) || 0;
                    const numB = parseInt(b.split('_')[0]) || 0;
                    return numA - numB;
                })
                .map(f => path.join(audioDir, f));
            
            console.log('Audio files found:', this.audioFiles.length);
            
            // Preload audio buffers
            for (const filePath of this.audioFiles) {
                await this.loadAudioBuffer(filePath);
            }
        } catch (error) {
            console.error('Error loading audio files:', error);
        }
        
        // Load text items
        try {
            const textContent = await fs.readFile(textPath, 'utf8');
            this.textItems = textContent
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
            
            console.log('Text items found:', this.textItems.length);
        } catch (error) {
            console.error('Error loading text file:', error);
        }
        
        this.totalItems = Math.min(this.audioFiles.length, this.textItems.length);
        console.log('Total items:', this.totalItems);
    }

    async loadAudioBuffer(filePath) {
        const fs = window.require('fs').promises;
        const path = window.require('path');
        
        try {
            const audioData = await fs.readFile(filePath);
            const arrayBuffer = audioData.buffer.slice(
                audioData.byteOffset,
                audioData.byteOffset + audioData.byteLength
            );
            
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            const filename = path.basename(filePath);
            this.audioBuffers[filename] = audioBuffer;
        } catch (error) {
            console.error(`Error loading audio buffer for ${filePath}:`, error);
        }
    }

    createTaskModal() {
        // Create modal overlay
        this.modalOverlay = document.createElement('div');
        this.modalOverlay.className = 'task-modal-overlay';
        
        // Create modal content
        this.modalContent = document.createElement('div');
        this.modalContent.className = 'task-modal-content practice-cast-modal';
        
        this.modalOverlay.appendChild(this.modalContent);
        document.body.appendChild(this.modalOverlay);
    }

    showInstructionPage() {
        this.currentPage = 'instruction';
        
        const instructionText = `Read this to the participant:

In this part of the test, you will hear some audio recordings.
After each one, please repeat exactly what you heard.
We'll start with a few practice items now.`;
        
        this.modalContent.innerHTML = `
            <div class="practice-cast-instruction-page">
                <div class="instruction-content">
                    <h1 class="task-title">Practice CaST</h1>
                    
                    <div class="instruction-text">
                        ${instructionText.replace(/\n/g, '<br>')}
                    </div>
                    
                    <div class="instruction-buttons">
                        <button class="task-btn task-btn-secondary" id="back-to-sin-btn">
                            Main Menu
                        </button>
                        <button class="task-btn task-btn-primary" id="start-practice-btn">
                            Start
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Attach event listeners
        document.getElementById('back-to-sin-btn').addEventListener('click', () => {
            this.closeTask();
        });
        
        document.getElementById('start-practice-btn').addEventListener('click', () => {
            if (this.totalItems === 0) {
                alert('No audio/text items found.');
                return;
            }
            this.showPlayerPage();
        });
    }

    showPlayerPage() {
        this.currentPage = 'player';
        
        this.modalContent.innerHTML = `
            <div class="practice-cast-player-page">
                <div class="player-content">
                    <h1 class="task-title">Practice CaST</h1>
                    
                    <div class="item-counter" id="item-counter">
                        Item 1 of ${this.totalItems}
                    </div>
                    
                    <div class="text-display" id="text-display">
                        ${this.textItems[0] || '—'}
                    </div>
                    
                    <div class="status-display" id="status-display">
                        &nbsp;
                    </div>
                    
                    <div class="response-timer" id="response-timer">
                        Response time: —
                    </div>
                    
                    <div class="player-controls">
                        <button class="control-btn" id="back-btn">Back</button>
                        <button class="control-btn" id="play-btn">Play</button>
                        <button class="control-btn" id="stop-btn">Stop</button>
                        <button class="control-btn" id="next-btn">Next</button>
                    </div>
                    
                    <div class="bottom-controls">
                        <button class="task-btn task-btn-secondary" id="back-menu-btn">
                            Main Menu
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Attach event listeners
        document.getElementById('back-btn').addEventListener('click', () => this.handleBack());
        document.getElementById('play-btn').addEventListener('click', () => this.handlePlay());
        document.getElementById('stop-btn').addEventListener('click', () => this.handleStop());
        document.getElementById('next-btn').addEventListener('click', () => this.handleNext());
        document.getElementById('back-menu-btn').addEventListener('click', () => this.closeTask());
    }

    handleBack() {
        this.stopResponseTimer();
        
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.refreshPlayerUI();
        } else {
            this.stopAudio();
            this.showInstructionPage();
        }
    }

    handlePlay() {
        if (this.totalItems === 0) return;
        
        this.resetResponseTimer();
        this.updateStatus('Playing…');
        
        const filename = this.audioFiles[this.currentIndex].split(/[/\\]/).pop();
        const audioBuffer = this.audioBuffers[filename];
        
        if (!audioBuffer) {
            console.error('Audio buffer not found for:', filename);
            this.updateStatus('Error: Audio not loaded');
            return;
        }
        
        // Stop any currently playing audio
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {
                // Source may already be stopped
            }
        }
        
        // Create new audio source
        this.currentSource = this.audioContext.createBufferSource();
        this.currentSource.buffer = audioBuffer;
        
        // Connect to destination with volume
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = this.config.parameters.audio.volume;
        this.currentSource.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Handle audio end
        this.currentSource.onended = () => {
            this.updateStatus('Audio finished ✓');
            this.startResponseTimer();
        };
        
        this.currentSource.start(0);
    }

    handleStop() {
        this.stopAudio();
        this.updateStatus('Stopped');
        this.stopResponseTimer();
    }

    handleNext() {
        this.stopResponseTimer();
        
        if (this.currentIndex < this.totalItems - 1) {
            this.currentIndex++;
            this.refreshPlayerUI();
        } else {
            alert('Practice finished.');
        }
    }

    stopAudio() {
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {
                // Already stopped
            }
            this.currentSource = null;
        }
    }

    refreshPlayerUI() {
        const counterEl = document.getElementById('item-counter');
        const textEl = document.getElementById('text-display');
        
        if (counterEl) {
            counterEl.textContent = `Item ${this.currentIndex + 1} of ${this.totalItems}`;
        }
        
        if (textEl) {
            textEl.textContent = this.textItems[this.currentIndex] || '—';
        }
        
        this.stopAudio();
        this.resetResponseTimer();
    }

    updateStatus(message) {
        const statusEl = document.getElementById('status-display');
        if (statusEl) {
            statusEl.textContent = message;
        }
    }

    // Response timer methods
    startResponseTimer() {
        this.responseMs = 0;
        this.responseRunning = true;
        this.updateResponseDisplay();
        
        this.responseTimer = setInterval(() => {
            if (this.responseRunning) {
                this.responseMs += 100;
                this.updateResponseDisplay();
            }
        }, 100);
    }

    stopResponseTimer() {
        if (this.responseTimer) {
            clearInterval(this.responseTimer);
            this.responseTimer = null;
        }
        this.responseRunning = false;
    }

    resetResponseTimer() {
        this.stopResponseTimer();
        this.responseMs = 0;
        const timerEl = document.getElementById('response-timer');
        if (timerEl) {
            timerEl.textContent = 'Response time: —';
        }
        this.updateStatus(' ');
    }

    updateResponseDisplay() {
        const timerEl = document.getElementById('response-timer');
        if (timerEl) {
            timerEl.textContent = `Response time: ${this.formatTime(this.responseMs)}`;
        }
    }

    formatTime(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const millis = ms % 1000;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
    }

    closeTask() {
        this.stopAudio();
        this.stopResponseTimer();
        
        if (this.modalOverlay && this.modalOverlay.parentNode) {
            this.modalOverlay.parentNode.removeChild(this.modalOverlay);
        }
        
        this.cleanup();
    }

    cleanup() {
        console.log('Practice CaST task cleanup completed');
        window.practiceCastTaskInstance = null;
    }
}

// Global function to load and start the Practice CaST task
async function loadPracticeCastTask(participantId) {
    try {
        console.log('Loading Practice CaST task for participant:', participantId);
        
        // Create and initialize task instance
        window.practiceCastTaskInstance = new PracticeCastTask(participantId);
        await window.practiceCastTaskInstance.init();
        
    } catch (error) {
        console.error('Error loading Practice CaST task:', error);
        alert('Error loading Practice CaST task. Please check the configuration and try again.');
    }
}

// Make it globally available
window.loadPracticeCastTask = loadPracticeCastTask;