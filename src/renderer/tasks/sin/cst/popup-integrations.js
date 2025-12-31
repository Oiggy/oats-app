class CSTTask {
    constructor(participantId) {
        this.participantId = participantId;
        this.config = null;
        this.audioContext = null;
        this.audioBuffers = {};
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
        
        // Trial data for saving
        this.trialData = [];
        
        // Save tracking
        this.resultsSaved = false; // Add this flag
    }

    async init() {
        try {
            await this.loadConfiguration();
            await this.initializeAudioContext();
            await this.loadCSVData();
            await this.loadAudioFiles();
            this.createTaskModal();
            this.showInstructionPage();
        } catch (error) {
            console.error('Error initializing CST task:', error);
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
        
        const configPath = path.join(baseDir, 'cfg_cst_task.json');
        const configData = await fs.readFile(configPath, 'utf8');
        this.config = JSON.parse(configData);
        
        console.log('CST Configuration loaded:', this.config);
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
        const csvPath = path.join(appPath, 'src', 'renderer', 'tasks', 'sin', 'cst', 'cst_list.csv');
        
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
                        // Escaped quote
                        current += '"';
                        i++; // Skip next quote
                    } else {
                        // Toggle quote state
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    // Field separator (only if not in quotes)
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            
            // Add the last field
            result.push(current.trim());
            
            return result;
        }
        
        // Parse header
        const headers = parseCSVLine(lines[0]);
        console.log('CSV Headers:', headers);
        
        const rows = [];
        
        // Parse data rows
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
            
            // Debug first few rows
            if (i <= 3) {
                console.log(`Row ${i}:`, row);
                console.log(`  Key Words: "${row['Key Words']}"`);
            }
        }
        
        return rows;
    }

    async loadAudioFiles() {
        const path = window.require('path');
        const fs = window.require('fs').promises;
        const { app } = window.require('@electron/remote') || window.require('electron').remote;
        
        const appPath = app.getAppPath();
        const audioDir = path.join(appPath, 'src', 'renderer', 'tasks', 'sin', 'cst', 'audio');
        
        try {
            // Recursively collect all .wav files
            this.audioFiles = await this.collectAudioFilesRecursively(audioDir);
            
            // Sort naturally by folder and filename numbers
            this.audioFiles.sort((a, b) => this.compareAudioPaths(a, b, audioDir));
            
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

    async collectAudioFilesRecursively(dir) {
        const fs = window.require('fs').promises;
        const path = window.require('path');
        const files = [];
        
        async function walk(currentPath) {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                
                if (entry.isDirectory()) {
                    await walk(fullPath);
                } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.wav')) {
                    files.push(fullPath);
                }
            }
        }
        
        await walk(dir);
        return files;
    }

    compareAudioPaths(pathA, pathB, baseDir) {
        const path = window.require('path');
        const relA = path.relative(baseDir, pathA);
        const relB = path.relative(baseDir, pathB);
        
        const partsA = relA.split(path.sep);
        const partsB = relB.split(path.sep);
        
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const partA = partsA[i] || '';
            const partB = partsB[i] || '';
            
            const numA = this.extractFirstNumber(partA);
            const numB = this.extractFirstNumber(partB);
            
            if (numA !== numB) {
                return numA - numB;
            }
            
            if (partA < partB) return -1;
            if (partA > partB) return 1;
        }
        
        return 0;
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
        this.modalContent.className = 'task-modal-content cst-modal';
        
        this.modalOverlay.appendChild(this.modalContent);
        document.body.appendChild(this.modalOverlay);
    }

    showInstructionPage() {
        this.currentPage = 'instruction';
        
        const instructionText = `Read this to the participant:

In this part (CST), you will hear sentences in noise.
After each one, please repeat exactly what you heard.`;
        
        this.modalContent.innerHTML = `
            <div class="cst-instruction-page">
                <div class="instruction-content">
                    <h1 class="task-title">CST</h1>
                    
                    <div class="instruction-text">
                        ${instructionText.replace(/\n/g, '<br>')}
                    </div>
                    
                    <div class="instruction-buttons">
                        <button class="task-btn task-btn-secondary" id="back-to-main-btn">
                            Main Menu
                        </button>
                        <button class="task-btn task-btn-primary" id="start-cst-btn">
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
        
        document.getElementById('start-cst-btn').addEventListener('click', () => {
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
            <div class="cst-player-page">
                <div class="player-content">
                    <h1 class="task-title">CST</h1>
                    
                    <div class="top-row">
                        <div class="left-col">
                            <div class="skip-hint" id="skip-hint" style="display: none;">
                                You can skip this level
                            </div>
                            <div class="snr-summary" id="snr-summary"></div>
                        </div>
                        <div class="topic-display" id="topic-display">Topic: —</div>
                    </div>
                    
                    <div class="item-counter" id="item-counter">
                        Item 1 of ${this.totalItems}
                    </div>
                    
                    <div class="snr-label" id="snr-label">SNR: —</div>
                    
                    <div class="sentence-display" id="sentence-display">
                        ${this.csvData[0]['Sentence'] || '—'}
                    </div>
                    
                    <div class="keywords-container" id="keywords-container">
                        <div class="keywords-header">
                            <h3>Key Words</h3>
                            <button class="select-all-btn" id="select-all-btn">Select All</button>
                        </div>
                        <div class="keywords-grid" id="keywords-grid"></div>
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
        
        // Attach event listeners
        document.getElementById('back-btn').addEventListener('click', () => this.handleBack());
        document.getElementById('play-btn').addEventListener('click', () => this.handlePlay());
        document.getElementById('stop-btn').addEventListener('click', () => this.handleStop());
        document.getElementById('next-btn').addEventListener('click', () => this.handleNext());
        document.getElementById('main-menu-btn').addEventListener('click', () => {
            this.saveResults();
            this.closeTask();
        });
        document.getElementById('select-all-btn').addEventListener('click', () => this.selectAllKeywords());
        
        this.refreshPlayerUI();
    }

    refreshPlayerUI() {
        if (this.totalItems === 0) return;
        
        const row = this.csvData[this.currentIndex];
        
        // Debug log
        console.log('Current row:', row);
        
        // Update counter
        document.getElementById('item-counter').textContent = 
            `Item ${this.currentIndex + 1} of ${this.totalItems}`;
        
        // Update SNR - handle empty values
        const snr = row['SNR'] || row['snr'] || '';
        const snrText = snr ? `SNR: ${snr} dB` : 'SNR: — dB';
        document.getElementById('snr-label').textContent = snrText;
        
        // Update Topic (from CSV or infer from folder)
        let topic = (row['Topic'] || row['topic'] || '').trim();
        if (!topic && this.audioFiles[this.currentIndex]) {
            const path = window.require('path');
            const folder = path.basename(path.dirname(this.audioFiles[this.currentIndex]));
            topic = folder.replace(/^\d+[_\-\s]*/, '').replace(/_/g, ' ').trim();
        }
        document.getElementById('topic-display').textContent = `Topic: ${topic || '—'}`;
        
        // Update sentence
        const sentence = row['Sentence'] || row['sentence'] || '—';
        document.getElementById('sentence-display').textContent = sentence;
        
        // Build keywords
        const keywords = row['Key Words'] || row['key words'] || '';
        console.log('Keywords text:', keywords);
        this.buildKeywordsArea(keywords);
        
        // Update SNR summary
        this.updateSNRSummary();
        
        // Update skip hint
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
        
        console.log('Building keywords grid with:', keywords);
        
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
            console.log('No keywords or invalid format');
            return [];
        }
        
        // Remove any remaining quotes from the field
        keywordsText = keywordsText.replace(/^["']|["']$/g, '');
        
        const keywords = keywordsText
            .split(/[,;]/)
            .map(kw => kw.trim())
            .filter(kw => kw.length > 0);
        
        console.log('Parsed keywords from:', keywordsText);
        console.log('Result:', keywords);
        
        return keywords;
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
        
        const snrCounts = {};
        const snrOrder = [];
        
        // Calculate counts up to current index (inclusive)
        for (let i = 0; i <= this.currentIndex; i++) {
            const row = this.csvData[i];
            const snr = row['SNR'] || '—';
            
            if (!snrCounts[snr]) {
                snrCounts[snr] = { total: 0, correct: 0 };
                snrOrder.push(snr);
            }
            
            const totalKeywords = this.parseKeywords(row['Key Words'] || '').length;
            let correctKeywords;
            
            if (i < this.currentIndex) {
                // Use saved data for past items
                correctKeywords = this.parseKeywords(row['Correct Key Words'] || '').length;
            } else {
                // Use current checkboxes for current item
                correctKeywords = this.keywordCheckboxes.filter(cb => cb.checked).length;
            }
            
            snrCounts[snr].total += totalKeywords;
            snrCounts[snr].correct += correctKeywords;
        }
        
        // Build summary text
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
        
        // Find first 5 items with this SNR
        const first5Indices = [];
        for (let i = 0; i < this.csvData.length; i++) {
            const snr = this.csvData[i]['SNR'] || '—';
            if (snr === currentSNR) {
                first5Indices.push(i);
                if (first5Indices.length === 5) break;
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

    handleBack() {
        this.saveKeywordStates();
        this.stopResponseTimer();
        
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.refreshPlayerUI();
        } else {
            this.stopAudio();
            this.saveResults(); // Save before going back to instruction
            this.showInstructionPage();
        }
    }

    handlePlay() {
        if (this.totalItems === 0) return;
        
        this.resetResponseTimer();
        this.updateStatus('Playing…');
        
        const audioPath = this.audioFiles[this.currentIndex];
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

    handleStop() {
        this.stopAudio();
        this.updateStatus('Stopped');
        this.stopResponseTimer();
    }

    handleNext() {
        this.saveKeywordStates();
        this.stopResponseTimer();
        
        if (this.currentIndex < this.totalItems - 1) {
            this.currentIndex++;
            this.refreshPlayerUI();
            // Auto-play next
            setTimeout(() => this.handlePlay(), 100);
        } else {
            // Only save when task is completed
            this.saveResults();
            alert('Task finished.');
        }
    }

    stopAudio() {
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
    // Prevent double-saving
    if (this.resultsSaved) {
        console.log('Results already saved, skipping...');
        return;
    }
    
    try {
        const os = window.require('os');
        const path = window.require('path');
        const fs = window.require('fs').promises;
        
        // Determine base directory
        let baseDir;
        if (process.platform === 'win32') {
            baseDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Oats', 'participants', this.participantId);
        } else {
            baseDir = path.join(os.homedir(), 'Documents', 'Oats', 'participants', this.participantId);
        }
        
        // Create output directory
        const outputDir = path.join(baseDir, 'Speech_in_Noise', 'CST');
        await fs.mkdir(outputDir, { recursive: true });
        
        // Create output file with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputPath = path.join(outputDir, `CST_${this.participantId}_${timestamp}.txt`);
        
        // Build output content
        let output = [];
        
        // Header
        output.push('='.repeat(60));
        output.push('CST (Connected Speech Test) Results');
        output.push('='.repeat(60));
        output.push('');
        output.push(`Participant ID: ${this.participantId}`);
        output.push(`Date: ${new Date().toLocaleString()}`);
        output.push(`Task: CST`);
        output.push('');
        
        // Trial data
        output.push('='.repeat(60));
        output.push('TRIAL DATA');
        output.push('='.repeat(60));
        output.push('');
        
        for (let i = 0; i < this.csvData.length; i++) {
            const row = this.csvData[i];
            
            output.push(`Item ${i + 1}`);
            output.push(`  SNR: ${row['SNR'] || '—'}`);
            output.push(`  Topic: ${row['Topic'] || '—'}`);
            output.push(`  Passage Pair: ${row['Passage Pair'] || '—'}`);
            output.push(`  Sentence Number: ${row['Sentence Number'] || '—'}`);
            output.push(`  Sentence: ${row['Sentence'] || ''}`);
            output.push(`  Key Words: ${row['Key Words'] || ''}`);
            output.push(`  Correct Key Words: ${row['Correct Key Words'] || ''}`);
            output.push('');
        }
        
        // Summary statistics
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
        
        // Write to file
        await fs.writeFile(outputPath, output.join('\n'), 'utf8');
        
        console.log('CST results saved to:', outputPath);
        
        // Mark as saved
        this.resultsSaved = true;
        
    } catch (error) {
        console.error('Error saving results:', error);
        alert('Error saving results. Please check console for details.');
    }
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

    closeTask() {
        this.stopAudio();
        this.stopResponseTimer();
        
        if (this.modalOverlay && this.modalOverlay.parentNode) {
            this.modalOverlay.parentNode.removeChild(this.modalOverlay);
        }
        
        this.cleanup();
    }

    cleanup() {
        console.log('CST task cleanup completed');
        window.cstTaskInstance = null;
    }
}

// Global function to load and start the CST task
async function loadCSTTask(participantId) {
    try {
        console.log('Loading CST task for participant:', participantId);
        
        window.cstTaskInstance = new CSTTask(participantId);
        await window.cstTaskInstance.init();
        
    } catch (error) {
        console.error('Error loading CST task:', error);
        alert('Error loading CST task. Please check the configuration and try again.');
    }
}

window.loadCSTTask = loadCSTTask;