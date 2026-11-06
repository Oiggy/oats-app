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
        this.sentenceLog = [];          // reading time per sentence
        this.sentenceAdvanceCleanup = null;
        this.sessionStartTime = new Date();
        
        // Initialize NativeAudioRecorder - will be loaded in init()
        this.audioRecorder = null;
        this.isAudioSetup = false;
        this.currentRecordingPromise = null;
        
        // Hardcoded practice sentences
        this.practiceSentences = {
            1: {
                1: [
                    { sentence: "Of course it was expensive, but he was very happy with his beautiful new car.", target: "car" },
                    { sentence: "Five minutes before the end of the match, the referee gave the deciding penalty.", target: "penalty" }
                ],
                2: [
                    { sentence: "When the famous artists were ready, they made a new appointment for next Friday.", target: "Friday" },
                    { sentence: "His neighbors never understood how it was possible that he had so much fortune.", target: "fortune" },
                    { sentence: "The only way the police could stop the bank robbery was by killing the two men.", target: "men" }
                ]
            }
        };
        
        this.totalRecallsAttempted = 0;
        this.totalRecallsUnattempted = 0;

        // Modal elements
        this.modalOverlay = null;
        this.modalContent = null;

        // Pending sentence timers, so closing the task stops it
        this.timers = new Set();
        this.closed = false;
        this.resultsSaved = false;
    }

    // setTimeout that is cancelled when the task closes
    later(fn, ms) {
        const id = setTimeout(() => {
            this.timers.delete(id);
            if (!this.closed) fn();
        }, ms);
        this.timers.add(id);
        return id;
    }

    async init() {
        try {
            // Load NativeAudioRecorder class first
            const path = window.require('path');
            const { app } = window.require('@electron/remote') || window.require('electron').remote;
            const appPath = app.getAppPath();
            
            const NativeAudioRecorder = window.require(path.join(appPath, 'src', 'renderer', 'tasks', 'reading_span', 'native_audio_recorder.js'));
            this.audioRecorder = new NativeAudioRecorder();
            
            await this.loadConfiguration();
            await this.loadStimulusData();
            await this.setupAudioPermissions();
            this.createTaskModal();
            this.showWelcomeScreen();
        } catch (error) {
            console.error('Error initializing Reading Span task:', error);
            const reason = error && error.code === 'ENOENT' && /cfg_reading_span_task/.test(error.message)
                ? 'No saved configuration. Open Task Configuration and save it first.'
                : (error && error.message) || String(error);
            oatsDialog.alert(`Error loading Reading Span task:\n\n${reason}`);
            this.closeTask(false);
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
        
        const { app } = window.require('@electron/remote') || window.require('electron').remote;
        const stimulusPath = path.join(app.getAppPath(), 'src', 'renderer', 'tasks', 'reading_span', 'Sentence Dictionary.csv');
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

            // With ASIO the interface is already running and recording works;
            // a silent second at load (no one speaking yet, or the microphone
            // not plugged in yet) must not stop the task from opening. The
            // Test Microphone button checks for sound.
            if (this.audioRecorder.usesAsio()) {
                this.isAudioSetup = true;
                console.log('Recording through ASIO:', this.audioRecorder.describeBackend());
                return;
            }
            
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
            min-height: min(600px, 90vh);
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
                <button onclick="window.readingSpanTaskInstance.requestClose()" style="
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
                    justify-content: safe center;
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
                    <li>Sentences will appear on the screen one at a time. Read each sentence aloud.</li>
                    <li>After reading a sentence, press the SPACE BAR and the next sentence will appear.</li>
                    <li>After a different number of sentences (2, 3, 4, 5 or 6), the word "Recall" will appear on the screen.</li>
                    <li>When you see "Recall", say the last word of every sentence you have just read. You can say the words in any order.</li>
                    <li>Click a recall button before saying each word, and click it again when you are done.</li>
                    <li>Try to read the sentences as fast as possible while reading for content.</li>
                </ul>
                <p style="margin-top: 12px;">We will start with a few practice trials.</p>
                
                <p style="margin-top: 20px;"><strong>Audio Recording:</strong></p>
                <ul style="margin-left: 20px;">
                    <li>This task uses native audio recording</li>
                    <li>Your responses will be recorded as WAV files</li>
                    <li>Please ensure your microphone is working properly</li>
                </ul>
            </div>
            
            <button onclick="window.readingSpanTaskInstance.testMicrophone(this)" style="
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

    async testMicrophone(testBtn) {
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
        
        // The sentence stays up for at most `duration`; the participant can
        // move on earlier with SPACE (or a click), as in the original
        // E-Prime test. Whichever comes first advances, exactly once.
        const shownAt = performance.now();
        let done = false;
        const advance = (endedBy) => {
            if (done || this.closed) return;
            done = true;
            clearTimeout(timerId);
            this.timers.delete(timerId);
            this.removeSentenceAdvanceListeners();
            this.sentenceLog.push({
                phase: this.currentPhase,
                series: this.currentSeries,
                block: this.currentBlock,
                position: this.currentSentenceIndex + 1,
                target_word: sentence.target,
                reading_time_ms: Math.round(performance.now() - shownAt),
                ended_by: endedBy
            });
            this.currentSentenceIndex++;
            this.showNextSentence();
        };
        const timerId = this.later(() => advance('timeout'), duration);
        // Ignore SPACE/clicks in the first moments so a double tap can't
        // skip the next sentence unseen.
        const MIN_VISIBLE_MS = 300;
        this.addSentenceAdvanceListeners((endedBy) => {
            if (performance.now() - shownAt >= MIN_VISIBLE_MS) advance(endedBy);
        });
    }

    // SPACE or a click on the task area ends the current sentence early
    addSentenceAdvanceListeners(advance) {
        this.removeSentenceAdvanceListeners();
        // A button clicked to start the phase may still have focus; SPACE
        // would "click" it again, so drop focus first.
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }
        const onKey = (e) => {
            if (e.code !== 'Space' || e.repeat) return;
            e.preventDefault();
            advance('space');
        };
        const contentEl = document.getElementById('reading-span-task-content');
        const onClick = () => advance('click');
        document.addEventListener('keydown', onKey, true);
        if (contentEl) contentEl.addEventListener('click', onClick);
        this.sentenceAdvanceCleanup = () => {
            document.removeEventListener('keydown', onKey, true);
            if (contentEl) contentEl.removeEventListener('click', onClick);
        };
    }

    removeSentenceAdvanceListeners() {
        if (this.sentenceAdvanceCleanup) {
            this.sentenceAdvanceCleanup();
            this.sentenceAdvanceCleanup = null;
        }
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
            ">Recall</h3>
            
            <div style="
                font-size: 14px;
                color: #6c757d;
                margin-bottom: 24px;
            ">
                ${this.currentPhase === 'practice' 
                    ? 'Say the last word of each sentence you just read, in any order. Click a button before each word and again when you are done (practice: nothing is recorded).'
                    : `Say the last word of each sentence you just read, in any order. Click a button before each word (up to ${this.config.parameters.timing.recall_time_duration / 1000}s each) and again when you are done.`
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
        // (sox only: the ASIO interface is already running, so there is
        // nothing to warm up and the buttons work straight away)
        if (this.currentPhase === 'main' && !this.audioRecorder.usesAsio()) {
            // Buttons can't be used until the microphone is ready
            document.querySelectorAll('.recall-button').forEach((btn) => { btn.style.pointerEvents = 'none'; btn.style.opacity = '0.5'; });
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
            
            document.querySelectorAll('.recall-button').forEach((btn) => { btn.style.pointerEvents = ''; btn.style.opacity = ''; });
        }
        if (this.closed) return;
        if (this.currentPhase === 'main') {
            // Update timer display to show ready state
            const timerDisplay = document.getElementById('recall-timer-display');
            if (timerDisplay) {
                timerDisplay.innerHTML = 'Click a recall button to start recording, and again when you are done';
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
        
        // Clicking the active button again ends this recall early
        if (button.classList.contains('recording')) {
            this.finishIndividualRecording(button, targetWord, isMainPhase, index, 'stopped');
            return;
        }
        // Ignore completed buttons, and clicks while this one is starting
        if (button.disabled || button.dataset.starting) {
            return;
        }
        button.dataset.starting = '1';
        
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
            button.resultEntry = await this.startRecording(targetWord, true);
            if (this.closed) return;
            button.classList.add('recording');
            button.innerHTML = `<span style="font-size: 16px;">⏹</span> Done ${index + 1}`;
            button.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
        } else {
            // Practice phase - just show active state without recording
            button.classList.add('recording');
            button.innerHTML = `<span style="font-size: 16px;">⏹</span> Done ${index + 1}`;
            button.style.background = 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)';
        }
        button.recallStartedAt = performance.now();
        delete button.dataset.starting;
        
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
                    <span style="color: #6c757d; margin-left: 12px;">(click Done ${index + 1} when finished)</span>
                `;
                
                if (remaining <= 5) {
                    timerDisplay.style.background = '#fff3cd';
                    timerDisplay.style.borderColor = '#ffc107';
                }
            }
        };
        
        updateTimer();
        
        const interval = setInterval(() => {
            if (this.closed) { clearInterval(interval); return; }
            remaining--;
            updateTimer();

            if (remaining <= 0) {
                clearInterval(interval);
                this.finishIndividualRecording(button, targetWord, isMainPhase, index, 'timeout');
            }
        }, 1000);
        
        // Store interval on button for potential cleanup
        button.recordingInterval = interval;
    }

    async finishIndividualRecording(button, targetWord, isMainPhase, index, endedBy = 'timeout') {
        // Runs once per button, whether the time ran out or Done was clicked
        if (button.dataset.finishing) return;
        button.dataset.finishing = '1';

        // Stop the countdown right away so it can't fire during the stop
        if (button.recordingInterval) {
            clearInterval(button.recordingInterval);
            delete button.recordingInterval;
        }

        const recallMs = button.recallStartedAt != null
            ? Math.round(performance.now() - button.recallStartedAt)
            : null;

        // Stop recording (early if Done was clicked)
        if (isMainPhase && endedBy === 'stopped') {
            await this.audioRecorder.stopEarly();
        }
        await this.stopRecording();
        if (this.closed) return;

        if (button.resultEntry) {
            button.resultEntry.recall_duration_ms = recallMs;
            button.resultEntry.ended_by = endedBy;
        }
        
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
        
        // Only main-phase recalls are recorded and scored
        if (isMainPhase) this.totalRecallsAttempted++;
        
        // Check if this phase is complete
        this.later(() => {
            this.checkRecallCompletion();
        }, 1000);
    }

    checkRecallCompletion() {
        const activeButtons = document.querySelectorAll('.recall-button:not([disabled])');
        
        if (activeButtons.length === 0) {
            // All buttons completed, end recall phase
            this.later(() => {
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
                const entry = {
                    phase: this.currentPhase,
                    series: this.currentSeries,
                    block: this.currentBlock,
                    target_word: targetWord,
                    audio_file: filename,
                    timestamp: new Date().toISOString()
                };
                this.results.push(entry);
                return entry;
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
        const { app } = window.require('@electron/remote') || window.require('electron').remote;
        const { getTaskRunDir } = window.require(path.join(app.getAppPath(), 'src', 'shared', 'storage', 'participant-storage.js'));

        // <participant>/readingspantask_<run start>/ (recordings and results)
        const sessionDir = getTaskRunDir(this.participantId, 'reading-span', this.sessionStartTime);

        return path.join(sessionDir, filename);
    }

    endRecallPhase() {
        // Count any remaining unattempted recalls
        const recallButtons = document.querySelectorAll('.recall-button:not([disabled])');
        if (this.currentPhase === 'main') this.totalRecallsUnattempted += recallButtons.length;
        
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
            // Next block of this practice series, else the next series
            if (this.practiceSentences[this.currentSeries]?.[this.currentBlock + 1]) {
                this.currentBlock++;
            } else if (this.currentSeries < this.config.parameters.trials.practice_series &&
                       this.practiceSentences[this.currentSeries + 1]) {
                this.currentSeries++;
                this.currentBlock = 1;
            } else {
                this.showPracticeComplete();
                return;
            }
            this.currentSentenceIndex = 0;
            this.loadCurrentBlock();
            this.showNextSentence();
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
                The main task works the same way: read each sentence aloud, press the SPACE BAR
                for the next one, and when "Recall" appears, say the last word of every sentence
                you have just read, in any order.
                <br><br>
                If you have any questions about the task, please ask the experimenter now.
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
        this.saveResults(true);
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

    async saveResults(complete) {
        if (this.resultsSaved) return;
        this.resultsSaved = true;
        this.completedRun = !!complete;
        try {
            const os = window.require('os');
            const path = window.require('path');
            const fs = window.require('fs').promises;
            const { app } = window.require('@electron/remote') || window.require('electron').remote;
            const { getTaskRunDir } = window.require(path.join(app.getAppPath(), 'src', 'shared', 'storage', 'participant-storage.js'));

            // <participant>/readingspantask_<run start>/ (recordings and results)
            const sessionDir = getTaskRunDir(this.participantId, 'reading-span', this.sessionStartTime);

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
        content += `App Version: ${globalThis.oatsAppInfo?.line() ?? 'unknown'}\n`;
        content += `Audio Backend: ${this.audioRecorder ? this.audioRecorder.describeBackend() : 'unknown'}\n`;
        content += `Task: Reading Span Task\n`;
        content += `Start Time: ${this.sessionStartTime.toLocaleString()}\n`;
        content += `End Time: ${new Date().toLocaleString()}\n`;
        content += `Audio Recording: one WAV file per recall\n`;
        if (!this.completedRun) content += `NOTE: task closed before the end (incomplete run)\n`;
        content += `\n`;

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
        content += 'Phase     | Series | Block | Target Word    | Recall ms | Ended By | Audio File\n';
        content += '-'.repeat(60) + '\n';

        for (const result of this.results) {
            const phase = result.phase.padEnd(9);
            const series = result.series.toString().padEnd(6);
            const block = result.block.toString().padEnd(5);
            const target = result.target_word.padEnd(14);
            const audioFile = result.audio_file || 'N/A';
            const recallMs = String(result.recall_duration_ms ?? 'N/A').padEnd(9);
            const endedBy = String(result.ended_by ?? 'N/A').padEnd(8);

            content += `${phase} | ${series} | ${block} | ${target} | ${recallMs} | ${endedBy} | ${audioFile}\n`;
        }

        const mainReading = this.sentenceLog.filter((r) => r.phase === 'main');
        if (mainReading.length) {
            content += '\nSENTENCE READING TIMES (main phase)\n';
            content += '-'.repeat(60) + '\n';
            content += 'Series | Block | Pos | Target Word    | Reading ms | Ended By\n';
            content += '-'.repeat(60) + '\n';
            for (const r of mainReading) {
                content += `${String(r.series).padEnd(6)} | ${String(r.block).padEnd(5)} | ${String(r.position).padEnd(3)} | ${r.target_word.padEnd(14)} | ${String(r.reading_time_ms).padEnd(10)} | ${r.ended_by}\n`;
            }
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

    // The ✕ button: confirm before abandoning a run in progress
    async requestClose() {
        const running = this.currentPhase === 'practice' || this.currentPhase === 'main';
        if (running && !this.resultsSaved) {
            const close = await oatsDialog.confirm('The run will stop. Recordings made so far are kept.', { title: 'Close the Reading Span task?', okText: 'Close task', danger: true });
            if (!close || this.closed) return;
        }
        this.closeTask(true);
    }

    closeTask(savePartial = true) {
        this.closed = true;
        this.timers.forEach((id) => clearTimeout(id));
        this.timers.clear();
        this.removeSentenceAdvanceListeners();

        // Keep what was recorded in the main phase
        if (savePartial && this.currentPhase === 'main' && this.results.length && !this.resultsSaved) {
            this.saveResults(false);
        }

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
        if (window.readingSpanTaskInstance === this) window.readingSpanTaskInstance = null;
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
        oatsDialog.alert(`Error loading Reading Span task:\n\n${error.message || error}`);
    }
}

window.loadReadingSpanTask = loadReadingSpanTask;