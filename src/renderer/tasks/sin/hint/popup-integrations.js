class HINTTask {
    constructor(participantId) {
        this.participantId = participantId;
        this.config = null;
        this.audioContext = null;
        this.audioBuffers = {};
        this.asioEngine = null;
        this.currentSource = null;
        
        // Task state
        this.currentPage = 'instruction';
        this.currentIndex = 0;
        this.csvData = [];
        this.audioFiles = [];
        this.totalItems = 0;
        
        // Keyword tracking
        this.keywordStates = {};
        
        // Response timer
        this.responseTimer = null;
        this.responseMs = 0;
        this.responseRunning = false;
        
        // UI elements
        this.modalOverlay = null;
        this.modalContent = null;
        this.keywordCheckboxes = [];
        
        // Save tracking
        this.resultsSaved = false;

        // SNR selection
        this.selectedStartSNR = 25;

        // Adaptive half-step SNR (set when a full SNR level scores <50%)
        this.halfStepSNR = null;

        // Recording
        this.mediaRecorder = null;
        this.recordingChunks = [];
        this.isRecording = false;
        this.currentTake = 0;
        this.runStart = new Date(); // names the run folder (results and recordings)
    }

    async init() {
        try {
            this.loadAsioEngine();
            await this.loadConfiguration();
            await this.initializeAudioContext();
            await this.loadCSVData();
            await this.loadAudioFiles();
            this.createTaskModal();
            this.showInstructionPage();
        } catch (error) {
            console.error('Error initializing HINT task:', error);
            const reason = error && error.code === 'ENOENT' && /cfg_.*_task\.json/.test(error.message)
                ? 'No saved configuration. Open Task Configuration and save it first.'
                : (error && error.message) || String(error);
            oatsDialog.alert(`Failed to open the task:\n\n${reason}`);
        }
    }

    async loadConfiguration() {
        const os = window.require('os');
        const path = window.require('path');
        const fs = window.require('fs').promises;
        
        let baseDir;
        if (process.platform === 'win32') {
            baseDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Oats', 'task-configurations');
        } else {
            baseDir = path.join(os.homedir(), 'Documents', 'Oats', 'task-configurations');
        }
        
        const configPath = path.join(baseDir, 'cfg_hint_task.json');
        const configData = await fs.readFile(configPath, 'utf8');
        this.config = JSON.parse(configData);
        
        console.log('HINT Configuration loaded:', this.config);
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

    audioCheckHTML() {
        try {
            return this.getAudioCheck().html({
                buttonClass: 'task-btn task-btn-secondary',
                caption: 'For the tester: checks each audio output with a beep before you start'
            });
        } catch (error) {
            console.error('Audio check unavailable:', error);
            return '';
        }
    }

    async testAudio() {
        try {
            this.audioCheck = await this.getAudioCheck().run({
                engine: this.asioEngine,
                volume: this.config.parameters.audio.volume,
                button: document.getElementById('audio-check-btn'),
                resultEl: document.getElementById('audio-check-result'),
                revealAfter: this.modalContent ? this.modalContent.querySelector('.instruction-buttons') : null
            });
        } catch (error) {
            console.error('Audio test failed:', error);
        }
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

    async loadCSVData() {
        const path = window.require('path');
        const fs = window.require('fs').promises;
        const { app } = window.require('@electron/remote') || window.require('electron').remote;
        
        const appPath = app.getAppPath();
        const csvPath = path.join(appPath, 'src', 'renderer', 'tasks', 'sin', 'hint', 'hint_list.csv');
        
        try {
            const csvContent = await fs.readFile(csvPath, 'utf8');
            this.csvData = this.parseCSV(csvContent);
            console.log('CSV data loaded:', this.csvData.length, 'rows');
        } catch (error) {
            console.error('Error loading CSV:', error);
            this.csvData = [];
        }
    }

    parseCSV(content) {
        const lines = content.trim().split('\n');
        if (lines.length < 2) return [];
        
        // Proper CSV parsing function that handles quoted fields
        function parseCSVLine(line) {
            const result = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];
                
                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            
            result.push(current.trim());
            return result;
        }
        
        const headers = parseCSVLine(lines[0]);
        console.log('CSV Headers:', headers);
        
        const rows = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            const row = {};
            
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            
            // Ensure Correct Key Words exists
            if (!row['Correct Key Words']) {
                row['Correct Key Words'] = '';
            }
            
            rows.push(row);
            
            if (i <= 3) {
                console.log(`Row ${i}:`, row);
            }
        }
        
        return rows;
    }


    async loadAudioFiles() {
        const path = window.require('path');
        const fs = window.require('fs').promises;
        const { app } = window.require('@electron/remote') || window.require('electron').remote;
        
        const appPath = app.getAppPath();
        const audioDir = path.join(appPath, 'src', 'renderer', 'tasks', 'sin', 'hint', 'HINT_audio');
        
        try {
            this.audioFiles = this.csvData.map(row => {
                const snrRaw = row['SNR'];
                let snrFolder;
                if (snrRaw === 'half') {
                    // Placeholder — real folder resolved at playback time via this.halfStepSNR
                    snrFolder = 'SNR_HALF_PLACEHOLDER';
                } else {
                    const snrValue = parseFloat(snrRaw);
                    snrFolder = this.snrToFolder(snrValue);
                }
                const list = String(row['List Number']).padStart(2, '0');
                const sentence = String(row['Sentence Number']).padStart(2, '0');
                return path.join(audioDir, snrFolder, `L${list}_S${sentence}_mix.wav`);
            });
            
            console.log('Audio files found:', this.audioFiles.length);
            
            // Preload audio buffers (skip half-step placeholders — loaded on demand)
            for (const filePath of this.audioFiles) {
                if (filePath.includes('SNR_HALF_PLACEHOLDER')) continue;
                await this.loadAudioBuffer(filePath);
            }
        } catch (error) {
            console.error('Error loading audio files:', error);
        }
        
        this.totalItems = Math.min(this.csvData.length, this.audioFiles.length);
    }

    snrToFolder(snrValue) {
        if (snrValue === -5) return 'SNR-05';
        if (snrValue < 0) return `SNR-${Math.abs(snrValue)}`;
        // Half-steps like 2.5, 7.5, 12.5, 17.5, 22.5 keep their decimal
        if (!Number.isInteger(snrValue)) return `SNR${snrValue}`;
        return `SNR${String(snrValue).padStart(2, '0')}`;
    }

    // Returns the real audio path for the current index, resolving 'half' rows
    getAudioPath(index) {
        const path = window.require('path');
        const { app } = window.require('@electron/remote') || window.require('electron').remote;
        const audioDir = path.join(app.getAppPath(), 'src', 'renderer', 'tasks', 'sin', 'hint', 'HINT_audio');
        const row = this.csvData[index];
        const list = String(row['List Number']).padStart(2, '0');
        const sentence = String(row['Sentence Number']).padStart(2, '0');
        const snrRaw = row['SNR'];
        const snrFolder = snrRaw === 'half'
            ? this.snrToFolder(this.halfStepSNR)
            : this.snrToFolder(parseFloat(snrRaw));
        return path.join(audioDir, snrFolder, `L${list}_S${sentence}_mix.wav`);
    }

    extractFirstNumber(str) {
        const match = str.match(/\d+/);
        return match ? parseInt(match[0]) : Infinity;
    }

    async loadAudioBuffer(filePath) {
        const fs = window.require('fs').promises;
        
        try {
            const audioData = await fs.readFile(filePath);
            const arrayBuffer = audioData.buffer.slice(
                audioData.byteOffset,
                audioData.byteOffset + audioData.byteLength
            );
            
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.audioBuffers[filePath] = audioBuffer;
        } catch (error) {
            console.error(`Error loading audio buffer for ${filePath}:`, error);
        }
    }

    createTaskModal() {
        this.modalOverlay = document.createElement('div');
        this.modalOverlay.className = 'task-modal-overlay';
        
        this.modalContent = document.createElement('div');
        this.modalContent.className = 'task-modal-content hint-modal';
        
        this.modalOverlay.appendChild(this.modalContent);
        document.body.appendChild(this.modalOverlay);
    }

    showInstructionPage() {
        this.currentPage = 'instruction';
        
        const instructionText = `Read this to the participant:

            In this task, you will hear sentences spoken in background noise.
            After each sentence, please repeat back exactly what you heard.`;
        
        const snrLevels = [25, 20, 15, 10, 5, 0, -5];
        const halfLevels = [22.5, 17.5, 12.5, 7.5, 2.5, -2.5];
        this.modalContent.innerHTML = `
            <div class="hint-instruction-page">
                <div class="instruction-content">
                    <h1 class="task-title">HINT</h1>

                    <div class="instruction-text">${instructionText.split('\n').map((line) => line.trim().replace(/ {2,}/g, ' ')).join('\n').trim()}</div>

                    ${this.audioCheckHTML()}

                    <div class="snr-selector">
                        <label class="snr-selector-label">Start at SNR (dB):</label>
                        <div class="snr-selector-buttons" id="snr-selector-buttons">
                            ${snrLevels.map(s => `<button class="snr-select-btn${s === this.selectedStartSNR ? ' active' : ''}" data-snr="${s}">${s}</button>`).join('')}
                        </div>
                    </div>

                    <div class="instruction-buttons">
                        <button class="task-btn task-btn-secondary" id="back-to-main-btn">
                            Main Menu
                        </button>
                        <button class="task-btn task-btn-secondary" id="view-results-btn" style="display:none">
                            View Results
                        </button>
                        <button class="task-btn task-btn-primary" id="start-hint-btn">
                            Start
                        </button>
                    </div>
                </div>
            </div>
        `;

        const audioCheckBtn = document.getElementById('audio-check-btn');
        if (audioCheckBtn) audioCheckBtn.addEventListener('click', () => this.testAudio());

        document.getElementById('back-to-main-btn').addEventListener('click', () => {
            if (this.taskStarted) this.saveResults();
            this.closeTask();
        });

        document.getElementById('view-results-btn').addEventListener('click', () => this.showResultsPage());

        // Show "View Results" button only if HINT task has been completed
        (async () => {
            try {
                const path = window.require('path');
                const fs = window.require('fs').promises;
                const { app } = window.require('@electron/remote') || window.require('electron').remote;
                const { getParticipantDir, isTaskRunFolder } = window.require(path.join(app.getAppPath(), 'src', 'shared', 'storage', 'participant-storage.js'));
                const participantDir = getParticipantDir(this.participantId);
                const entries = await fs.readdir(participantDir);
                const done = entries.some(e => isTaskRunFolder(e, 'hint'));
                if (done) {
                    const btn = document.getElementById('view-results-btn');
                    if (btn) btn.style.display = '';
                }
            } catch (_) {}
        })();

        document.querySelectorAll('.snr-select-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.snr-select-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedStartSNR = parseInt(btn.dataset.snr);
            });
        });

        document.getElementById('start-hint-btn').addEventListener('click', () => {
            if (this.totalItems === 0) {
                oatsDialog.alert('No audio/CSV items found.');
                return;
            }
            const startIndex = this.csvData.findIndex(row => String(row['SNR']) === String(this.selectedStartSNR));
            this.currentIndex = startIndex >= 0 ? startIndex : 0;
            this.showPlayerPage();
        });
    }

    // Built-in sentence practice: hides this task, runs the practice items at this
    // task's volume, then comes back to the instruction page.
    showPlayerPage() {
        this.taskStarted = true;
        this.currentPage = 'player';
        
        const snrLevels = [25, 20, 15, 10, 5, 0, -5];
        const snrJumpLevels = [25, 20, 15, 10, 5, 0, -5];
        this.modalContent.innerHTML = `
            <div class="hint-player-page">
                <div class="player-content">
                    <h1 class="task-title">HINT</h1>

                    <div class="snr-jump-row" id="snr-jump-row">
                        ${snrJumpLevels.map(s => `<button class="snr-jump-btn" data-snr="${s}">${s}</button>`).join('')}
                        <button class="snr-jump-btn" data-snr="half">half</button>
                    </div>

                    <div class="top-row">
                        <div class="left-col">
                            <div class="snr-summary" id="snr-summary"></div>
                        </div>
                    </div>
                    
                    <div class="item-counter" id="item-counter">
                        Item 1 of ${this.totalItems}
                    </div>
                    
                    <div class="snr-label" id="snr-label">SNR: —</div>
                    
                    <div class="sentence-display" id="sentence-display">
                        ${this.csvData[0]['Sentence '] || this.csvData[0]['Sentence'] || '—'}
                    </div>
                    
                    <div class="keywords-container" id="keywords-container">
                        <div class="keywords-header">
                            <h3>Key Words</h3>
                            <button class="select-all-btn" id="select-all-btn">Select All</button>
                        </div>
                        <div class="keywords-grid" id="keywords-grid"></div>
                    </div>
                    
                    <!-- <div class="skip-hint" id="skip-hint" style="display: none; color: red; font-weight: bold; text-align: center; margin: 4px 0;">
                        ⚠ Low score — you may stop the task if needed
                    </div> -->

                    <div class="recording-indicator" id="recording-indicator" style="display:none; color: red; font-weight: bold; text-align: center;">
                        ● Recording
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
                        <button class="control-btn" id="next-btn">Play Next</button>
                    </div>
                    
                    <div class="bottom-controls">
                        <button class="task-btn task-btn-secondary" id="main-menu-btn">
                            Main Menu
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('back-btn').addEventListener('click', () => this.handleBack());
        document.getElementById('play-btn').addEventListener('click', () => this.handlePlay());
        document.getElementById('stop-btn').addEventListener('click', () => this.handleStop());
        document.getElementById('next-btn').addEventListener('click', () => this.handleNext());
        document.getElementById('main-menu-btn').addEventListener('click', async () => {
            await this.stopAndSaveRecording();
            this.saveResults();
            this.closeTask();
        });
        document.getElementById('select-all-btn').addEventListener('click', () => this.selectAllKeywords());

        document.querySelectorAll('.snr-jump-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.dataset.snr;
                if (val === 'half') this.jumpToHalf();
                else this.jumpToSNR(parseFloat(val));
            });
        });

        this.refreshPlayerUI();
    }

    updateSNRJumpButtons() {
        const currentSNR = String(this.csvData[this.currentIndex]['SNR']);
        document.querySelectorAll('.snr-jump-btn').forEach(btn => {
            const match = btn.dataset.snr === currentSNR ||
                (currentSNR === 'half' && btn.dataset.snr === 'half');
            btn.classList.toggle('active', match);
            // Half-step items play only once a level has triggered the half-step
            if (btn.dataset.snr === 'half') {
                btn.disabled = this.halfStepSNR === null;
                btn.title = btn.disabled ? 'Available once a level scores below 50%' : '';
            }
        });
    }

    jumpToSNR(snr) {
        const index = this.csvData.findIndex(row => String(row['SNR']) === String(snr));
        if (index < 0) return;
        this.saveKeywordStates();
        this.stopResponseTimer();
        this.stopAudio();
        this.currentIndex = index;
        this.refreshPlayerUI();
    }

    jumpToHalf() {
        const index = this.csvData.findIndex(row => row['SNR'] === 'half');
        if (index < 0 || this.halfStepSNR === null) return;
        this.saveKeywordStates();
        this.stopResponseTimer();
        this.stopAudio();
        this.currentIndex = index;
        this.refreshPlayerUI();
    }

    refreshPlayerUI() {
        if (this.totalItems === 0) return;

        const row = this.csvData[this.currentIndex];

        // Update counter
        const sentenceNum = row['Sentence Number'] || '';
        const totalInList = this.csvData.filter(r => r['SNR'] === row['SNR']).length;
        document.getElementById('item-counter').textContent =
            `Sentence ${sentenceNum} of ${totalInList}`;

        // Update SNR
        const snr = row['SNR'] || '';
        const snrDisplay = snr === 'half'
            ? (this.halfStepSNR !== null ? `${this.halfStepSNR} (half-step)` : 'half-step (SNR TBD)')
            : snr;
        const snrText = snrDisplay ? `SNR: ${snrDisplay} dB` : 'SNR: — dB';
        document.getElementById('snr-label').textContent = snrText;

        // Update sentence (handle both "Sentence" and "Sentence " with trailing space)
        const sentence = row['Sentence '] || row['Sentence'] || '—';
        document.getElementById('sentence-display').textContent = sentence;

        // Build keywords
        this.buildKeywordsArea(row['Key Words'] || '');

        // Reset take counter for new item
        this.currentTake = 0;

        // Update SNR summary, skip hint, and jump buttons
        this.updateSNRSummary();
        this.updateSkipHint();
        this.updateSNRJumpButtons();

        this.stopAudio();
        this.resetResponseTimer();
    }

    buildKeywordsArea(keywordsText) {
        const keywords = this.parseKeywords(keywordsText);
        const grid = document.getElementById('keywords-grid');
        
        if (!grid) {
            console.error('Keywords grid element not found');
            return;
        }
        
        grid.innerHTML = '';
        this.keywordCheckboxes = [];
        grid.style.gridTemplateColumns = keywords.length > 4 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)';

        if (keywords.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #999; font-size: 12px;">No keywords for this item</div>';
            return;
        }
        
        keywords.forEach(keyword => {
            const label = document.createElement('label');
            label.className = 'keyword-checkbox';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = keyword;
            
            checkbox.addEventListener('change', () => {
                this.saveKeywordStates();
                this.updateSNRSummary();
                this.updateSkipHint();
            });
            
            const span = document.createElement('span');
            span.textContent = keyword;
            
            label.appendChild(checkbox);
            label.appendChild(span);
            grid.appendChild(label);
            
            this.keywordCheckboxes.push(checkbox);
        });
        
        // Restore previous state if exists
        this.restoreKeywordStates();
    }

    parseKeywords(keywordsText) {
        if (!keywordsText || typeof keywordsText !== 'string') {
            return [];
        }
        
        // Remove any remaining quotes from the field
        keywordsText = keywordsText.replace(/^["']|["']$/g, '');
        
        return keywordsText
            .split(/[,;]/)
            .map(kw => kw.trim())
            .filter(kw => kw.length > 0);
    }

    saveKeywordStates() {
        this.keywordStates[this.currentIndex] = this.keywordCheckboxes.map(cb => cb.checked);
        
        // Update Correct Key Words in csvData
        const checkedKeywords = this.keywordCheckboxes
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        
        this.csvData[this.currentIndex]['Correct Key Words'] = checkedKeywords.join(', ');
    }

    restoreKeywordStates() {
        const savedStates = this.keywordStates[this.currentIndex];
        if (savedStates && savedStates.length === this.keywordCheckboxes.length) {
            this.keywordCheckboxes.forEach((cb, i) => {
                cb.checked = savedStates[i];
            });
        }
    }

    selectAllKeywords() {
        this.keywordCheckboxes.forEach(cb => cb.checked = true);
        this.saveKeywordStates();
        this.updateSNRSummary();
    }

    updateSNRSummary() {
        const summaryDiv = document.getElementById('snr-summary');
        if (!summaryDiv) return;

        const snrOrder = [25, 20, 15, 10, 5, 0, -5, 'half'];
        const snrCounts = {};
        snrOrder.forEach(snr => { snrCounts[snr] = { total: 0, correct: 0 }; });

        // Calculate counts up to current index (inclusive)
        for (let i = 0; i <= this.currentIndex; i++) {
            if (i < this.currentIndex && !this.isScored(i)) continue;
            const row = this.csvData[i];
            const snr = row['SNR'] === 'half' ? 'half' : Number(row['SNR']);
            if (!(snr in snrCounts)) continue;

            const totalKeywords = this.parseKeywords(row['Key Words'] || '').length;
            let correctKeywords;

            if (i < this.currentIndex) {
                correctKeywords = this.parseKeywords(row['Correct Key Words'] || '').length;
            } else {
                correctKeywords = this.keywordCheckboxes.filter(cb => cb.checked).length;
            }

            snrCounts[snr].total += totalKeywords;
            snrCounts[snr].correct += correctKeywords;
        }

        // Build summary text — show all levels from the start
        const lines = snrOrder.map(snr => {
            const { total, correct } = snrCounts[snr];
            const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
            return `SNR ${snr}: ${correct}/${total} (${percent}%)`;
        });

        summaryDiv.innerHTML = lines.map((line) => `<span>${line}</span>`).join('');
    }

    updateSkipHint() {
        // Low score warning disabled
    }

    async handleBack() {
        this.saveKeywordStates();
        this.stopResponseTimer();
        await this.stopAndSaveRecording();

        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.refreshPlayerUI();
        } else {
            this.stopAudio();
            this.saveResults();
            this.showInstructionPage();
        }
    }

    async handlePlay() {
        if (this.totalItems === 0) return;

        this.resetResponseTimer();
        this.updateStatus('Playing…');

        if (this.isRecording) {
            await this.stopAndSaveRecording();
        }
        this.startRecording();

        const audioPath = this.getAudioPath(this.currentIndex);
        // Load on demand for half-step rows (not preloaded)
        if (!this.audioBuffers[audioPath]) {
            await this.loadAudioBuffer(audioPath);
        }

        if (this.asioEngine && this.asioEngine.isEnabled()) {
            this.asioEngine.clearOutputQueue();
            const playId = (this.playId = (this.playId || 0) + 1);
            this.asioEngine.playFile(audioPath, this.config.parameters.audio.volume)
                .then((timing) => {
                    if (playId !== this.playId || timing.cancelled) return; // stopped or replaced
                    this.takeStimulusTiming = timing;
                    this.updateStatus('Audio finished ✓');
                    this.startResponseTimer();
                })
                .catch((error) => {
                    console.error('ASIO playback error:', error);
                    if (playId !== this.playId) return;
                    this.updateStatus(`⚠ Playback failed: ${error.message}`);
                });
            return;
        }

        const audioBuffer = this.audioBuffers[audioPath];

        if (!audioBuffer) {
            console.error('Audio buffer not found for:', audioPath);
            this.updateStatus('Error: Audio not loaded');
            return;
        }

        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {}
        }

        this.currentSource = this.audioContext.createBufferSource();
        this.currentSource.buffer = audioBuffer;

        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = this.config.parameters.audio.volume;
        this.currentSource.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        const source = this.currentSource;
        source.onended = () => {
            if (this.currentSource !== source) return; // stopped or replaced
            this.updateStatus('Audio finished ✓');
            this.startResponseTimer();
        };

        this.currentSource.start(0);
    }

    async handleStop() {
        this.stopAudio();
        this.updateStatus('Stopped');
        this.stopResponseTimer();
        await this.stopAndSaveRecording();
    }

    async handleNext() {
        this.saveKeywordStates();
        this.stopResponseTimer();
        await this.stopAndSaveRecording();

        if (this.currentIndex < this.totalItems - 1) {
            const currentSNR = this.csvData[this.currentIndex]['SNR'];
            const nextSNR = this.csvData[this.currentIndex + 1]['SNR'];

            // Just finished last sentence of a full SNR level (not 'half')
            if (currentSNR !== 'half' && nextSNR !== currentSNR) {
                const levelRows = this.csvData.filter(r => r['SNR'] === currentSNR);
                const totalKw = levelRows.reduce((s, r) => s + this.parseKeywords(r['Key Words'] || '').length, 0);
                const correctKw = levelRows.reduce((s, r) => s + this.parseKeywords(r['Correct Key Words'] || '').length, 0);
                const pct = totalKw > 0 ? correctKw / totalKw : 1;

                // Score <50% — do a half-step above, where its recordings
                // exist (HINT_audio/SNR22.5 down to SNR-2.5)
                const halfStep = parseFloat(currentSNR) + 2.5;
                if (pct < 0.5 && this.halfStepSNR === null && this.halfStepAudioExists(halfStep)) {
                    this.halfStepSNR = halfStep;
                    const halfIndex = this.csvData.findIndex(r => r['SNR'] === 'half');
                    if (halfIndex >= 0) {
                        this.currentIndex = halfIndex;
                        this.refreshPlayerUI();
                        setTimeout(() => this.handlePlay(), 100);
                        return;
                    }
                }
            }

            // No half-step was triggered: the half-step items are not part
            // of this run, so it ends after the last full level
            if (nextSNR === 'half' && this.halfStepSNR === null) {
                await this.saveResults();
                this.showResultsPage();
                return;
            }

            this.currentIndex++;
            this.refreshPlayerUI();
            setTimeout(() => this.handlePlay(), 100);
        } else {
            await this.saveResults();
            this.showResultsPage();
        }
    }

    halfStepAudioExists(snr) {
        const path = window.require('path');
        const fs = window.require('fs');
        const { app } = window.require('@electron/remote') || window.require('electron').remote;
        return fs.existsSync(path.join(app.getAppPath(), 'src', 'renderer', 'tasks', 'sin', 'hint', 'HINT_audio', this.snrToFolder(snr)));
    }

    // Rows the tester has scored (moved on from with Next, Back or a jump).
    // Rows never presented are not scores of 0.
    isScored(index) {
        return this.keywordStates[index] !== undefined;
    }

    async showResultsPage() {
        this.currentPage = 'results';
        this.modalContent.innerHTML = `
            <div class="hint-results-page">
                <div class="results-content" style="display:flex; flex-direction:column; align-items:center; padding-top:16px;">
                    <h1 class="task-title" style="margin:0 0 12px 0;">HINT — Results</h1>
                    <div id="results-loading" style="text-align:center; padding:20px;">
                        <p>Fitting psychometric function, please wait...</p>
                    </div>
                    <div id="results-display" style="display:none; text-align:center; width:100%;">
                        <img id="psychometric-plot" style="max-width:420px; width:100%; border-radius:8px;" />
                        <div id="snr-table" style="margin:12px auto;"></div>
                        <div style="margin-top:14px;">
                            <button class="task-btn task-btn-primary" id="continue-btn">Continue to Main Menu</button>
                        </div>
                    </div>
                    <div id="results-error" style="display:none; color:red; padding:20px;"></div>
                </div>
            </div>
        `;

        try {
            const path = window.require('path');
            const fs = window.require('fs').promises;
            const { app } = window.require('@electron/remote') || window.require('electron').remote;
            const { getParticipantDir } = window.require(path.join(app.getAppPath(), 'src', 'shared', 'storage', 'participant-storage.js'));
            const participantDir = getParticipantDir(this.participantId);

            const csvPath    = path.join(participantDir, 'speechinnoise_summary.csv');
            const pngPath    = path.join(participantDir, `HINT_psychometric_${this.participantId}.png`);
            const scriptPath = path.join(app.getAppPath(), 'src', 'shared', 'psychometric', 'hint_psychometric.py');

            // Read recommended SNR from Words psychometric result
            let maxWordsSNR = null;
            try {
                const snrTxt = await fs.readFile(path.join(participantDir, 'words_recommended_snr.txt'), 'utf8');
                const parsed = parseFloat(snrTxt.trim());
                if (!isNaN(parsed)) maxWordsSNR = parsed;
            } catch (_) {}

            await this.runPsychometricScript(csvPath, pngPath, scriptPath, maxWordsSNR);

            document.getElementById('results-loading').style.display = 'none';
            document.getElementById('results-display').style.display = 'block';
            document.getElementById('psychometric-plot').src = `file://${pngPath}`;

            // Build SNR table
            const raw = await fs.readFile(csvPath, 'utf8');
            const lines = raw.trim().split('\n');
            const headers = lines[0].split(',');
            const hintIdx = headers.indexOf('HINT');
            const rows = lines.slice(1).map(l => l.split(','))
                .filter(r => r[hintIdx] && r[hintIdx].includes('/'))
                .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
            const tableHTML = `<table style="border-collapse:collapse; font-size:0.9em; margin:0 auto;">
                <thead><tr>
                    <th style="padding:4px 16px; border-bottom:1px solid #ccc;">SNR (dB)</th>
                    <th style="padding:4px 16px; border-bottom:1px solid #ccc;">Correct / Total</th>
                </tr></thead>
                <tbody>${rows.map(r => `<tr>
                    <td style="padding:3px 16px; text-align:center;">${r[0]}</td>
                    <td style="padding:3px 16px; text-align:center;">${r[hintIdx]}</td>
                </tr>`).join('')}</tbody>
            </table>`;
            document.getElementById('snr-table').innerHTML = tableHTML;
            document.getElementById('continue-btn').addEventListener('click', () => this.closeTask());
        } catch (error) {
            document.getElementById('results-loading').style.display = 'none';
            document.getElementById('results-error').innerHTML =
                `<p>Could not fit psychometric function: ${error.message}</p>
                 <button class="task-btn task-btn-primary" id="continue-btn-err">Continue to Main Menu</button>`;
            document.getElementById('results-error').style.display = 'block';
            document.getElementById('continue-btn-err').addEventListener('click', () => this.closeTask());
        }
    }

    runPsychometricScript(csvPath, pngPath, scriptPath, maxSNR = null) {
        return new Promise((resolve, reject) => {
            const { spawn } = window.require('child_process');
            const path = window.require('path');
            const { app } = window.require('@electron/remote');
            const { psychometricCommand } = window.require(path.join(app.getAppPath(), 'src', 'shared', 'psychometric', 'psychometric-runner.js'));
            const scriptArgs = [csvPath, pngPath];
            if (maxSNR !== null) scriptArgs.push(String(maxSNR));
            const { command, args } = psychometricCommand(scriptPath, scriptArgs);
            const child = spawn(command, args, { windowsHide: true });
            let stderr = '';
            child.stderr.on('data', d => { stderr += d.toString(); });
            child.on('close', code => {
                if (code !== 0) reject(new Error(stderr || `exit code ${code}`));
                else resolve();
            });
            child.on('error', err => reject(err));
        });
    }

    stopAudio() {
        if (this.asioEngine) {
            this.asioEngine.clearOutputQueue();
        }
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {}
            this.currentSource = null;
        }
    }

    updateStatus(message) {
        const statusEl = document.getElementById('status-display');
        if (statusEl) {
            statusEl.textContent = message;
        }
    }

    // Response timer methods
    startResponseTimer() {
        this.stopResponseTimer();
        this.responseStartedAt = performance.now();
        this.responseMs = 0;
        this.responseRunning = true;
        this.updateResponseDisplay();

        this.responseTimer = setInterval(() => {
            if (this.responseRunning) {
                this.responseMs = Math.round(performance.now() - this.responseStartedAt);
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

    async saveResults() {
        // Saved every time the tester leaves or finishes, overwriting this
        // run's files, so later scoring changes are never lost.
        
        try {
            const os = window.require('os');
            const path = window.require('path');
            const fs = window.require('fs').promises;
            const { app } = window.require('@electron/remote') || window.require('electron').remote;
            const { getTaskRunDir } = window.require(path.join(app.getAppPath(), 'src', 'shared', 'storage', 'participant-storage.js'));

            // <participant>/sin-hint_<run start>/ holds results.txt, trials.csv and recordings/
            const outputDir = getTaskRunDir(this.participantId, 'hint', this.runStart);
            const outputPath = path.join(outputDir, 'results.txt');
            
            let output = [];
            
            output.push('='.repeat(60));
            output.push('HINT (Hearing In Noise Test) Results');
            output.push('='.repeat(60));
            output.push('');
            output.push(`Participant ID: ${this.participantId}`);
            output.push(`App Version: ${globalThis.oatsAppInfo?.line() ?? 'unknown'}`);
            output.push(`Audio Backend: ${this.asioEngine && this.asioEngine.isEnabled() ? this.asioEngine.describeBackend() : 'Web Audio / MediaRecorder (ASIO unavailable)'}`);
            output.push(`Stimulus Level: ${this.logStimulusLevel('Speech in Noise: HINT')}`);
            output.push(`Audio Check: ${this.getAudioCheck().summarize(this.audioCheck)}`);
            output.push(`Practice: ${this.practiceResult ? `done (${this.practiceResult.itemsPlayed} of ${this.practiceResult.totalItems} items played)` : 'skipped'}`);
            output.push(`Date: ${new Date().toLocaleString()}`);
            output.push(`Task: HINT`);
            output.push('');
            
            output.push('='.repeat(60));
            output.push('TRIAL DATA');
            output.push('='.repeat(60));
            output.push('');
            
            for (let i = 0; i < this.csvData.length; i++) {
                const row = this.csvData[i];
                output.push(`Item ${i + 1}`);
                output.push(`  SNR: ${row['SNR'] || '—'}`);
                output.push(`  List Number: ${row['List Number'] || '—'}`);
                output.push(`  Sentence Number: ${row['Sentence Number'] || '—'}`);
                output.push(`  Sentence: ${row['Sentence '] || row['Sentence'] || ''}`);
                output.push(`  Key Words: ${row['Key Words'] || ''}`);
                output.push(`  Correct Key Words: ${row['Correct Key Words'] || ''}`);
                output.push('');
            }
            
            output.push('='.repeat(60));
            output.push('SUMMARY STATISTICS');
            output.push('='.repeat(60));
            output.push('');
            
            const snrSummary = this.calculateSNRSummary();
            for (const [snr, stats] of Object.entries(snrSummary)) {
                const percent = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) : '0.0';
                output.push(`SNR ${snr} dB: ${stats.correct}/${stats.total} keywords correct (${percent}%)`);
            }
            
            output.push('');
            output.push('='.repeat(60));
            output.push('END OF RESULTS');
            output.push('='.repeat(60));
            
            await fs.writeFile(outputPath, output.join('\n'), 'utf8');
            console.log('HINT results saved to:', outputPath);

            // Save CSV results file
            const csvOutputPath = path.join(outputDir, 'trials.csv');
            const csvLines = [];
            csvLines.push('SNR,List Number,Sentence Number,Sentence,Key Words,Correct Key Words');
            for (const row of this.csvData) {
                const snr = row['SNR'] || '';
                const listNum = row['List Number'] || '';
                const sentNum = row['Sentence Number'] || '';
                const sentence = `"${(row['Sentence '] || row['Sentence'] || '').trim()}"`;
                const keywords = `"${(row['Key Words'] || '').trim()}"`;
                const correct = `"${(row['Correct Key Words'] || '').trim()}"`;
                csvLines.push(`${snr},${listNum},${sentNum},${sentence},${keywords},${correct}`);
            }
            await fs.writeFile(csvOutputPath, csvLines.join('\n'), 'utf8');
            console.log('HINT CSV results saved to:', csvOutputPath);

            // Save summary file
            await this.saveSummaryFile(snrSummary);
            
            this.resultsSaved = true;
            
        } catch (error) {
            console.error('Error saving results:', error);
            oatsDialog.alert('Error saving results. Please check console for details.');
        }
    }

    async saveSummaryFile(snrSummary) {
        const os = window.require('os');
        const path = window.require('path');
        const fs = window.require('fs').promises;
        const { app } = window.require('@electron/remote') || window.require('electron').remote;
        const { getParticipantDir } = window.require(path.join(app.getAppPath(), 'src', 'shared', 'storage', 'participant-storage.js'));

        // One summary across the four Speech-in-Noise tasks, in the participant folder
        const participantDir = getParticipantDir(this.participantId);
        await fs.mkdir(participantDir, { recursive: true });
        const summaryPath = path.join(participantDir, 'speechinnoise_summary.csv');
        const snrLevels = [25, 22.5, 20, 17.5, 15, 12.5, 10, 7.5, 5, 2.5, 0, -2.5, -5];

        let data = {};
        snrLevels.forEach(snr => {
            data[snr] = { 'Non-words': '', 'Words': '', 'HINT': '', 'CST': '' };
        });

        try {
            const existing = await fs.readFile(summaryPath, 'utf8');
            const lines = existing.trim().split('\n');
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                const snr = parseFloat(values[0]);
                if (data[snr] !== undefined) {
                    data[snr]['Non-words'] = values[1] || '';
                    data[snr]['Words'] = values[2] || '';
                    data[snr]['HINT'] = values[3] || '';
                    data[snr]['CST'] = values[4] || '';
                }
            }
        } catch (e) {
            // File doesn't exist yet, use empty structure
        }

        // This run replaces the HINT column; levels it did not test stay blank
        snrLevels.forEach(snr => { data[snr]['HINT'] = ''; });
        for (const [snr, stats] of Object.entries(snrSummary)) {
            const snrNum = parseFloat(snr);
            if (data[snrNum] !== undefined && stats.total > 0) {
                data[snrNum]['HINT'] = `${stats.correct}/${stats.total}`;
            }
        }

        const summaryLines = ['SNR,Non-words,Words,HINT,CST'];
        snrLevels.forEach(snr => {
            const row = data[snr];
            summaryLines.push(`${snr},${row['Non-words']},${row['Words']},${row['HINT']},${row['CST']}`);
        });

        await fs.writeFile(summaryPath, summaryLines.join('\n'), 'utf8');
        console.log('Summary file saved to:', summaryPath);
    }

    calculateSNRSummary() {
        const summary = {};

        for (let i = 0; i < this.csvData.length; i++) {
            if (!this.isScored(i)) continue;
            const row = this.csvData[i];
            const snr = row['SNR'] === 'half'
                ? (this.halfStepSNR !== null ? this.halfStepSNR : 'half')
                : (row['SNR'] || '—');
            
            if (!summary[snr]) {
                summary[snr] = { total: 0, correct: 0 };
            }
            
            const totalKeywords = this.parseKeywords(row['Key Words'] || '').length;
            const correctKeywords = this.parseKeywords(row['Correct Key Words'] || '').length;
            
            summary[snr].total += totalKeywords;
            summary[snr].correct += correctKeywords;
        }
        
        return summary;
    }

    discardRecording() {
        if (this.recordingBackend === 'ASIO') {
            if (!this.isRecording) return;
            this.asioEngine.stopCaptureDiscard();
            this.isRecording = false;
            this.hideRecordingIndicator();
            return;
        }
        if (!this.mediaRecorder || !this.isRecording) return;
        this.mediaRecorder.ondataavailable = null;
        this.mediaRecorder.onstop = null;
        this.mediaRecorder.stop();
        this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
        this.recordingChunks = [];
        this.isRecording = false;
        this.hideRecordingIndicator();
    }

    async startRecording() {
        // ASIO records from the interface input chosen in the audio setup, on
        // the same clock as stimulus playback.
        if (this.asioEngine && this.asioEngine.isEnabled()) {
            this.recordingBackend = 'ASIO';
            this.currentTake += 1;
            this.isRecording = true;
            this.takeCapture = null;
            this.takeStimulusTiming = null;
            const indicator = document.getElementById('recording-indicator');
            if (indicator) indicator.style.display = 'block';
            try {
                this.takeCapture = await this.asioEngine.startCapture();
            } catch (error) {
                console.error('Error starting ASIO recording:', error);
                this.isRecording = false;
                this.hideRecordingIndicator();
            }
            return;
        }

        this.recordingBackend = 'MediaRecorder';
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.recordingChunks = [];
            this.currentTake += 1;
            this.mediaRecorder = new MediaRecorder(stream);
            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.recordingChunks.push(e.data);
            };
            this.mediaRecorder.start();
            this.isRecording = true;
            const indicator = document.getElementById('recording-indicator');
            if (indicator) indicator.style.display = 'block';
        } catch (error) {
            console.error('Error starting recording:', error);
            oatsDialog.alert('Microphone not available. Recordings will not be saved.\nPlease check microphone permissions and try again.');
        }
    }

    hideRecordingIndicator() {
        const indicator = document.getElementById('recording-indicator');
        if (indicator) indicator.style.display = 'none';
    }

    encodeWAV(audioBuffer) {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const bitDepth = 16;

        const channels = [];
        for (let i = 0; i < numChannels; i++) channels.push(audioBuffer.getChannelData(i));
        const length = channels[0].length;
        const interleaved = new Float32Array(length * numChannels);
        for (let i = 0; i < length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                interleaved[i * numChannels + ch] = channels[ch][i];
            }
        }

        const dataLength = interleaved.length * 2;
        const buffer = new ArrayBuffer(44 + dataLength);
        const view = new DataView(buffer);
        const writeString = (offset, str) => {
            for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * bitDepth / 8, true);
        view.setUint16(32, numChannels * bitDepth / 8, true);
        view.setUint16(34, bitDepth, true);
        writeString(36, 'data');
        view.setUint32(40, dataLength, true);

        let offset = 44;
        for (let i = 0; i < interleaved.length; i++) {
            const s = Math.max(-1, Math.min(1, interleaved[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            offset += 2;
        }

        return Buffer.from(buffer);
    }

    // Returns the finished take as a WAV file buffer, from whichever backend
    // recorded it.
    async takeRecordingWav() {
        if (this.recordingBackend === 'ASIO') {
            const recording = this.asioEngine.stopCaptureToWavBuffer();
            this.takeRecording = recording;
            return recording.wavBuffer;
        }
        const blob = new Blob(this.recordingChunks, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        const decodeContext = new AudioContext();
        const audioBuffer = await decodeContext.decodeAudioData(arrayBuffer);
        await decodeContext.close();
        return this.encodeWAV(audioBuffer);
    }

    // Saves where the stimulus starts inside an ASIO take next to the WAV, so
    // response latency can be measured from the recording on one clock.
    async saveTakeTiming(wavPath) {
        if (this.recordingBackend !== 'ASIO' || !this.takeRecording) return;
        const fs = window.require('fs').promises;
        const position = this.asioEngine.stimulusPositionInRecording(this.takeStimulusTiming, this.takeRecording);
        const timing = {
            audio_backend: this.asioEngine.describeBackend(),
            sample_rate: this.takeRecording.sampleRate,
            recording_samples: this.takeRecording.sampleCount,
            stimulus_onset_in_recording_samples: position ? position.samples : null,
            stimulus_onset_in_recording_ms: position ? Number(position.ms.toFixed(3)) : null,
            stimulus_completed: this.takeStimulusTiming ? !this.takeStimulusTiming.cancelled : false,
            timing_reliable: position ? position.timingReliable : false
        };
        await fs.writeFile(wavPath.replace(/\.wav$/i, '_timing.json'), JSON.stringify(timing, null, 2), 'utf8');
    }

    async stopAndSaveRecording() {
        if (!this.isRecording) return;
        if (this.recordingBackend !== 'ASIO' && !this.mediaRecorder) return;

        const takeIndex = this.currentTake;
        const rowIndex = this.currentIndex;

        return new Promise((resolve) => {
            const saveTake = async () => {
                try {
                    const wavBuffer = await this.takeRecordingWav();

                    const os = window.require('os');
                    const path = window.require('path');
                    const fs = window.require('fs').promises;
                    const { app } = window.require('@electron/remote') || window.require('electron').remote;
                    const { getTaskRunDir } = window.require(path.join(app.getAppPath(), 'src', 'shared', 'storage', 'participant-storage.js'));

                    const recordingsDir = path.join(getTaskRunDir(this.participantId, 'hint', this.runStart), 'recordings');
                    await fs.mkdir(recordingsDir, { recursive: true });

                    const row = this.csvData[rowIndex];
                    const itemNum = String(rowIndex + 1).padStart(2, '0');
                    const snr = String(row['SNR'] || '').padStart(2, '0');
                    const list = String(row['List Number'] || '').padStart(2, '0');
                    const sentence = String(row['Sentence Number'] || '').padStart(2, '0');
                    const fileName = `HINT_${this.participantId}_${itemNum}_SNR${snr}_L${list}_S${sentence}_take${takeIndex}.wav`;
                    const filePath = path.join(recordingsDir, fileName);

                    await fs.writeFile(filePath, wavBuffer);
                    console.log('Recording saved:', filePath);
                    await this.saveTakeTiming(filePath);
                } catch (error) {
                    console.error('Error saving recording:', error);
                }

                if (this.recordingBackend !== 'ASIO' && this.mediaRecorder) {
                    this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
                }
                this.isRecording = false;
                this.hideRecordingIndicator();
                resolve();
            };

            if (this.recordingBackend === 'ASIO') {
                saveTake();
            } else {
                this.mediaRecorder.onstop = saveTake;
                this.mediaRecorder.stop();
            }
        });
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
        console.log('HINT task cleanup completed');
        window.hintTaskInstance = null;
    }
}

// Global function to load and start the HINT task
async function loadHINTTask(participantId) {
    try {
        console.log('Loading HINT task for participant:', participantId);
        
        window.hintTaskInstance = new HINTTask(participantId);
        await window.hintTaskInstance.init();
        
    } catch (error) {
        console.error('Error loading HINT task:', error);
        oatsDialog.alert('Error loading HINT task. Please check the configuration and try again.');
    }
}

window.loadHINTTask = loadHINTTask;