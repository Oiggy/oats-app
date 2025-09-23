class CVCConfig {
    constructor() {
        this.defaultConfig = {
            trials: {
                practice: 6,
                practice_real_words: 3,
                main: 44,
                main_real_words: 22
            },
            timing: {
                letter_display_duration: 2000
            },
            stimulus: {
                list_selection: 1  // 1 or 2
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
                <h2 class="modal-title">CVC Task Configuration</h2>
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
                    <button class="config-tab" data-tab="stimulus">Stimulus</button>
                    <button class="config-tab" data-tab="data">Data</button>
                </div>

                <!-- Trials Tab -->
                <div class="config-tab-content active" id="trials-tab">
                    <div class="config-card">
                        <h3>Practice Phase</h3>
                        
                        <div class="config-row">
                            <div class="config-group">
                                <label for="practice-trials">Number of Practice Trials</label>
                                <div class="number-stepper">
                                    <button type="button" data-action="decrease" data-target="practice-trials">−</button>
                                    <input type="number" id="practice-trials" name="practice_trials" min="1" max="6" value="${this.currentConfig.trials.practice}" readonly>
                                    <button type="button" data-action="increase" data-target="practice-trials">+</button>
                                </div>
                                <div class="help-text">Range: 1-6 (hardcoded for practice)</div>
                            </div>
                            
                            <div class="config-group">
                                <label for="practice-real-words">Real Words to Present (Practice)</label>
                                <div class="number-stepper">
                                    <button type="button" data-action="decrease" data-target="practice-real-words">−</button>
                                    <input type="number" id="practice-real-words" name="practice_real_words" min="1" max="3" value="${this.currentConfig.trials.practice_real_words}" readonly>
                                    <button type="button" data-action="increase" data-target="practice-real-words">+</button>
                                </div>
                                <div class="help-text">Range: 1-3 (hardcoded for practice)</div>
                            </div>
                        </div>
                    </div>

                    <div class="config-card">
                        <h3>Main Phase</h3>
                        
                        <div class="config-row">
                            <div class="config-group">
                                <label for="main-trials">Number of Main Trials</label>
                                <div class="number-stepper">
                                    <button type="button" data-action="decrease" data-target="main-trials">−</button>
                                    <input type="number" id="main-trials" name="main_trials" min="1" max="44" value="${this.currentConfig.trials.main}" readonly>
                                    <button type="button" data-action="increase" data-target="main-trials">+</button>
                                </div>
                                <div class="help-text">Range: 1-44 (max based on stimulus list length)</div>
                            </div>
                            
                            <div class="config-group">
                                <label for="main-real-words">Real Words to Present (Main)</label>
                                <div class="number-stepper">
                                    <button type="button" data-action="decrease" data-target="main-real-words">−</button>
                                    <input type="number" id="main-real-words" name="main_real_words" min="1" max="22" value="${this.currentConfig.trials.main_real_words}" readonly>
                                    <button type="button" data-action="increase" data-target="main-real-words">+</button>
                                </div>
                                <div class="help-text">Range: 1-22 (max real words available per list)</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Timing Tab -->
                <div class="config-tab-content" id="timing-tab">
                    <div class="config-card">
                        <h3>Display Timing</h3>
                        
                        <div class="config-group">
                            <label for="letter-display-duration">Letter Display Duration</label>
                            <div class="slider-control">
                                <div class="slider-value">
                                    <span>Duration</span>
                                    <span class="slider-value-display" id="letter-duration-value">${this.currentConfig.timing.letter_display_duration} ms</span>
                                </div>
                                <input type="range" id="letter-display-duration" name="letter_display_duration" min="500" max="5000" step="100" value="${this.currentConfig.timing.letter_display_duration}" class="config-slider">
                            </div>
                            <div class="help-text">Duration each letter stays on screen before the next one appears (Range: 500-5000ms)</div>
                        </div>
                    </div>
                </div>

                <!-- Stimulus Tab -->
                <div class="config-tab-content" id="stimulus-tab">
                    <div class="config-card">
                        <h3>Stimulus List Selection</h3>
                        
                        <div class="config-group">
                            <label for="list-selection">Choose Stimulus List</label>
                            <div class="radio-group">
                                <label class="radio-option">
                                    <input type="radio" name="list_selection" value="1" ${this.currentConfig.stimulus.list_selection === 1 ? 'checked' : ''}>
                                    <span class="radio-label">List 1</span>
                                    <div class="radio-description">Use first stimulus list (columns 1 & 2)</div>
                                </label>
                                <label class="radio-option">
                                    <input type="radio" name="list_selection" value="2" ${this.currentConfig.stimulus.list_selection === 2 ? 'checked' : ''}>
                                    <span class="radio-label">List 2</span>
                                    <div class="radio-description">Use second stimulus list (columns 3 & 4)</div>
                                </label>
                            </div>
                            <div class="help-text">Both lists contain 22 real words (-1 flags) each. Select which list to use for this session.</div>
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

            <style>
                .radio-group {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-top: 8px;
                }
                
                .radio-option {
                    display: flex;
                    align-items: flex-start;
                    padding: 12px;
                    border: 2px solid #e9ecef;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .radio-option:hover {
                    border-color: #007bff;
                    background-color: #f8f9ff;
                }
                
                .radio-option input[type="radio"] {
                    margin: 0 12px 0 0;
                    width: 18px;
                    height: 18px;
                }
                
                .radio-option input[type="radio"]:checked {
                    accent-color: #007bff;
                }
                
                .radio-option:has(input:checked) {
                    border-color: #007bff;
                    background-color: #f8f9ff;
                }
                
                .radio-label {
                    font-weight: 600;
                    color: #212529;
                    margin-bottom: 4px;
                    display: block;
                }
                
                .radio-description {
                    font-size: 13px;
                    color: #6c757d;
                    line-height: 1.4;
                }
            </style>
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

        // Radio buttons for list selection
        const radioButtons = modalContent.querySelectorAll('input[name="list_selection"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', () => {
                console.log('List selection changed to:', radio.value);
            });
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
        
        if (sliderName === 'letter_display_duration') {
            document.getElementById('letter-duration-value').textContent = `${value} ms`;
        }
    }

    collectConfigFromUI() {
        // Get selected list
        const selectedList = document.querySelector('input[name="list_selection"]:checked');
        
        return {
            trials: {
                practice: parseInt(document.getElementById('practice-trials').value),
                practice_real_words: parseInt(document.getElementById('practice-real-words').value),
                main: parseInt(document.getElementById('main-trials').value),
                main_real_words: parseInt(document.getElementById('main-real-words').value)
            },
            timing: {
                letter_display_duration: parseInt(document.getElementById('letter-display-duration').value)
            },
            stimulus: {
                list_selection: selectedList ? parseInt(selectedList.value) : 1
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
                task_type: 'cvc',
                task_name: 'CVC Task',
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
            console.error('Error saving CVC configuration:', error);
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

        const configPath = path.join(baseDir, 'cfg_cvc_task.json');
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

        console.log('CVC configuration saved to:', configPath);
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

            const configPath = path.join(baseDir, 'cfg_cvc_task.json');
            const configData = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configData);

            if (config.parameters) {
                this.currentConfig = config.parameters;
                return config;
            }
        } catch (error) {
            console.log('No existing CVC configuration found, using defaults');
        }
        return null;
    }

    updateUIFromConfig() {
        // Update trials
        document.getElementById('practice-trials').value = this.currentConfig.trials.practice;
        document.getElementById('practice-real-words').value = this.currentConfig.trials.practice_real_words;
        document.getElementById('main-trials').value = this.currentConfig.trials.main;
        document.getElementById('main-real-words').value = this.currentConfig.trials.main_real_words;

        // Update timing
        document.getElementById('letter-display-duration').value = this.currentConfig.timing.letter_display_duration;
        document.getElementById('letter-duration-value').textContent = this.currentConfig.timing.letter_display_duration + ' ms';

        // Update stimulus list selection
        const listRadio = document.querySelector(`input[name="list_selection"][value="${this.currentConfig.stimulus.list_selection}"]`);
        if (listRadio) {
            listRadio.checked = true;
        }

        // Update data
        document.getElementById('crash-recovery-logs').checked = this.currentConfig.data.enable_crash_recovery_logs;
    }
}

// Make it globally available
window.CVCConfig = CVCConfig;

// Auto-instantiate for dashboard integration
window.cvcConfig = new CVCConfig();