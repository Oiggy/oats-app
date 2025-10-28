// Reading Span Task Popup Integration
class ReadingSpanTask {
    constructor(participantId) {
        this.participantId = participantId;
        this.config = null;
        this.stimulusData = [];
        this.currentPhase = 'welcome';
        this.currentSeries = 1;
        this.currentBlock = 1;
        this.currentSentenceIndex = 0;
        this.currentBlockSentences = [];
        this.results = [];
        this.sessionStartTime = new Date();
        
        // Initialize NativeAudioRecorder - will be loaded in init()
        this.audioRecorder = null;
        this.isAudioSetup = false;
        this.currentRecordingPromise = null;
        
        // Hardcoded practice sentences
        this.practiceSentences = {
            1: {
                1: [
                    { sentence: "I took my cat to the vet, and I was informed that she is really sick", target: "sick" }
                ],
                2: [
                    { sentence: "I do not know if we are in fall or still summer, but it rained heavily today", target: "today" },
                    { sentence: "I drove to work after picking up my cousin from the airport", target: "airport" }
                ]
            },
            2: {
                1: [
                    { sentence: "The paint splashed from the building across my flat, changed my bag colour to red", target: "red" },
                    { sentence: "Let's take a walk downtown so we get the opportunity to attend the concert", target: "concert" }
                ],
                2: [
                    { sentence: "Many years ago, it was hard to sing music", target: "music" },
                    { sentence: "Stress is a challenge that needs to be taken seriously", target: "seriously" },
                    { sentence: "The lecture took so long yesterday due to the multiple presentations", target: "presentations" }
                ]
            }
        };
        
        this.totalRecallsAttempted = 0;
        this.totalRecallsUnattempted = 0;

        // Modal elements
        this.modalOverlay = null;
        this.modalContent = null;
    }

