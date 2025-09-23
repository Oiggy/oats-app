class CVCTask {
    constructor(participantId) {
        this.participantId = participantId;
        this.config = null;
        this.stimulusList = [];
        this.currentPhase = 'welcome';
        this.currentTrialIndex = 0;
        this.results = [];
        this.sessionData = {
            startTime: new Date(),
            practiceCompleted: false,
            mainCompleted: false
        };
        
        // Current trial state
        this.currentLetter = null;
        this.currentFlag = null;
        this.letterOnsetTime = null;
        this.responseGiven = false;
        this.trialTimer = null;
        
        // Phase counters
        this.realWordsCompleted = 0;
        this.targetRealWords = 0;
        
        // Performance tracking
        this.stats = {
            hits: 0,
            misses: 0,
            falseAlarms: 0,
            correctRejections: 0,
            reactionTimes: []
        };

        // Modal elements
        this.modalOverlay = null;
        this.modalContent = null;
    }

    async init() {
        try {
            await this.loadConfiguration();
            await this.loadStimulusList();
            this.createTaskModal();
            this.showWelcomeScreen();
        } catch (error) {
            console.error('Error initializing CVC task:', error);
            alert('Error loading CVC task. Please check configuration.');
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
        
        const configPath = path.join(baseDir, 'cfg_cvc_task.json');
        const configData = await fs.readFile(configPath, 'utf8');
        this.config = JSON.parse(configData);
        
        console.log('CVC Configuration loaded:', this.config);
    }

    async loadStimulusList() {
        const path = window.require('path');
        const fs = window.require('fs').promises;
        
        // Load from the task directory
        const stimulusPath = path.join(__dirname, '..', 'tasks', 'cvc', 'vmtcvc.txt');
        const stimulusData = await fs.readFile(stimulusPath, 'utf8');
        
        // Parse the stimulus file - each line is: LETTER1,FLAG1,LETTER2,FLAG2
        const lines = stimulusData.trim().split('\n');
        this.stimulusList = lines.map((line, index) => {
            const parts = line.trim().split(','); // Use comma instead of tab
            if (parts.length < 4) {
                console.error('Invalid line in vmtcvc.txt at line', index + 1, ':', line);
                return null;
            }
            return {
                // List 1
                letter1: parts[0].trim(),
                flag1: parseInt(parts[1]),
                // List 2  
                letter2: parts[2].trim(),
                flag2: parseInt(parts[3])
            };
        }).filter(item => item !== null);
        
        console.log('Stimulus list loaded:', this.stimulusList.length, 'items');
        console.log('First few items:', this.stimulusList.slice(0, 5));
        console.log('Using stimulus list:', this.config.parameters.stimulus.list_selection);
    }

    createTaskModal() {
        // Create modal overlay
        this.modalOverlay = document.createElement('div');
        this.modalOverlay.className = 'cvc-task-overlay';
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
        this.modalContent.className = 'cvc-task-modal';
        this.modalContent.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            width: 90%;
            max-width: 800px;
            min-height: 500px;
            position: relative;
            display: flex;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        // Create modal HTML structure
        this.modalContent.innerHTML = `
            <div class="cvc-task-header" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px;
                border-bottom: 1px solid #e9ecef;
                background: white;
                border-radius: 12px 12px 0 0;
            ">
                <h1 style="
                    font-size: 18px;
                    font-weight: 600;
                    color: #212529;
                    margin: 0;
                ">CVC Task</h1>
                <span style="
                    font-size: 14px;
                    color: #6c757d;
                    font-weight: 500;
                ">Participant: ${this.participantId}</span>
                <button class="cvc-close-btn" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    color: #6c757d;
                    cursor: pointer;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                ">&times;</button>
            </div>
            <div class="cvc-task-content" style="
                flex: 1;
                padding: 40px 24px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
            " id="cvc-task-content">
                <!-- Content will be dynamically updated -->
            </div>
            <div class="cvc-task-footer" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 24px;
                border-top: 1px solid #e9ecef;
                background-color: #f8f9fa;
                border-radius: 0 0 12px 12px;
            ">
                <span class="cvc-status-text" style="
                    font-size: 14px;
                    color: #6c757d;
                " id="cvc-status-text">Ready to start</span>
                <div style="display: flex; gap: 8px;">
                    <button class="cvc-pause-btn" style="
                        background-color: #6c757d;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        font-size: 14px;
                        cursor: pointer;
                        display: none;
                    " id="cvc-pause-btn">Pause</button>
                    <button class="cvc-exit-btn" style="
                        background-color: #dc3545;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        font-size: 14px;
                        cursor: pointer;
                    ">Exit Task</button>
                </div>
            </div>
        `;

        // Create response hint
        this.responseHint = document.createElement('div');
        this.responseHint.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 10001;
            display: none;
        `;
        this.responseHint.textContent = 'Press SPACE when the last three letters form a real word (C-V-C)';

        // Append to overlay
        this.modalOverlay.appendChild(this.modalContent);
        document.body.appendChild(this.modalOverlay);
        document.body.appendChild(this.responseHint);

        // Bind events
        this.bindEvents();

        // Focus the modal
        this.modalContent.focus();
    }

    bindEvents() {
        // Close button
        const closeBtn = this.modalContent.querySelector('.cvc-close-btn');
        closeBtn.addEventListener('click', () => this.closeTask());

        // Exit button
        const exitBtn = this.modalContent.querySelector('.cvc-exit-btn');
        exitBtn.addEventListener('click', () => this.closeTask());

        // Close on overlay click
        this.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) {
                this.closeTask();
            }
        });

        // Keyboard events
        this.handleKeyPress = this.handleKeyPress.bind(this);
        document.addEventListener('keydown', this.handleKeyPress);

        // Click events for responses
        this.handleClick = this.handleClick.bind(this);
        this.modalContent.addEventListener('click', this.handleClick);

        // Prevent close button hover style
        const closeBtn2 = this.modalContent.querySelector('.cvc-close-btn');
        closeBtn2.addEventListener('mouseenter', () => {
            closeBtn2.style.backgroundColor = '#f8f9fa';
        });
        closeBtn2.addEventListener('mouseleave', () => {
            closeBtn2.style.backgroundColor = '';
        });
    }

    showWelcomeScreen() {
        this.updateStatus('Ready to start');
        
        const content = `
            <h2 style="
                font-size: 24px;
                font-weight: 600;
                color: #212529;
                margin-bottom: 24px;
            ">Welcome to the CVC Task</h2>
            
            <div style="
                font-size: 16px;
                line-height: 1.6;
                color: #495057;
                margin-bottom: 32px;
                max-width: 600px;
            ">
                Letters will appear one at a time in a continuous stream. Press <strong>SPACE</strong> (or click) 
                <strong>when the last three letters form a real 3-letter word (C–V–C)</strong>, e.g., P–E–N. 
                You will do a short practice, then the main phase. The configuration shown below determines 
                trial counts, letter pacing, and how many real words will be presented in each phase.
            </div>
            
            <div style="
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 8px;
                padding: 20px;
                margin: 24px 0;
                width: 100%;
                max-width: 400px;
            ">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                    <span style="color: #495057;">Practice Trials:</span>
                    <span style="font-weight: 600; color: #212529;">${this.config.parameters.trials.practice}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                    <span style="color: #495057;">Real Words (Practice):</span>
                    <span style="font-weight: 600; color: #212529;">${this.config.parameters.trials.practice_real_words}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                    <span style="color: #495057;">Main Trials:</span>
                    <span style="font-weight: 600; color: #212529;">${this.config.parameters.trials.main}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                    <span style="color: #495057;">Real Words (Main):</span>
                    <span style="font-weight: 600; color: #212529;">${this.config.parameters.trials.main_real_words}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                    <span style="color: #495057;">Letter Display Duration:</span>
                    <span style="font-weight: 600; color: #212529;">${this.config.parameters.timing.letter_display_duration}ms</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 14px;">
                    <span style="color: #495057;">Stimulus List:</span>
                    <span style="font-weight: 600; color: #212529;">List ${this.config.parameters.stimulus.list_selection}</span>
                </div>
            </div>
            
            <button onclick="window.cvcTaskInstance.startPractice()" style="
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

    startPractice() {
        this.currentPhase = 'practice';
        this.currentTrialIndex = 0;
        this.realWordsCompleted = 0;
        this.targetRealWords = this.config.parameters.trials.practice_real_words;
        this.resetStats();
        
        this.updateStatus('Practice phase');
        this.showResponseHint(true);
        
        // For practice, use hardcoded stimuli instead of vmtcvc.txt
        this.runPracticeTrial();
    }

    startMain() {
        this.currentPhase = 'main';
        this.currentTrialIndex = 0;
        this.realWordsCompleted = 0;
        this.targetRealWords = this.config.parameters.trials.main_real_words;
        this.resetStats();
        
        this.updateStatus('Main phase');
        this.showResponseHint(true);
        this.runTrial();
    }

    runPracticeTrial() {
        // Check if we've completed enough real words for practice
        if (this.realWordsCompleted >= this.targetRealWords) {
            this.endPractice();
            return;
        }

        // Hardcoded practice sequence: M-U-D (3 real words)
        const practiceSequence = [
            { letter: 'M', flag: 0 },   // M
            { letter: 'U', flag: 0 },   // U  
            { letter: 'D', flag: -1 },  // D (completes MUD)
            { letter: 'P', flag: 0 },   // P
            { letter: 'E', flag: 0 },   // E
            { letter: 'N', flag: -1 },  // N (completes PEN)
            { letter: 'C', flag: 0 },   // C
            { letter: 'A', flag: 0 },   // A
            { letter: 'T', flag: -1 }   // T (completes CAT)
        ];

        // Check if we've exceeded the practice sequence
        if (this.currentTrialIndex >= practiceSequence.length) {
            this.endPractice();
            return;
        }

        // Get current practice stimulus
        const stimulus = practiceSequence[this.currentTrialIndex];
        this.currentLetter = stimulus.letter;
        this.currentFlag = stimulus.flag;
        this.responseGiven = false;
        
        console.log('Practice Trial', this.currentTrialIndex, '- Displaying letter:', this.currentLetter, 'with flag:', this.currentFlag);
        
        // Display only the single letter
        this.showLetter();
        this.letterOnsetTime = performance.now();
        
        // Schedule processing and next trial
        this.trialTimer = setTimeout(() => {
            this.processTrial();
            this.currentTrialIndex++;
            this.runPracticeTrial();
        }, this.config.parameters.timing.letter_display_duration);
    }

    runTrial() {
        // Check if we've completed enough real words
        if (this.realWordsCompleted >= this.targetRealWords) {
            this.endMain();
            return;
        }

        // Get current stimulus - use configured list selection
        const stimulus = this.stimulusList[this.currentTrialIndex % this.stimulusList.length];
        const useList2 = this.config.parameters.stimulus.list_selection === 2;
        
        // Choose between List 1 and List 2 based on configuration
        this.currentLetter = useList2 ? stimulus.letter2 : stimulus.letter1;
        this.currentFlag = useList2 ? stimulus.flag2 : stimulus.flag1;
        this.responseGiven = false;
        
        console.log('Trial', this.currentTrialIndex, '- Displaying letter:', this.currentLetter, 'with flag:', this.currentFlag, '(List', this.config.parameters.stimulus.list_selection + ')');
        
        // Display only the single letter
        this.showLetter();
        this.letterOnsetTime = performance.now();
        
        // Schedule processing and next trial
        this.trialTimer = setTimeout(() => {
            this.processTrial();
            this.currentTrialIndex++;
            this.runTrial();
        }, this.config.parameters.timing.letter_display_duration);
    }

    showLetter() {
        const progressText = `Real words completed: ${this.realWordsCompleted} / ${this.targetRealWords}`;
        
        const content = `
            <div style="
                font-size: 16px;
                color: #6c757d;
                margin-bottom: 20px;
            ">${progressText}</div>
            <div style="
                font-size: 120px;
                font-weight: bold;
                color: #212529;
                font-family: 'Courier New', monospace;
                margin: 40px 0;
                min-height: 150px;
                display: flex;
                align-items: center;
                justify-content: center;
            ">${this.currentLetter}</div>
        `;
        
        this.updateContent(content);
    }

    processTrial() {
        const responseTime = this.responseGiven ? performance.now() : null;
        const reactionTime = this.responseGiven ? responseTime - this.letterOnsetTime : null;
        
        // Determine trial outcome
        let outcome;
        const isRealWord = this.currentFlag === -1;
        
        if (isRealWord && this.responseGiven) {
            outcome = 'hit';
            this.stats.hits++;
        } else if (isRealWord && !this.responseGiven) {
            outcome = 'miss';
            this.stats.misses++;
        } else if (!isRealWord && this.responseGiven) {
            outcome = 'false_alarm';
            this.stats.falseAlarms++;
        } else {
            outcome = 'correct_rejection';
            this.stats.correctRejections++;
        }
        
        // Track reaction times for responses
        if (this.responseGiven && reactionTime) {
            this.stats.reactionTimes.push(reactionTime);
        }
        
        // Count real words (only when flag is -1)
        if (isRealWord) {
            this.realWordsCompleted++;
        }
        
        // Save trial data for main phase (not practice)
        if (this.currentPhase === 'main') {
            this.results.push({
                trial: this.currentTrialIndex + 1,
                phase: this.currentPhase,
                letter: this.currentLetter,
                flag: this.currentFlag,
                stimulus_list: this.config.parameters.stimulus.list_selection,
                is_real_word: isRealWord,
                response_given: this.responseGiven,
                reaction_time_ms: reactionTime,
                outcome: outcome,
                timestamp: new Date().toISOString()
            });
        }
    }

    endPractice() {
        this.showResponseHint(false);
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
                You identified ${this.realWordsCompleted} real words during practice.
                <br><br>
                Now you'll begin the main phase using <strong>Stimulus List ${this.config.parameters.stimulus.list_selection}</strong>. 
                The task works the same way. Remember: Press SPACE when the last three letters form a real word.
            </div>
            
            <button onclick="window.cvcTaskInstance.startMain()" style="
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
                Begin Main Phase
            </button>
        `;
        
        this.updateContent(content);
    }

    endMain() {
        this.showResponseHint(false);
        this.updateStatus('Task complete');
        this.showSummary();
        this.saveResults();
    }

    showSummary() {
        const avgRT = this.stats.reactionTimes.length > 0 ? 
            this.stats.reactionTimes.reduce((a, b) => a + b, 0) / this.stats.reactionTimes.length : 0;
        
        const medianRT = this.stats.reactionTimes.length > 0 ? 
            this.calculateMedian([...this.stats.reactionTimes].sort((a, b) => a - b)) : 0;
        
        const totalTrials = this.stats.hits + this.stats.misses + this.stats.falseAlarms + this.stats.correctRejections;
        
        const content = `
            <h2 style="
                font-size: 24px;
                font-weight: 600;
                color: #212529;
                margin-bottom: 24px;
            ">Task Complete!</h2>
            
            <div style="
                font-size: 16px;
                line-height: 1.6;
                color: #495057;
                margin-bottom: 32px;
                max-width: 600px;
            ">
                You have completed the CVC task using <strong>Stimulus List ${this.config.parameters.stimulus.list_selection}</strong>. 
                Here's your performance summary:
            </div>
            
            <div style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 16px;
                margin: 32px 0;
                width: 100%;
                max-width: 600px;
            ">
                ${this.generateStatCards(totalTrials, avgRT, medianRT)}
            </div>
        `;
        
        this.updateContent(content);
    }

    generateStatCards(totalTrials, avgRT, medianRT) {
        const stats = [
            { label: 'Total Letters', value: totalTrials },
            { label: 'Hits', value: this.stats.hits },
            { label: 'Misses', value: this.stats.misses },
            { label: 'False Alarms', value: this.stats.falseAlarms },
            { label: 'Correct Rejections', value: this.stats.correctRejections },
            { label: 'Avg RT (ms)', value: avgRT.toFixed(0) },
            { label: 'Median RT (ms)', value: medianRT.toFixed(0) }
        ];

        return stats.map(stat => `
            <div style="
                text-align: center;
                padding: 16px;
                border: 1px solid #dee2e6;
                border-radius: 8px;
                background: white;
            ">
                <div style="
                    font-size: 24px;
                    font-weight: 600;
                    color: #212529;
                    margin-bottom: 4px;
                ">${stat.value}</div>
                <div style="
                    font-size: 12px;
                    color: #6c757d;
                    font-weight: 500;
                ">${stat.label}</div>
            </div>
        `).join('');
    }

    handleKeyPress(e) {
        if (e.code === 'Space' && (this.currentPhase === 'practice' || this.currentPhase === 'main')) {
            e.preventDefault();
            this.responseGiven = true;
        }
    }

    handleClick(e) {
        if (this.currentPhase === 'practice' || this.currentPhase === 'main') {
            this.responseGiven = true;
        }
    }

    updateContent(html) {
        const contentEl = document.getElementById('cvc-task-content');
        if (contentEl) {
            contentEl.innerHTML = html;
        }
    }

    updateStatus(status) {
        const statusEl = document.getElementById('cvc-status-text');
        if (statusEl) {
            statusEl.textContent = status;
        }
    }

    showResponseHint(show) {
        if (this.responseHint) {
            this.responseHint.style.display = show ? 'block' : 'none';
        }
    }

    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            falseAlarms: 0,
            correctRejections: 0,
            reactionTimes: []
        };
    }

    calculateMedian(arr) {
        const mid = Math.floor(arr.length / 2);
        return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
    }

    async saveResults() {
        try {
            const os = window.require('os');
            const path = window.require('path');
            const fs = window.require('fs').promises;
            
            // Create session directory
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const sessionDir = path.join(
                os.homedir(), 
                'Documents', 
                'Oats', 
                'sessions', 
                this.participantId, 
                `cvc_${timestamp}`
            );
            
            await fs.mkdir(sessionDir, { recursive: true });
            
            // Generate results content
            const resultsContent = this.generateResultsContent();
            
            // Save results file
            const resultsPath = path.join(sessionDir, 'results.txt');
            await fs.writeFile(resultsPath, resultsContent, 'utf8');
            
            console.log('CVC results saved to:', resultsPath);
            
        } catch (error) {
            console.error('Error saving CVC results:', error);
            alert('Error saving results. Please contact the researcher.');
        }
    }

    generateResultsContent() {
        const endTime = new Date();
        const duration = Math.round((endTime - this.sessionData.startTime) / 1000);
        
        const avgRT = this.stats.reactionTimes.length > 0 ? 
            this.stats.reactionTimes.reduce((a, b) => a + b, 0) / this.stats.reactionTimes.length : 0;
        
        const medianRT = this.stats.reactionTimes.length > 0 ? 
            this.calculateMedian([...this.stats.reactionTimes].sort((a, b) => a - b)) : 0;

        let content = '';
        content += '='.repeat(60) + '\n';
        content += '                    CVC TASK RESULTS\n';
        content += '='.repeat(60) + '\n\n';
        
        // Session Information
        content += 'SESSION INFORMATION\n';
        content += '-'.repeat(30) + '\n';
        content += `Participant ID: ${this.participantId}\n`;
        content += `Task: CVC Task\n`;
        content += `Start Time: ${this.sessionData.startTime.toLocaleString()}\n`;
        content += `End Time: ${endTime.toLocaleString()}\n`;
        content += `Total Duration: ${duration}s\n\n`;
        
        // Configuration
        content += 'TASK CONFIGURATION\n';
        content += '-'.repeat(30) + '\n';
        const config = this.config.parameters;
        content += `Practice Trials: ${config.trials.practice}\n`;
        content += `Practice Real Words: ${config.trials.practice_real_words}\n`;
        content += `Main Trials: ${config.trials.main}\n`;
        content += `Main Real Words: ${config.trials.main_real_words}\n`;
        content += `Letter Display Duration: ${config.timing.letter_display_duration}ms\n`;
        content += `Stimulus List Used: List ${config.stimulus.list_selection}\n\n`;
        
        // Performance Summary
        const totalTrials = this.stats.hits + this.stats.misses + this.stats.falseAlarms + this.stats.correctRejections;
        content += 'PERFORMANCE SUMMARY\n';
        content += '-'.repeat(30) + '\n';
        content += `Total Letters Presented: ${totalTrials}\n`;
        content += `Hits: ${this.stats.hits}\n`;
        content += `Misses: ${this.stats.misses}\n`;
        content += `False Alarms: ${this.stats.falseAlarms}\n`;
        content += `Correct Rejections: ${this.stats.correctRejections}\n`;
        content += `Total Responses: ${this.stats.reactionTimes.length}\n`;
        content += `Average Reaction Time: ${avgRT.toFixed(1)}ms\n`;
        content += `Median Reaction Time: ${medianRT.toFixed(1)}ms\n\n`;
        
        // Trial-by-trial data
        content += 'DETAILED TRIAL DATA\n';
        content += '-'.repeat(90) + '\n';
        content += 'Trial | Letter | Flag | List | RealWord | Response | RT(ms) | Outcome\n';
        content += '-'.repeat(90) + '\n';
        
        for (const trial of this.results) {
            const trialNum = trial.trial.toString().padStart(5);
            const letter = trial.letter.padEnd(6);
            const flag = trial.flag.toString().padStart(4);
            const list = trial.stimulus_list.toString().padStart(4);
            const realWord = trial.is_real_word ? 'Yes' : 'No';
            const response = trial.response_given ? 'Yes' : 'No';
            const rt = trial.reaction_time_ms ? trial.reaction_time_ms.toFixed(1).padStart(8) : 'N/A'.padStart(8);
            const outcome = trial.outcome.padEnd(15);
            
            content += `${trialNum} | ${letter} | ${flag} | ${list} | ${realWord.padEnd(8)} | ${response.padEnd(8)} | ${rt} | ${outcome}\n`;
        }
        
        content += '\n' + '='.repeat(60) + '\n';
        content += 'End of Results\n';
        content += '='.repeat(60) + '\n';
        
        return content;
    }

    closeTask() {
        // Clear any running timers
        if (this.trialTimer) {
            clearTimeout(this.trialTimer);
        }
        
        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeyPress);
        
        // Remove modal elements
        if (this.modalOverlay && this.modalOverlay.parentNode) {
            this.modalOverlay.parentNode.removeChild(this.modalOverlay);
        }
        if (this.responseHint && this.responseHint.parentNode) {
            this.responseHint.parentNode.removeChild(this.responseHint);
        }
        
        this.cleanup();
    }

    cleanup() {
        console.log('CVC task cleanup completed');
        // Clean up instance
        window.cvcTaskInstance = null;
    }
}

// Global function to load and start the CVC task
async function loadCVCTask(participantId) {
    try {
        console.log('Loading CVC task for participant:', participantId);
        
        // Create and initialize task instance
        window.cvcTaskInstance = new CVCTask(participantId);
        await window.cvcTaskInstance.init();
        
    } catch (error) {
        console.error('Error loading CVC task:', error);
        alert('Error loading CVC task. Please check the configuration and try again.');
    }
}

// Make it globally available
window.loadCVCTask = loadCVCTask;