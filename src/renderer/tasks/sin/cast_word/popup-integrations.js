class CaSTWordTask {
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
        this.audioFiles = {};
        this.totalItems = 0;
        
        // Response timer
        this.responseTimer = null;
        this.responseMs = 0;
        this.responseRunning = false;
        
        // UI elements
        this.modalOverlay = null;
        this.modalContent = null;
        
        // Save tracking
        this.resultsSaved = false;
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
            console.error('Error initializing CaST Word task:', error);
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
        
        const configPath = path.join(baseDir, 'cfg_cast_word_task.json');
        const configData = await fs.readFile(configPath, 'utf8');
        this.config = JSON.parse(configData);
        
        console.log('CaST Word Configuration loaded:', this.config);
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
        const csvPath = path.join(appPath, 'src', 'renderer', 'tasks', 'sin', 'cast_word', 'Words_List_shuffled.csv');
        
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
            
            // Ensure Correct/Wrong exists
            if (!row['Correct1/Wrong0']) {
                row['Correct1/Wrong0'] = '';
            }
            
            rows.push(row);
        }
        
        return rows;
    }

    async loadAudioFiles() {
        const path = window.require('path');
        const { app } = window.require('@electron/remote') || window.require('electron').remote;
        
        const appPath = app.getAppPath();
        const audioDir = path.join(appPath, 'src', 'renderer', 'tasks', 'sin', 'cast_word', 'WORD_audio');
        
        try {
            this.audioFiles = this.csvData.map(row => {
                const snr = String(row['SNR']).padStart(2, '0');
                const word = (row['Word'] || '').toLowerCase().trim();
                return path.join(audioDir, `SNR${snr}`, `${word}_mix.wav`);
            });

            console.log('Audio files mapped:', this.audioFiles.length);

            for (const filePath of this.audioFiles) {
                await this.loadAudioBuffer(filePath);
            }
        } catch (error) {
            console.error('Error loading audio files:', error);
        }

        this.totalItems = this.csvData.length;
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
        this.modalContent.className = 'task-modal-content cast-word-modal';
        
        this.modalOverlay.appendChild(this.modalContent);
        document.body.appendChild(this.modalOverlay);
    }

    showInstructionPage() {
        this.currentPage = 'instruction';
        
        const instructionText = `Read this to the participant:

            In this task, you will hear some single words in  background noise.
            After each one, please repeat what you heard.`;
        
        this.modalContent.innerHTML = `
            <div class="cast-word-instruction-page">
                <div class="instruction-content">
                    <h1 class="task-title">Words</h1>
                    
                    <div class="instruction-text">
                        ${instructionText.replace(/\n/g, '<br>')}
                    </div>
                    
                    <div class="instruction-buttons">
                        <button class="task-btn task-btn-secondary" id="back-to-main-btn">
                            Main Menu
                        </button>
                        <button class="task-btn task-btn-primary" id="start-cast-word-btn">
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
        
        document.getElementById('start-cast-word-btn').addEventListener('click', () => {
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
            <div class="cast-word-player-page">
                <div class="player-content">
                    <h1 class="task-title">Words</h1>
                    
                    <div class="top-row">
                        <div class="snr-summary" id="snr-summary"></div>
                    </div>
                    
                    <div class="item-counter" id="item-counter">
                        Item 1 of ${this.totalItems}
                    </div>
                    
                    <div class="snr-label" id="snr-label">SNR: —</div>
                    

                    <div class="word-display" id="word-display">
                        ${this.csvData[0]['Word'] || '—'}
                    </div>

                    <div class="pronunciation-display" id="pronunciation-display">
                        ${this.csvData[0]['Pronunciation'] || ''}
                    </div>
                    
                    <div class="correct-checkbox-container">
                        <label class="correct-checkbox">
                            <input type="checkbox" id="correct-checkbox">
                            <span>Correct</span>
                        </label>
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
        document.getElementById('main-menu-btn').addEventListener('click', () => {
            this.saveResults();
            this.closeTask();
        });
        
        // Checkbox event
        const checkbox = document.getElementById('correct-checkbox');
        checkbox.addEventListener('change', () => {
            this.handleCheckboxChange();
        });
        
        this.refreshPlayerUI();
    }

refreshPlayerUI() {
        if (this.totalItems === 0) return;
        
        const row = this.csvData[this.currentIndex];
        
        // Update counter
        document.getElementById('item-counter').textContent = 
            `Item ${this.currentIndex + 1} of ${this.totalItems}`;
        
        // Update SNR
        const snr = row['SNR'] || '';
        const snrText = snr ? `SNR: ${snr} dB` : 'SNR: — dB';
        document.getElementById('snr-label').textContent = snrText;
        
        // Update word
        const word = row['Word'] || '—';
        document.getElementById('word-display').textContent = word;

        const pronunciation = row['Pronunciation'] || '';
        document.getElementById('pronunciation-display').textContent = pronunciation;
        
        // Update checkbox
        const checkbox = document.getElementById('correct-checkbox');
        const isCorrect = row['Correct1/Wrong0'] === '1';
        checkbox.checked = isCorrect;
        
        // Update SNR summary
        this.updateSNRSummary();
        
        this.stopAudio();
        this.resetResponseTimer();
    }

    handleCheckboxChange() {
        const checkbox = document.getElementById('correct-checkbox');
        this.csvData[this.currentIndex]['Correct1/Wrong0'] = checkbox.checked ? '1' : '0';
        this.updateSNRSummary();
    }

    updateSNRSummary() {
        const summaryDiv = document.getElementById('snr-summary');
        if (!summaryDiv) return;
        
        const snrCounts = {};
        
        // Calculate counts for all items
        for (const row of this.csvData) {
            const snr = row['SNR'] || '';
            if (!snr) continue;
            
            if (!snrCounts[snr]) {
                snrCounts[snr] = { total: 0, correct: 0 };
            }
            
            snrCounts[snr].total += 1;
            
            if (row['Correct1/Wrong0'] === '1') {
                snrCounts[snr].correct += 1;
            }
        }
        
        // Sort SNRs in descending order
        const sortedSNRs = Object.keys(snrCounts).sort((a, b) => parseInt(b) - parseInt(a));
        
        // Build summary text
        const lines = sortedSNRs.map(snr => {
            const { total, correct } = snrCounts[snr];
            const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
            return `SNR ${snr}: ${correct}/${total} (${percent}%)`;
        });
        
        summaryDiv.innerHTML = lines.join('<br>');
    }

    handleBack() {
        this.stopResponseTimer();
        
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.refreshPlayerUI();
        } else {
            this.stopAudio();
            this.saveResults();
            this.showInstructionPage();
        }
    }

    handlePlay() {
        if (this.totalItems === 0) return;
        
        const row = this.csvData[this.currentIndex];
        const audioPath = this.audioFiles[this.currentIndex];
        const audioBuffer = this.audioBuffers[audioPath];
        
        if (!audioBuffer) {
            console.error('Audio buffer not found for:', audioPath);
            this.updateStatus('Error: Audio not loaded');
            alert(`Audio file not found: ${audioPath}`);
            return;
        }
        
        this.resetResponseTimer();
        this.updateStatus('Playing…');
        
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
        this.stopResponseTimer();
        
        if (this.currentIndex < this.totalItems - 1) {
            this.currentIndex++;
            this.refreshPlayerUI();
            // Auto-play next
            setTimeout(() => this.handlePlay(), 100);
        } else {
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
            
            const outputDir = path.join(baseDir, 'Speech_in_Noise', 'Words');
            await fs.mkdir(outputDir, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outputPath = path.join(outputDir, `Words_${this.participantId}_${timestamp}.txt`);
            
            let output = [];
            
            output.push('='.repeat(60));
            output.push('Words Results');
            output.push('='.repeat(60));
            output.push('');
            output.push(`Participant ID: ${this.participantId}`);
            output.push(`Date: ${new Date().toLocaleString()}`);
            output.push(`Task: Words`);
            output.push('');
            
            output.push('='.repeat(60));
            output.push('TRIAL DATA');
            output.push('='.repeat(60));
            output.push('');
            
            for (let i = 0; i < this.csvData.length; i++) {
                const row = this.csvData[i];
                output.push(`Item ${i + 1}`);
                output.push(`  SNR: ${row['SNR'] || '—'}`);
                output.push(`  Number: ${row['Number'] || '—'}`);
                output.push(`  Word: ${row['Word'] || ''}`);
                output.push(`  Pronunciation: ${row['Pronunciation'] || ''}`);
                output.push(`  Correct: ${row['Correct1/Wrong0'] === '1' ? 'Yes' : 'No'}`);
                output.push('');
            }
            
            output.push('='.repeat(60));
            output.push('SUMMARY STATISTICS');
            output.push('='.repeat(60));
            output.push('');
            
            const snrSummary = this.calculateSNRSummary();
            const sortedSNRs = Object.keys(snrSummary).sort((a, b) => parseInt(b) - parseInt(a));
            for (const snr of sortedSNRs) {
                const stats = snrSummary[snr];
                const percent = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) : '0.0';
                output.push(`SNR ${snr} dB: ${stats.correct}/${stats.total} words correct (${percent}%)`);
            }
            
            output.push('');
            output.push('='.repeat(60));
            output.push('END OF RESULTS');
            output.push('='.repeat(60));
            
            await fs.writeFile(outputPath, output.join('\n'), 'utf8');
            console.log('Words results saved to:', outputPath);

            // Save CSV results file
            const csvOutputPath = path.join(outputDir, `Words_${this.participantId}_${timestamp}.csv`);
            const csvLines = ['SNR,Number,Word,Pronunciation,Correct1/Wrong0'];
            for (const row of this.csvData) {
                csvLines.push(`${row['SNR'] || ''},${row['Number'] || ''},${row['Word'] || ''},${row['Pronunciation'] || ''},${row['Correct1/Wrong0'] || ''}`);
            }
            await fs.writeFile(csvOutputPath, csvLines.join('\n'), 'utf8');
            console.log('Words CSV results saved to:', csvOutputPath);

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
            // File doesn't exist yet
        }

        for (const [snr, stats] of Object.entries(snrSummary)) {
            const snrNum = parseInt(snr);
            if (data[snrNum] !== undefined) {
                data[snrNum]['Words'] = stats.correct;
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
            
            summary[snr].total += 1;
            
            if (row['Correct1/Wrong0'] === '1') {
                summary[snr].correct += 1;
            }
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
        console.log('CaST Word task cleanup completed');
        window.castWordTaskInstance = null;
    }
}

// Global function to load and start the CaST Word task
async function loadCaSTWordTask(participantId) {
    try {
        console.log('Loading CaST Word task for participant:', participantId);
        
        window.castWordTaskInstance = new CaSTWordTask(participantId);
        await window.castWordTaskInstance.init();
        
    } catch (error) {
        console.error('Error loading CaST Word task:', error);
        alert('Error loading CaST Word task. Please check the configuration and try again.');
    }
}

window.loadCaSTWordTask = loadCaSTWordTask;