    async init() {
        try {
            // Load NativeAudioRecorder class first
            const path = window.require('path');
            const NativeAudioRecorder = window.require(path.join(process.cwd(), 'src', 'renderer', 'tasks', 'reading_span', 'native_audio_recorder.js'));
            this.audioRecorder = new NativeAudioRecorder();
            
            await this.loadConfiguration();
            await this.loadStimulusData();
            await this.setupAudioPermissions();
            this.createTaskModal();
            this.showWelcomeScreen();
        } catch (error) {
            console.error('Error initializing Reading Span task:', error);
            alert('Error loading Reading Span task. Please check configuration and microphone permissions.');
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
        
        const configPath = path.join(baseDir, 'cfg_reading_span_task.json');
        const configData = await fs.readFile(configPath, 'utf8');
        this.config = JSON.parse(configData);
        
        console.log('Reading Span Configuration loaded:', this.config);
    }

    async loadStimulusData() {
        const path = window.require('path');
        const fs = window.require('fs').promises;
        
        const stimulusPath = path.join(__dirname, '..', 'tasks', 'reading_span', 'Sentence Dictionary.csv');
        const stimulusContent = await fs.readFile(stimulusPath, 'utf8');
        
        const lines = stimulusContent.split('\n').filter(line => line.trim());
        
        this.stimulusData = [];
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length >= 3) {
                const seriesCode = values[0].trim();
                const sentence = values[1].trim().replace(/"/g, '');
                const targetWord = values[2].trim().replace(/"/g, '');
                
                const series = Math.floor(parseInt(seriesCode) / 100);
                const block = Math.floor((parseInt(seriesCode) % 100) / 10);
                const position = parseInt(seriesCode) % 10;
                
                this.stimulusData.push({
                    series: series,
                    block: block,
                    position: position,
                    sentence: sentence,
                    target: targetWord,
                    originalCode: seriesCode
                });
            }
        }
        
        this.stimulusData.sort((a, b) => {
            if (a.series !== b.series) return a.series - b.series;
            if (a.block !== b.block) return a.block - b.block;
            return a.position - b.position;
        });
        
        console.log('Stimulus data loaded:', this.stimulusData.length, 'sentences');
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }

    async setupAudioPermissions() {
        try {
            console.log('Setting up audio with NativeAudioRecorder...');
            
            // Test audio using NativeAudioRecorder
            const testResult = await this.audioRecorder.testAudio();
            
            if (!testResult) {
                throw new Error('Microphone test failed. Please ensure sox is installed and microphone is connected.');
            }
            
            this.isAudioSetup = true;
            console.log('NativeAudioRecorder initialized successfully');
            
        } catch (error) {
            console.error('Audio setup error:', error);
            throw new Error('Microphone access denied or sox not installed. Please check your setup and try again.');
        }
    }

    createTaskModal() {
        // Create modal overlay
        this.modalOverlay = document.createElement('div');
        this.modalOverlay.className = 'reading-span-task-overlay';
        this.modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            backdrop-filter: blur(2px);
        `;

        // Create modal content
        this.modalContent = document.createElement('div');
        this.modalContent.className = 'reading-span-task-modal';
        this.modalContent.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            width: 90%;
            max-width: 900px;
            min-height: 600px;
            max-height: 90vh;
            position: relative;
            display: flex;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
        `;

        // Create modal HTML structure
        this.modalContent.innerHTML = `
            <div class="reading-span-task-header" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px;
                border-bottom: 1px solid #e9ecef;
                background: white;
                border-radius: 12px 12px 0 0;
                flex-shrink: 0;
            ">
                <h1 style="
                    font-size: 18px;
                    font-weight: 600;
                    color: #212529;
                    margin: 0;
                ">Reading Span Task</h1>
                <button onclick="window.readingSpanTaskInstance.closeTask()" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    color: #6c757d;
                    cursor: pointer;
                    padding: 4px 8px;
                    line-height: 1;
                    transition: color 0.15s ease;
                " onmouseover="this.style.color='#dc3545'" onmouseout="this.style.color='#6c757d'">
                    ×
                </button>
            </div>
            
            <div class="reading-span-task-body" style="
                flex: 1;
                overflow-y: auto;
                padding: 32px 24px;
                display: flex;
                flex-direction: column;
            ">
                <div id="reading-span-status-text" style="
                    font-size: 14px;
                    color: #6c757d;
                    margin-bottom: 20px;
                    font-weight: 500;
                ">Initializing...</div>
                
                <div id="reading-span-task-content" style="
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                "></div>
            </div>
        `;

        this.modalOverlay.appendChild(this.modalContent);
        document.body.appendChild(this.modalOverlay);
    }

    showWelcomeScreen() {
        this.updateStatus('Welcome');
        
        const content = `
            <h2 style="
                font-size: 24px;
                font-weight: 600;
                color: #212529;
                margin-bottom: 24px;
            ">Welcome to the Reading Span Task</h2>
            
            <div style="
                font-size: 16px;
                line-height: 1.6;
                color: #495057;
                margin-bottom: 32px;
                max-width: 600px;
                text-align: left;
            ">
                <p><strong>Instructions:</strong></p>
                <ul style="margin-left: 20px;">
                    <li>You will read sentences one at a time</li>
                    <li>After each sentence, remember the last word</li>
                    <li>At the end of each set, recall all the last words in order</li>
                    <li>Click the recall buttons to record your responses</li>
                </ul>
                
                <p style="margin-top: 20px;"><strong>Audio Recording:</strong></p>
                <ul style="margin-left: 20px;">
                    <li>This task uses native audio recording</li>
                    <li>Your responses will be recorded as WAV files</li>
                    <li>Please ensure your microphone is working properly</li>
                </ul>
            </div>
            
            <button onclick="window.readingSpanTaskInstance.testMicrophone()" style="
                background-color: #17a2b8;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.15s ease;
                margin: 8px;
            " onmouseover="this.style.backgroundColor='#138496'" onmouseout="this.style.backgroundColor='#17a2b8'">
                🎤 Test Microphone
            </button>
            
            <button onclick="window.readingSpanTaskInstance.startPractice()" style="
                background-color: #007bff;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.15s ease;
                margin: 8px;
            " onmouseover="this.style.backgroundColor='#0056b3'" onmouseout="this.style.backgroundColor='#007bff'">
                Start Practice
            </button>
        `;
        
        this.updateContent(content);
    }

    async testMicrophone() {
        const testBtn = event.target;
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

    startPractice() {
        this.currentPhase = 'practice';
        this.currentSeries = 1;
        this.currentBlock = 1;
        this.currentSentenceIndex = 0;
        this.loadCurrentBlock();
        this.showNextSentence();
    }

    startMain() {
        this.currentPhase = 'main';
        this.currentSeries = 1;
        this.currentBlock = 1;
        this.currentSentenceIndex = 0;
        this.loadCurrentBlock();
        this.showNextSentence();
    }

    loadCurrentBlock() {
        if (this.currentPhase === 'practice') {
            this.currentBlockSentences = this.practiceSentences[this.currentSeries]?.[this.currentBlock] || [];
        } else {
            this.currentBlockSentences = this.stimulusData.filter(item => 
                item.series === this.currentSeries && 
                item.block === this.currentBlock
            );
        }
        
        console.log(`Loaded block: Series ${this.currentSeries}, Block ${this.currentBlock}`, 
                    this.currentBlockSentences.length, 'sentences');
    }

    showNextSentence() {
        if (this.currentSentenceIndex >= this.currentBlockSentences.length) {
            this.showRecallScreen();
            return;
        }

        const sentence = this.currentBlockSentences[this.currentSentenceIndex];
        this.updateStatus(`${this.currentPhase === 'practice' ? 'Practice' : 'Main'} - Series ${this.currentSeries}, Block ${this.currentBlock}, Sentence ${this.currentSentenceIndex + 1}/${this.currentBlockSentences.length}`);
        
        const content = `
            <div style="
                font-size: 22px;
                line-height: 1.8;
                color: #212529;
                text-align: center;
                max-width: 700px;
                padding: 40px;
                background: #f8f9fa;
                border-radius: 8px;
                border: 1px solid #dee2e6;
            ">
                ${sentence.sentence}
            </div>
        `;
        
        this.updateContent(content);
        
        const duration = this.currentPhase === 'practice' 
            ? this.config.parameters.timing.practice_sentence_duration 
            : this.config.parameters.timing.main_sentence_duration;
        
        setTimeout(() => {
            this.currentSentenceIndex++;
            this.showNextSentence();
        }, duration);
    }

    async showRecallScreen() {
        this.updateStatus(`${this.currentPhase === 'practice' ? 'Practice' : 'Main'} - Recall Phase`);
        
        const recallButtons = this.currentBlockSentences.map((sentence, index) => `
            <button class="recall-button" data-index="${index}" data-target="${sentence.target}" style="
                background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
                color: white;
                border: none;
                padding: 16px 32px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 2px 8px rgba(0,123,255,0.3);
                min-width: 180px;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,123,255,0.4)'" 
            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,123,255,0.3)'">
                <span style="font-size: 16px;">🎤</span> Recall ${index + 1}
            </button>
        `).join('');
        
        const content = `
            <h3 style="
                font-size: 20px;
                font-weight: 600;
                color: #212529;
                margin-bottom: 24px;
            ">Recall the final words in order</h3>
            
            <div style="
                font-size: 14px;
                color: #6c757d;
                margin-bottom: 24px;
            ">
                ${this.currentPhase === 'practice' 
                    ? 'Click each button to practice recall (no recording)' 
                    : `Click each button to record your recall (${this.config.parameters.timing.recall_time_duration / 1000}s each)`
                }
            </div>
            
            <div style="
                display: flex;
                flex-wrap: wrap;
                gap: 16px;
                justify-content: center;
                margin: 24px 0;
            ">
                ${recallButtons}
            </div>
            
            <div id="recall-timer-display" style="
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 8px;
                padding: 12px 20px;
                margin: 24px 0;
                font-weight: 500;
                color: #6c757d;
                font-size: 14px;
                min-height: 45px;
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                ${this.currentPhase === 'practice' 
                    ? 'Click a recall button to practice' 
                    : '🎤 Initializing microphone...'
                }
            </div>
        `;
        
        this.updateContent(content);
        
        // *** ONLY preload microphone for MAIN phase ***
        if (this.currentPhase === 'main') {
            console.log('Preloading microphone for recall phase...');
            await this.audioRecorder.preloadMicrophone();
            
            // *** NEW: Do a dummy recording to fully initialize the audio pipeline ***
            console.log('Performing dummy recording to warm up audio system...');
            const os = window.require('os');
            const path = window.require('path');
            const fs = window.require('fs').promises;
            
            const tmpPath = path.join(os.tmpdir(), `dummy_warmup_${Date.now()}.wav`);
            
            try {
                // Do a 1-second dummy recording
                await this.audioRecorder.startRecording(tmpPath, 1000);
                // Delete the dummy file
                await fs.unlink(tmpPath).catch(() => {});
                console.log('Audio system fully warmed up');
            } catch (error) {
                console.warn('Dummy recording failed, but continuing:', error);
            }
            
            // Update timer display to show ready state
            const timerDisplay = document.getElementById('recall-timer-display');
            if (timerDisplay) {
                timerDisplay.innerHTML = 'Click a recall button to start recording';
            }
        }
        
        // Set up recall button handlers
        document.querySelectorAll('.recall-button').forEach(button => {
            button.addEventListener('click', () => {
                this.handleRecallButtonClick(button);
            });
        });

        // Check if all buttons are completed periodically
        this.checkRecallCompletion();
    }

    async handleRecallButtonClick(button) {
        const index = parseInt(button.dataset.index);
        const targetWord = button.dataset.target;
        const isMainPhase = this.currentPhase === 'main';
        
        // Prevent clicking if already recording or completed
        if (button.classList.contains('recording') || button.disabled) {
            return;
        }
        
        // Disable other buttons while this one is active
        document.querySelectorAll('.recall-button').forEach(btn => {
            if (btn !== button && !btn.disabled) {
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
                btn.style.pointerEvents = 'none';
            }
        });
        
        // *** ONLY start recording for MAIN phase ***
        if (isMainPhase) {
            await this.startRecording(targetWord, true);
            button.classList.add('recording');
            button.innerHTML = `<span style="font-size: 16px;">🔴</span> Recording ${index + 1}...`;
            button.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
        } else {
            // Practice phase - just show active state without recording
            button.classList.add('recording');
            button.innerHTML = `<span style="font-size: 16px;">✓</span> Practicing ${index + 1}...`;
            button.style.background = 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)';
        }
        
        // Start individual countdown for this button
        const duration = this.config.parameters.timing.recall_time_duration;
        this.startIndividualCountdown(button, duration, targetWord, isMainPhase, index);
    }

    startIndividualCountdown(button, duration, targetWord, isMainPhase, index) {
        const timerDisplay = document.getElementById('recall-timer-display');
        let remaining = Math.floor(duration / 1000);
        
        // Update timer display
        const updateTimer = () => {
            if (timerDisplay && button.classList.contains('recording')) {
                timerDisplay.innerHTML = `
                    <span style="color: #dc3545; font-weight: 600;">Recording Recall ${index + 1}:</span>
                    <span style="font-size: 18px; font-weight: 700; color: #dc3545; margin-left: 8px;">
                        ${remaining}s
                    </span>
                `;
                
                if (remaining <= 5) {
                    timerDisplay.style.background = '#fff3cd';
                    timerDisplay.style.borderColor = '#ffc107';
                }
            }
        };
        
        updateTimer();
        
        const interval = setInterval(() => {
            remaining--;
            updateTimer();
            
            if (remaining <= 0) {
                clearInterval(interval);
                this.finishIndividualRecording(button, targetWord, isMainPhase, index);
            }
        }, 1000);
        
        // Store interval on button for potential cleanup
        button.recordingInterval = interval;
    }

    async finishIndividualRecording(button, targetWord, isMainPhase, index) {
        // Stop recording
        await this.stopRecording();
        
        // Update button appearance
        button.classList.remove('recording');
        button.innerHTML = `<span style="font-size: 16px;">✅</span> Recorded ${index + 1}`;
        button.disabled = true;
        button.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
        button.style.opacity = '1';
        button.style.cursor = 'not-allowed';
        
        // Clear the interval
        if (button.recordingInterval) {
            clearInterval(button.recordingInterval);
            delete button.recordingInterval;
        }
        
        // Re-enable other buttons
        document.querySelectorAll('.recall-button').forEach(btn => {
            if (!btn.disabled) {
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                btn.style.pointerEvents = 'auto';
            }
        });
        
        // Update timer display
        const timerDisplay = document.getElementById('recall-timer-display');
        if (timerDisplay) {
            const activeButtons = document.querySelectorAll('.recall-button:not([disabled])');
            if (activeButtons.length === 0) {
                timerDisplay.innerHTML = `
                    <span style="color: #28a745; font-weight: 600;">All recordings completed</span>
                `;
                timerDisplay.style.background = '#d4edda';
                timerDisplay.style.borderColor = '#c3e6cb';
            } else {
                timerDisplay.innerHTML = `
                    <span style="color: #6c757d;">Click next recall button to continue</span>
                `;
                timerDisplay.style.background = '#f8f9fa';
                timerDisplay.style.borderColor = '#dee2e6';
            }
        }
        
        this.totalRecallsAttempted++;
        
        // Check if this phase is complete
        setTimeout(() => {
            this.checkRecallCompletion();
        }, 1000);
    }

    checkRecallCompletion() {
        const activeButtons = document.querySelectorAll('.recall-button:not([disabled])');
        
        if (activeButtons.length === 0) {
            // All buttons completed, end recall phase
            setTimeout(() => {
                this.endRecallPhase();
            }, 2000); // Brief pause to show completion message
        }
    }

    async startRecording(targetWord, saveToFile = false) {
        // Skip if practice phase
        if (this.currentPhase === 'practice') {
            console.log('Skipping recording for practice phase');
            return;
        }
        
        try {
            console.log('Starting native audio recording...');
            
            // Get output path for this recording
            const filename = `recall_series${this.currentSeries}_block${this.currentBlock}_${targetWord}.wav`;
            const outputPath = await this.getAudioOutputPath(filename);
            const recordingDuration = this.config.parameters.timing.recall_time_duration;
            
            // Start recording using NativeAudioRecorder
            this.currentRecordingPromise = this.audioRecorder.startRecording(
                outputPath,
                recordingDuration,
                this.config.parameters.audio?.recording_level || 50
            );
            
            // Store result info for later
            if (saveToFile && this.currentPhase === 'main') {
                this.results.push({
                    phase: this.currentPhase,
                    series: this.currentSeries,
                    block: this.currentBlock,
                    target_word: targetWord,
                    audio_file: filename,
                    timestamp: new Date().toISOString()
                });
            }
            
        } catch (error) {
            console.error('Error starting recording:', error);
        }
    }

    async stopRecording() {
        try {
            if (this.currentRecordingPromise) {
                // Wait for the recording to complete
                await this.currentRecordingPromise;
                console.log('Recording stopped');
                this.currentRecordingPromise = null;
            }
        } catch (error) {
            console.error('Error stopping recording:', error);
        }
    }

    async getAudioOutputPath(filename) {
        const os = window.require('os');
        const path = window.require('path');
        const fs = window.require('fs').promises;

        let baseDir;
        if (process.platform === 'win32') {
            baseDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Oats');
        } else if (process.platform === 'darwin') {
            baseDir = path.join(os.homedir(), 'Documents', 'Oats');
        } else {
            baseDir = path.join(os.homedir(), 'Documents', 'Oats');
        }

        const timestamp = this.sessionStartTime.toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const sessionDir = path.join(baseDir, 'Sessions', this.participantId, `rst_${timestamp}`);
        
        await fs.mkdir(sessionDir, { recursive: true });

        return path.join(sessionDir, filename);
    }

    endRecallPhase() {
        // Count any remaining unattempted recalls
        const recallButtons = document.querySelectorAll('.recall-button:not([disabled])');
        this.totalRecallsUnattempted += recallButtons.length;
        
        // Clear any remaining intervals
        document.querySelectorAll('.recall-button').forEach(button => {
            if (button.recordingInterval) {
                clearInterval(button.recordingInterval);
                delete button.recordingInterval;
            }
        });
        
        this.advanceToNextBlock();
    }

    advanceToNextBlock() {
        if (this.currentPhase === 'practice') {
            if (this.currentSeries < this.config.parameters.trials.practice_series) {
                if (this.practiceSentences[this.currentSeries]?.[this.currentBlock + 1]) {
                    this.currentBlock++;
                } else {
                    this.currentSeries++;
                    this.currentBlock = 1;
                }
                
                if (this.currentSeries <= this.config.parameters.trials.practice_series) {
                    this.currentSentenceIndex = 0;
                    this.loadCurrentBlock();
                    this.showNextSentence();
                } else {
                    this.showPracticeComplete();
                }
            } else {
                this.showPracticeComplete();
            }
        } else {
            const maxSeries = this.config.parameters.trials.main_series;
            const maxBlock = Math.max(...this.stimulusData
                .filter(item => item.series === this.currentSeries)
                .map(item => item.block));
            
            if (this.currentBlock < maxBlock) {
                this.currentBlock++;
            } else if (this.currentSeries < maxSeries) {
                this.currentSeries++;
                this.currentBlock = 1;
            } else {
                this.showSummaryScreen();
                return;
            }
            
            this.currentSentenceIndex = 0;
            this.loadCurrentBlock();
            
            if (this.currentBlockSentences.length > 0) {
                this.showNextSentence();
            } else {
                this.advanceToNextBlock();
            }
        }
    }

    showPracticeComplete() {
        this.updateStatus('Practice complete');
        
        const content = `
            <h2 style="
                font-size: 24px;
                font-weight: 600;
                color: #212529;
                margin-bottom: 24px;
            ">Practice Complete!</h2>
            
            <div style="
                font-size: 16px;
                line-height: 1.6;
                color: #495057;
                margin-bottom: 32px;
                max-width: 600px;
            ">
                Practice phase completed! Now you'll begin the main task with the same rules.
                Remember to say the final word of each sentence when prompted.
            </div>
            
            <button onclick="window.readingSpanTaskInstance.startMain()" style="
                background-color: #007bff;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.15s ease;
                margin: 8px;
            " onmouseover="this.style.backgroundColor='#0056b3'" onmouseout="this.style.backgroundColor='#007bff'">
                Start Main Task
            </button>
        `;
        
        this.updateContent(content);
    }

    showSummaryScreen() {
        this.updateStatus('Task complete');
        
        const totalSeriesCompleted = this.config.parameters.trials.main_series;

        const content = `
            <h2 style="
                font-size: 24px;
                font-weight: 600;
                color: #28a745;
                margin-bottom: 24px;
            ">Task Complete!</h2>
            
            <div style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 16px;
                margin: 32px 0;
                width: 100%;
                max-width: 500px;
            ">
                ${this.generateStatCards(totalSeriesCompleted)}
            </div>
        `;
        
        this.updateContent(content);
        this.saveResults();
    }

    generateStatCards(totalSeriesCompleted) {
        const stats = [
            { label: 'Series Completed', value: totalSeriesCompleted },
            { label: 'Recalls Attempted', value: this.totalRecallsAttempted },
            { label: 'Recalls Unattempted', value: this.totalRecallsUnattempted }
        ];

        return stats.map(stat => `
            <div style="
                text-align: center;
                padding: 20px 16px;
                border: 1px solid #dee2e6;
                border-radius: 8px;
                background: white;
                transition: all 0.3s ease;
            ">
                <div style="
                    font-size: 28px;
                    font-weight: 600;
                    color: #212529;
                    margin-bottom: 8px;
                ">${stat.value}</div>
                <div style="
                    font-size: 12px;
                    color: #6c757d;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                ">${stat.label}</div>
            </div>
        `).join('');
    }

    async saveResults() {
        try {
            const os = window.require('os');
            const path = window.require('path');
            const fs = window.require('fs').promises;

            let baseDir;
            if (process.platform === 'win32') {
                baseDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Oats');
            } else if (process.platform === 'darwin') {
                baseDir = path.join(os.homedir(), 'Documents', 'Oats');
            } else {
                baseDir = path.join(os.homedir(), 'Documents', 'Oats');
            }

            const timestamp = this.sessionStartTime.toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const sessionDir = path.join(baseDir, 'Sessions', this.participantId, `rst_${timestamp}`);
            
            await fs.mkdir(sessionDir, { recursive: true });

            const resultsPath = path.join(sessionDir, 'results.txt');
            const resultsContent = this.generateResultsContent();
            
            await fs.writeFile(resultsPath, resultsContent, 'utf8');
            
            console.log(`Results saved to: ${resultsPath}`);
        } catch (error) {
            console.error('Error saving results:', error);
        }
    }

    generateResultsContent() {
        let content = '';
        content += '='.repeat(60) + '\n';
        content += '            READING SPAN TASK RESULTS\n';
        content += '='.repeat(60) + '\n\n';

        content += 'SESSION INFORMATION\n';
        content += '-'.repeat(30) + '\n';
        content += `Participant ID: ${this.participantId}\n`;
        content += `Task: Reading Span Task\n`;
        content += `Start Time: ${this.sessionStartTime.toLocaleString()}\n`;
        content += `End Time: ${new Date().toLocaleString()}\n`;
        content += `Audio Recording: Native (sox-based WAV files)\n\n`;

        content += 'TASK CONFIGURATION\n';
        content += '-'.repeat(30) + '\n';
        const params = this.config.parameters;
        content += `Practice Series: ${params.trials.practice_series}\n`;
        content += `Main Series: ${params.trials.main_series}\n`;
        content += `Practice Sentence Duration: ${params.timing.practice_sentence_duration}ms\n`;
        content += `Main Sentence Duration: ${params.timing.main_sentence_duration}ms\n`;
        content += `Recall Time Duration: ${params.timing.recall_time_duration}ms\n`;
        content += `Audio Recording Level: ${params.audio?.recording_level || 50}%\n\n`;

        content += 'PERFORMANCE SUMMARY\n';
        content += '-'.repeat(30) + '\n';
        content += `Total Recalls Attempted: ${this.totalRecallsAttempted}\n`;
        content += `Total Recalls Unattempted: ${this.totalRecallsUnattempted}\n`;
        content += `Total Audio Files Recorded: ${this.results.length}\n\n`;

        content += 'DETAILED RESULTS\n';
        content += '-'.repeat(60) + '\n';
        content += 'Phase     | Series | Block | Target Word    | Audio File\n';
        content += '-'.repeat(60) + '\n';

        for (const result of this.results) {
            const phase = result.phase.padEnd(9);
            const series = result.series.toString().padEnd(6);
            const block = result.block.toString().padEnd(5);
            const target = result.target_word.padEnd(14);
            const audioFile = result.audio_file || 'N/A';

            content += `${phase} | ${series} | ${block} | ${target} | ${audioFile}\n`;
        }

        content += '\n' + '='.repeat(60) + '\n';
        content += 'End of Results\n';
        content += '='.repeat(60) + '\n';

        return content;
    }

    updateContent(html) {
        const contentEl = document.getElementById('reading-span-task-content');
        if (contentEl) {
            contentEl.innerHTML = html;
        }
    }

    updateStatus(status) {
        const statusEl = document.getElementById('reading-span-status-text');
        if (statusEl) {
            statusEl.textContent = status;
        }
    }

    closeTask() {
        // Stop any ongoing recording
        if (this.audioRecorder && this.audioRecorder.isRecording) {
            this.audioRecorder.stopRecording();
        }
        
        // Clear any remaining intervals
        document.querySelectorAll('.recall-button').forEach(button => {
            if (button.recordingInterval) {
                clearInterval(button.recordingInterval);
                delete button.recordingInterval;
            }
        });
        
        if (this.modalOverlay && this.modalOverlay.parentNode) {
            this.modalOverlay.parentNode.removeChild(this.modalOverlay);
        }
        
        this.cleanup();
    }

    cleanup() {
        console.log('Reading Span task cleanup completed');
        window.readingSpanTaskInstance = null;
    }
}

// Global function to load and start the Reading Span task
async function loadReadingSpanTask(participantId) {
    try {
        console.log('Loading Reading Span task for participant:', participantId);
        
        window.readingSpanTaskInstance = new ReadingSpanTask(participantId);
        await window.readingSpanTaskInstance.init();
        
    } catch (error) {
        console.error('Error loading Reading Span task:', error);
        alert('Error loading Reading Span task. Please check the configuration and try again.');
    }
}

window.loadReadingSpanTask = loadReadingSpanTask;