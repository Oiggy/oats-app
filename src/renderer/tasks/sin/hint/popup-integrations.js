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

        // Recording
        this.mediaRecorder = null;
        this.recordingChunks = [];
        this.isRecording = false;
        this.currentTake = 0;
        this.sessionTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
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
                const snr = String(row['SNR']).padStart(2, '0');
                const list = String(row['List Number']).padStart(2, '0');
                const sentence = String(row['Sentence Number']).padStart(2, '0');
                return path.join(audioDir, `SNR${snr}`, `L${list}_S${sentence}_mix.wav`);
            });
            
            console.log('Audio files found:', this.audioFiles.length);
            
            // Preload audio buffers
            for (const filePath of this.audioFiles) {
                await this.loadAudioBuffer(filePath);
            }
        } catch (error) {
            console.error('Error loading audio files:', error);
        }
        
        this.totalItems = Math.min(this.csvData.length, this.audioFiles.length);
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
            After each sentence, please repeat back exactly what you heard`;
        
        this.modalContent.innerHTML = `
            <div class="hint-instruction-page">
                <div class="instruction-content">
                    <h1 class="task-title">HINT</h1>
                    
                    <div class="instruction-text">
                        ${instructionText.replace(/\n/g, '<br>')}
                    </div>
                    
                    <div class="instruction-buttons">
                        <button class="task-btn task-btn-secondary" id="back-to-main-btn">
                            Main Menu
                        </button>
                        <button class="task-btn task-btn-primary" id="start-hint-btn">
                            Start
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('back-to-main-btn').addEventListener('click', () => {
            this.saveResults();
            this.closeTask();
        });
        
        document.getElementById('start-hint-btn').addEventListener('click', () => {
            if (this.totalItems === 0) {
                alert('No audio/CSV items found.');
                return;
            }
            this.showPlayerPage();
        });
    }

    showPlayerPage() {
        this.currentPage = 'player';
        
        this.modalContent.innerHTML = `
            <div class="hint-player-page">
                <div class="player-content">
                    <h1 class="task-title">HINT</h1>

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
                    
                    <div class="skip-hint" id="skip-hint" style="display: none; color: red; font-weight: bold; text-align: center; margin: 4px 0;">
                        ⚠ Low score — you may stop the task if needed
                    </div>

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
        
        this.refreshPlayerUI();
    }

    refreshPlayerUI() {
        if (this.totalItems === 0) return;
        
        const row = this.csvData[this.currentIndex];
        
        // Update counter
        const sentenceNum = row['Sentence Number'] || '';
        const totalInList = this.csvData.filter(r => r['SNR'] === row['SNR']).length;
        document.getElementById('item-counter').textContent = 
            `Item ${this.currentIndex + 1} of ${this.totalItems}  |  Sentence ${sentenceNum} of ${totalInList}`;
        
        // Update SNR
        const snr = row['SNR'] || '';
        const snrText = snr ? `SNR: ${snr} dB` : 'SNR: — dB';
        document.getElementById('snr-label').textContent = snrText;
        
        // Update sentence (handle both "Sentence" and "Sentence " with trailing space)
        const sentence = row['Sentence '] || row['Sentence'] || '—';
        document.getElementById('sentence-display').textContent = sentence;
        
        // Build keywords
        this.buildKeywordsArea(row['Key Words'] || '');
        
        // Reset take counter for new item
        this.currentTake = 0;

        // Update SNR summary and skip hint
        this.updateSNRSummary();
        this.updateSkipHint();

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

        const snrOrder = [25, 20, 15, 10, 5, 0];
        const snrCounts = {};
        snrOrder.forEach(snr => { snrCounts[snr] = { total: 0, correct: 0 }; });

        // Calculate counts up to current index (inclusive)
        for (let i = 0; i <= this.currentIndex; i++) {
            const row = this.csvData[i];
            const snr = Number(row['SNR']);
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

        summaryDiv.innerHTML = lines.join('<br>');
    }

    updateSkipHint() {
        const skipHintDiv = document.getElementById('skip-hint');
        if (!skipHintDiv) return;
        
        const currentRow = this.csvData[this.currentIndex];
        const currentSNR = currentRow['SNR'] || '—';
        
        // Find first half items with this SNR
        const first5Indices = [];
        for (let i = 0; i < this.csvData.length; i++) {
            const snr = this.csvData[i]['SNR'] || '—';
            if (snr === currentSNR) {
                first5Indices.push(i);
                if (first5Indices.length === 4) break;
            }
        }
        
        if (first5Indices.length === 0 || this.currentIndex <= first5Indices[first5Indices.length - 1]) {
            skipHintDiv.style.display = 'none';
            return;
        }
        
        // Calculate total correct keywords in first 5
        let totalCorrect = 0;
        for (const idx of first5Indices) {
            const correctText = this.csvData[idx]['Correct Key Words'] || '';
            totalCorrect += this.parseKeywords(correctText).length;
        }
        
        if (totalCorrect < 2) {
            skipHintDiv.style.display = 'block';
        } else {
            skipHintDiv.style.display = 'none';
        }
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

        const audioPath = this.audioFiles[this.currentIndex];

        if (this.asioEngine && this.asioEngine.isEnabled()) {
            this.asioEngine.clearOutputQueue();
            this.asioEngine.playFile(audioPath, this.config.parameters.audio.volume)
                .then(() => {
                    this.updateStatus('Audio finished ✓');
                    this.startResponseTimer();
                })
                .catch((error) => {
                    console.error('ASIO playback error:', error);
                    this.updateStatus('Audio finished ✓');
                    this.startResponseTimer();
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

        this.currentSource.onended = () => {
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
            this.currentIndex++;
            this.refreshPlayerUI();
            setTimeout(() => this.handlePlay(), 100);
        } else {
            this.saveResults();
            alert('Task finished.');
        }
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

    async saveResults() {
        if (this.resultsSaved) {
            console.log('Results already saved, skipping...');
            return;
        }
        
        try {
            const os = window.require('os');
            const path = window.require('path');
            const fs = window.require('fs').promises;
            
            let baseDir;
            if (process.platform === 'win32') {
                baseDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Oats', 'participants', this.participantId);
            } else {
                baseDir = path.join(os.homedir(), 'Documents', 'Oats', 'participants', this.participantId);
            }
            
            const outputDir = path.join(baseDir, 'Speech_in_Noise', 'HINT');
            await fs.mkdir(outputDir, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outputPath = path.join(outputDir, `HINT_${this.participantId}_${timestamp}.txt`);
            
            let output = [];
            
            output.push('='.repeat(60));
            output.push('HINT (Hearing In Noise Test) Results');
            output.push('='.repeat(60));
            output.push('');
            output.push(`Participant ID: ${this.participantId}`);
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
            const csvOutputPath = path.join(outputDir, `HINT_${this.participantId}_${timestamp}.csv`);
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
            alert('Error saving results. Please check console for details.');
        }
    }

    async saveSummaryFile(snrSummary) {
        const os = window.require('os');
        const path = window.require('path');
        const fs = window.require('fs').promises;

        let baseDir;
        if (process.platform === 'win32') {
            baseDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Oats', 'participants', this.participantId);
        } else {
            baseDir = path.join(os.homedir(), 'Documents', 'Oats', 'participants', this.participantId);
        }

        const outputDir = path.join(baseDir, 'Speech_in_Noise');
        await fs.mkdir(outputDir, { recursive: true });

        const summaryPath = path.join(outputDir, `SIN_Summary_${this.participantId}.csv`);
        const snrLevels = [25, 20, 15, 10, 5, 0];

        let data = {};
        snrLevels.forEach(snr => {
            data[snr] = { 'Non-words': '', 'Words': '', 'HINT': '', 'CST': '' };
        });

        try {
            const existing = await fs.readFile(summaryPath, 'utf8');
            const lines = existing.trim().split('\n');
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                const snr = parseInt(values[0]);
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

        for (const [snr, stats] of Object.entries(snrSummary)) {
            const snrNum = parseInt(snr);
            if (data[snrNum] !== undefined) {
                data[snrNum]['HINT'] = stats.correct;
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
        
        for (const row of this.csvData) {
            const snr = row['SNR'] || '—';
            
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
            alert('Microphone not available. Recordings will not be saved.\nPlease check microphone permissions and try again.');
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

    async stopAndSaveRecording() {
        if (!this.mediaRecorder || !this.isRecording) return;

        const takeIndex = this.currentTake;
        const rowIndex = this.currentIndex;

        return new Promise((resolve) => {
            this.mediaRecorder.onstop = async () => {
                try {
                    const blob = new Blob(this.recordingChunks, { type: 'audio/webm' });
                    const arrayBuffer = await blob.arrayBuffer();
                    const decodeContext = new AudioContext();
                    const audioBuffer = await decodeContext.decodeAudioData(arrayBuffer);
                    await decodeContext.close();
                    const wavBuffer = this.encodeWAV(audioBuffer);

                    const os = window.require('os');
                    const path = window.require('path');
                    const fs = window.require('fs').promises;

                    let baseDir;
                    if (process.platform === 'win32') {
                        baseDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Oats', 'participants', this.participantId);
                    } else {
                        baseDir = path.join(os.homedir(), 'Documents', 'Oats', 'participants', this.participantId);
                    }

                    const recordingsDir = path.join(baseDir, 'Speech_in_Noise', 'HINT', 'recordings', this.sessionTimestamp);
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
                } catch (error) {
                    console.error('Error saving recording:', error);
                }

                this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
                this.isRecording = false;
                this.hideRecordingIndicator();
                resolve();
            };

            this.mediaRecorder.stop();
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
        alert('Error loading HINT task. Please check the configuration and try again.');
    }
}

window.loadHINTTask = loadHINTTask;