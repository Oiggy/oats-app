class ReadingSpanConfig {
    constructor() {
        this.defaultConfig = {
            trials: {
                practice_series: 2,
                main_series: 5
            },
            timing: {
                practice_sentence_duration: 3000,
                main_sentence_duration: 5000,
                recall_time_duration: 5000
            },
            data: {
                enable_crash_recovery_logs: true
            }
        };
        this.currentConfig = JSON.parse(JSON.stringify(this.defaultConfig));
    }

    generateConfigHTML() {
        return `
            <div class="modal-header">
                <h2 class="modal-title">Reading Span Task Configuration</h2>
                <button type="button" class="modal-close" aria-label="Close configuration">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L10 9.293l4.646-4.647a.5.5 0 0 1 .708.708L10.707 10l4.647 4.646a.5.5 0 0 1-.708.708L10 10.707l-4.646 4.647a.5.5 0 0 1-.708-.708L9.293 10 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                    </svg>
                </button>
            </div>

            <div class="modal-body">
                <!-- Tabs -->
                <div class="config-tabs">
                    <button class="config-tab active" data-tab="trials">Trials</button>
                    <button class="config-tab" data-tab="timing">Timing</button>
                    <button class="config-tab" data-tab="data">Data</button>
                </div>

                <!-- Trials Tab -->
                <div class="config-tab-content active" id="trials-tab">
                    <div class="config-card">
                        <h3>Series Parameters</h3>
                        
                        <div class="config-row">
                            <div class="config-group">
                                <label for="practice-series">Number of Practice Series</label>
                                <div class="number-stepper">
                                    <button type="button" data-action="decrease" data-target="practice-series">−</button>
                                    <input type="number" id="practice-series" name="practice_series" min="1" max="2" value="${this.currentConfig.trials.practice_series}" readonly>
                                    <button type="button" data-action="increase" data-target="practice-series">+</button>
                                </div>
                                <div class="help-text">Range: 1-2</div>
                            </div>
                            
                            <div class="config-group">
                                <label for="main-series">Number of Main Series</label>
                                <div class="number-stepper">
                                    <button type="button" data-action="decrease" data-target="main-series">−</button>
                                    <input type="number" id="main-series" name="main_series" min="1" max="10" value="${this.currentConfig.trials.main_series}" readonly>
                                    <button type="button" data-action="increase" data-target="main-series">+</button>
                                </div>
                                <div class="help-text">Range: 1-10</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Timing Tab -->
                <div class="config-tab-content" id="timing-tab">
                    <div class="config-card">
                        <h3>Duration Parameters</h3>
                        
                        <div class="config-group">
                            <label for="practice-sentence-duration">Practice Sentence Duration</label>
                            <div class="slider-control">
                                <div class="slider-value">
                                    <span>Duration</span>
                                    <span class="slider-value-display" id="practice-sentence-value">${this.currentConfig.timing.practice_sentence_duration} ms</span>
                                </div>
                                <input type="range" id="practice-sentence-duration" name="practice_sentence_duration" min="1000" max="8000" step="500" value="${this.currentConfig.timing.practice_sentence_duration}" class="config-slider">
                            </div>
                            <div class="help-text">Duration each practice sentence is displayed (Range: 1000-8000ms, steps of 500ms)</div>
                        </div>

                        <div class="config-group">
                            <label for="main-sentence-duration">Main Sentence Duration</label>
                            <div class="slider-control">
                                <div class="slider-value">
                                    <span>Duration</span>
                                    <span class="slider-value-display" id="main-sentence-value">${this.currentConfig.timing.main_sentence_duration} ms</span>
                                </div>
                                <input type="range" id="main-sentence-duration" name="main_sentence_duration" min="1000" max="8000" step="500" value="${this.currentConfig.timing.main_sentence_duration}" class="config-slider">
                            </div>
                            <div class="help-text">Duration each main task sentence is displayed (Range: 1000-8000ms, steps of 500ms)</div>
                        </div>

                        <div class="config-group">
                            <label for="recall-time-duration">Recall Time Duration</label>
                            <div class="slider-control">
                                <div class="slider-value">
                                    <span>Duration</span>
                                    <span class="slider-value-display" id="recall-time-value">${this.currentConfig.timing.recall_time_duration} ms</span>
                                </div>
                                <input type="range" id="recall-time-duration" name="recall_time_duration" min="1000" max="8000" step="500" value="${this.currentConfig.timing.recall_time_duration}" class="config-slider">
                            </div>
                            <div class="help-text">Time allowed for participants to recall and enter words (Range: 1000-8000ms, steps of 500ms)</div>
                        </div>
                    </div>
                </div>

                <!-- Data Tab -->
                <div class="config-tab-content" id="data-tab">
                    <div class="config-card">
                        <h3>Data Collection</h3>
                        
                        <div class="config-group">
                            <label for="crash-recovery-logs">Enable Crash Recovery Logs</label>
                            <div class="toggle-switch">
                                <input type="checkbox" id="crash-recovery-logs" name="crash_recovery" ${this.currentConfig.data.enable_crash_recovery_logs ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </div>
                            <div class="help-text">Automatically save progress data to recover from unexpected interruptions</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <button type="button" class="button-secondary" id="config-cancel-btn">Cancel</button>
                <button type="button" class="button-primary" id="config-save-btn">
                    <span class="button-text">Save Configuration</span>
                    <span class="button-loading" aria-hidden="true">Saving...</span>
                </button>
            </div>
        `;
    }

    bindConfigEvents() {
        const modalContent = document.querySelector('.modal-content');
        
        // Close button
        const closeBtn = modalContent.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeConfigModal();
            });
        }

        // Cancel button
        const cancelBtn = modalContent.querySelector('#config-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeConfigModal();
            });
        }

        // Save button
        const saveBtn = modalContent.querySelector('#config-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveConfiguration();
            });
        }

        // Tab switching
        const tabs = modalContent.querySelectorAll('.config-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.getAttribute('data-tab'));
            });
        });

        // Number steppers
        const stepperButtons = modalContent.querySelectorAll('.number-stepper button');
        stepperButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.handleStepperClick(button);
            });
        });

        // Sliders
        const sliders = modalContent.querySelectorAll('.config-slider');
        sliders.forEach(slider => {
            slider.addEventListener('input', () => {
                this.updateSliderValue(slider);
            });
        });

        // Toggle switches
        const toggleSwitches = modalContent.querySelectorAll('.toggle-switch');
        toggleSwitches.forEach(toggleSwitch => {
            const checkbox = toggleSwitch.querySelector('input[type="checkbox"]');
            const slider = toggleSwitch.querySelector('.toggle-slider');
            
            if (checkbox && slider) {
                slider.addEventListener('click', () => {
                    checkbox.checked = !checkbox.checked;
                    console.log(`Toggle switch ${checkbox.name} is now: ${checkbox.checked}`);
                });
                
                checkbox.addEventListener('change', () => {
                    console.log(`Toggle switch ${checkbox.name} changed to: ${checkbox.checked}`);
                });
            }
        });
    }

    switchTab(tabName) {
        // Remove active class from all tabs and content
        document.querySelectorAll('.config-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.config-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Add active class to selected tab and content
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    handleStepperClick(button) {
        const action = button.getAttribute('data-action');
        const targetId = button.getAttribute('data-target');
        const input = document.getElementById(targetId);
        
        if (!input) return;

        let currentValue = parseInt(input.value) || 0;
        const min = parseInt(input.getAttribute('min')) || 0;
        const max = parseInt(input.getAttribute('max')) || 100;

        if (action === 'increase' && currentValue < max) {
            currentValue += 1;
        } else if (action === 'decrease' && currentValue > min) {
            currentValue -= 1;
        }

        input.value = currentValue;

        // Update button states
        const decreaseBtn = button.parentElement.querySelector('[data-action="decrease"]');
        const increaseBtn = button.parentElement.querySelector('[data-action="increase"]');
        
        if (decreaseBtn) decreaseBtn.disabled = (currentValue <= min);
        if (increaseBtn) increaseBtn.disabled = (currentValue >= max);
    }

    updateSliderValue(slider) {
        const value = slider.value;
        const sliderName = slider.name;
        
        switch(sliderName) {
            case 'practice_sentence_duration':
                document.getElementById('practice-sentence-value').textContent = `${value} ms`;
                break;
            case 'main_sentence_duration':
                document.getElementById('main-sentence-value').textContent = `${value} ms`;
                break;
            case 'recall_time_duration':
                document.getElementById('recall-time-value').textContent = `${value} ms`;
                break;
        }
    }

    collectConfigFromUI() {
        return {
            trials: {
                practice_series: parseInt(document.getElementById('practice-series').value),
                main_series: parseInt(document.getElementById('main-series').value)
            },
            timing: {
                practice_sentence_duration: parseInt(document.getElementById('practice-sentence-duration').value),
                main_sentence_duration: parseInt(document.getElementById('main-sentence-duration').value),
                recall_time_duration: parseInt(document.getElementById('recall-time-duration').value)
            },
            data: {
                enable_crash_recovery_logs: document.getElementById('crash-recovery-logs').checked
            }
        };
    }

    async saveConfiguration() {
        try {
            const config = this.collectConfigFromUI();
            this.currentConfig = config;

            // Add metadata
            const fullConfig = {
                task_type: 'reading_span',
                task_name: 'Reading Span Task',
                version: '1.0.0',
                created_at: new Date().toISOString(),
                parameters: config
            };

            await this.saveConfigurationToFile(fullConfig);

            // Show success message
            this.showSaveSuccess();

            // Mark step 3 as completed (stepper connector turns green)
            if (window.dashboard) {
                window.dashboard.updateStepState(3, 'completed');
            }

            // Enable run task button and close modal
            this.enableRunTaskButton();
            this.closeConfigModal();

        } catch (error) {
            console.error('Error saving Reading Span configuration:', error);
            alert('Error saving configuration. Please try again.');
        }
    }

    async saveConfigurationToFile(config) {
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

        await fs.mkdir(baseDir, { recursive: true });

        const configPath = path.join(baseDir, 'cfg_reading_span_task.json');
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

        console.log('Reading Span configuration saved to:', configPath);
    }

    showSaveSuccess() {
        const saveBtn = document.getElementById('config-save-btn');
        const originalText = saveBtn.querySelector('.button-text').textContent;
        saveBtn.querySelector('.button-text').textContent = 'Saved!';
        saveBtn.style.backgroundColor = '#28a745';

        setTimeout(() => {
            saveBtn.querySelector('.button-text').textContent = originalText;
            saveBtn.style.backgroundColor = '';
        }, 2000);
    }

    enableRunTaskButton() {
        const runTaskBtn = document.getElementById('run-task-btn');
        if (runTaskBtn) {
            runTaskBtn.disabled = false;
            runTaskBtn.textContent = 'Run the task';
        }
    }

    closeConfigModal() {
        // Use the dashboard's modal close method
        if (window.dashboard) {
            window.dashboard.closeConfigModal();
        }
    }

    async loadExistingConfiguration() {
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

            const configPath = path.join(baseDir, 'cfg_reading_span_task.json');
            const configData = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configData);

            if (config.parameters) {
                this.currentConfig = config.parameters;
                return config;
            }
        } catch (error) {
            console.log('No existing Reading Span configuration found, using defaults');
        }
        return null;
    }

    updateUIFromConfig() {
        // Update trials
        document.getElementById('practice-series').value = this.currentConfig.trials.practice_series;
        document.getElementById('main-series').value = this.currentConfig.trials.main_series;

        // Update timing
        document.getElementById('practice-sentence-duration').value = this.currentConfig.timing.practice_sentence_duration;
        document.getElementById('practice-sentence-value').textContent = this.currentConfig.timing.practice_sentence_duration + ' ms';
        
        document.getElementById('main-sentence-duration').value = this.currentConfig.timing.main_sentence_duration;
        document.getElementById('main-sentence-value').textContent = this.currentConfig.timing.main_sentence_duration + ' ms';
        
        document.getElementById('recall-time-duration').value = this.currentConfig.timing.recall_time_duration;
        document.getElementById('recall-time-value').textContent = this.currentConfig.timing.recall_time_duration + ' ms';

        // Update data
        document.getElementById('crash-recovery-logs').checked = this.currentConfig.data.enable_crash_recovery_logs;
    }
}

// Make it globally available
window.ReadingSpanConfig = ReadingSpanConfig;

// Auto-instantiate for dashboard integration
window.readingSpanConfig = new ReadingSpanConfig();