// Stroop Color-Word Task Configuration Handler
class StroopColorWordConfig {
    constructor() {
        this.defaultConfig = {
            task: 'stroop-color-word',
            timestamp: null,
            parameters: {
                trials: {
                    practice: 1,
                    main: 2
                },
                timing: {
                    pre_stimulus_delay: 200,
                    recording_duration: 3000
                },
                audio: {
                    recording_level: 50
                },
                data: {
                    crash_recovery: true
                }
            }
        };
    }

    generateConfigHTML() {
        return `
            <div class="modal-header">
                <h2 class="modal-title">Stroop Color-Word Task Configuration</h2>
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
                    <button class="config-tab" data-tab="audio">Audio</button>
                    <button class="config-tab" data-tab="data">Data</button>
                </div>

                <!-- Trials Tab -->
                <div class="config-tab-content active" id="trials-tab">
                    <div class="config-card">
                        <h3>Trial Parameters</h3>
                        
                        <div class="config-row">
                            <div class="config-group">
                                <label for="practice-trials">Number of Practice Trials</label>
                                <div class="number-stepper">
                                    <button type="button" data-action="decrease" data-target="practice-trials">−</button>
                                    <input type="number" id="practice-trials" name="practice_trials" min="0" max="50" value="6" readonly>
                                    <button type="button" data-action="increase" data-target="practice-trials">+</button>
                                </div>
                                <small class="help-text">Range: 1-50 trials</small>
                            </div>
                            
                            <div class="config-group">
                                <label for="main-trials">Number of Main Trials</label>
                                <div class="number-stepper">
                                    <button type="button" data-action="decrease" data-target="main-trials">−</button>
                                    <input type="number" id="main-trials" name="main_trials" min="0" max="500" value="10" readonly>
                                    <button type="button" data-action="increase" data-target="main-trials">+</button>
                                </div>
                                <small class="help-text">Range: 2-500 trials</small>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Timing Tab -->
                <div class="config-tab-content" id="timing-tab">
                    <div class="config-card">
                        <h3>Timing Parameters</h3>
                        
                        <div class="config-row">
                            <div class="config-group">
                                <label for="pre-stimulus-slider">Pre-stimulus Delay (Fixation Duration)</label>
                                <div class="slider-container">
                                    <input type="range" id="pre-stimulus-slider" class="config-slider" 
                                           min="0" max="2000" step="50" value="200">
                                    <div class="slider-value">
                                        <span id="pre-stimulus-value">200</span> ms
                                    </div>
                                </div>
                                <small class="help-text">Fixation cross duration (0-2000 ms)</small>
                            </div>
                            
                            <div class="config-group">
                                <label for="recording-duration-slider">Recording Duration (Response Window)</label>
                                <div class="slider-container">
                                    <input type="range" id="recording-duration-slider" class="config-slider" 
                                           min="0" max="30000" step="100" value="3000">
                                    <div class="slider-value">
                                        <span id="recording-duration-value">3000</span> ms
                                    </div>
                                </div>
                                <small class="help-text">Maximum recording time (0-30,000 ms)</small>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Audio Tab -->
                <div class="config-tab-content" id="audio-tab">
                    <div class="config-card">
                        <h3>Audio Settings</h3>
                        
                        <div class="config-row">
                            <div class="config-group">
                                <label for="recording-level-slider">
                                    <svg class="config-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10 1C8.34 1 7 2.34 7 4v6c0 1.66 1.34 3 3 3s3-1.34 3-3V4c0-1.66-1.34-3-3-3z"/>
                                        <path d="M16 10c0 3.31-2.69 6-6 6s-6-2.69-6-6H2c0 4.42 3.58 8 8 8v2h4v-2c4.42 0 8-3.58 8-8h-2z"/>
                                    </svg>
                                    Audio Recording Level
                                </label>
                                <div class="slider-container">
                                    <input type="range" id="recording-level-slider" class="config-slider" 
                                           min="0" max="100" step="1" value="50">
                                    <div class="slider-value">
                                        <span id="recording-level-value">50</span>%
                                    </div>
                                </div>
                                <small class="help-text">Microphone input level (0-100%)</small>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Data Tab -->
                <div class="config-tab-content" id="data-tab">
                    <div class="config-card">
                        <h3>Data & Recovery Settings</h3>
                        
                        <div class="config-row">
                            <div class="config-group">
                                <div class="toggle-group">
                                    <label for="crash-recovery" class="toggle-label">
                                        <span class="toggle-text">
                                            <strong>Enable Crash Recovery Logs</strong>
                                            <small>Automatically save progress to prevent data loss</small>
                                        </span>
                                        <div class="toggle-switch">
                                            <input type="checkbox" id="crash-recovery" checked>
                                            <span class="toggle-slider"></span>
                                        </div>
                                    </label>
                                </div>
                            </div>
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
        // Tab switching
        document.querySelectorAll('.config-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Number steppers
        document.querySelectorAll('.number-stepper button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleStepperClick(e);
            });
        });

        // Sliders
        document.querySelectorAll('.config-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                this.updateSliderValue(e.target);
            });
        });

        // Cancel button
        document.getElementById('config-cancel-btn').addEventListener('click', () => {
            this.cancelConfiguration();
        });

        // Save button
        document.getElementById('config-save-btn').addEventListener('click', (e) => {
            this.saveConfiguration(e.target);
        });

        // Modal close button
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.cancelConfiguration();
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.config-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.config-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    handleStepperClick(e) {
        const action = e.target.dataset.action;
        const targetId = e.target.dataset.target;
        const input = document.getElementById(targetId);
        
        if (!input) return;

        const min = parseInt(input.min);
        const max = parseInt(input.max);
        let currentValue = parseInt(input.value);

        if (action === 'increase' && currentValue < max) {
            input.value = currentValue + 1;
        } else if (action === 'decrease' && currentValue > min) {
            input.value = currentValue - 1;
        }
    }

    updateSliderValue(slider) {
        const valueSpan = document.getElementById(slider.id.replace('-slider', '-value'));
        if (!valueSpan) return;

        let displayValue = slider.value;
        
        // Format recording level as percentage
        if (slider.id === 'recording-level-slider') {
            displayValue = Math.round(parseFloat(slider.value));
        }

        valueSpan.textContent = displayValue;
    }

    async loadConfiguration() {
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
            
            const configPath = path.join(baseDir, 'cfg_stroop_color_word_task.json');
            const configData = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configData);
            
            this.applyConfigurationToForm(config);
            
        } catch (error) {
            console.log('No existing Stroop Color-Word configuration found, using defaults');
            this.applyConfigurationToForm(this.defaultConfig);
        }
    }

    applyConfigurationToForm(config) {
        const params = config.parameters;
        
        // Apply trial parameters
        if (params.trials) {
            this.setInputValue('practice-trials', params.trials.practice);
            this.setInputValue('main-trials', params.trials.main);
        }
        
        // Apply timing parameters
        if (params.timing) {
            this.setInputValue('pre-stimulus-slider', params.timing.pre_stimulus_delay);
            this.setInputValue('recording-duration-slider', params.timing.recording_duration);
        }
        
        // Apply audio parameters
        if (params.audio) {
            this.setInputValue('recording-level-slider', params.audio.recording_level);
        }
        
        // Apply data parameters
        if (params.data && document.getElementById('crash-recovery')) {
            document.getElementById('crash-recovery').checked = params.data.crash_recovery;
        }
        
        // Update all slider displays
        document.querySelectorAll('.config-slider').forEach(slider => {
            this.updateSliderValue(slider);
        });
    }

    setInputValue(id, value) {
        const input = document.getElementById(id);
        if (input && value !== undefined && value !== null) {
            input.value = value;
        }
    }

    async saveConfiguration(saveBtn) {
        saveBtn.classList.add('loading');
        saveBtn.disabled = true;

        try {
            const config = this.collectConfigurationData();
            await this.saveConfigurationToFile(config);
            
            // Close modal
            this.closeConfigModal();
            
            // Update dashboard stepper to show step 3 as completed
            if (window.dashboard) {
                window.dashboard.updateStepState(3, 'completed');
            }
            
            // Enable run task button
            const runTaskBtn = document.getElementById('run-task-btn');
            if (runTaskBtn) {
                runTaskBtn.disabled = false;
                console.log('Run task button enabled after configuration save');
            }
            
            // Update dashboard state
            if (window.dashboard) {
                window.dashboard.currentState = 'ready_to_run';
                window.dashboard.showToast('Stroop Color-Word configuration saved successfully', 'success');
            }
            
        } catch (error) {
            console.error('Error saving Stroop Color-Word configuration:', error);
            if (window.dashboard) {
                window.dashboard.showToast('Failed to save configuration', 'error');
            }
            
            saveBtn.classList.remove('loading');
            saveBtn.disabled = false;
        }
    }

    collectConfigurationData() {
        return {
            task: 'stroop-color-word',
            timestamp: new Date().toISOString(),
            parameters: {
                trials: {
                    practice: parseInt(document.getElementById('practice-trials')?.value) || 6,
                    main: parseInt(document.getElementById('main-trials')?.value) || 10
                },
                timing: {
                    pre_stimulus_delay: parseInt(document.getElementById('pre-stimulus-slider')?.value) || 200,
                    recording_duration: parseInt(document.getElementById('recording-duration-slider')?.value) || 3000
                },
                audio: {
                    recording_level: parseInt(document.getElementById('recording-level-slider')?.value) || 50
                },
                data: {
                    crash_recovery: document.getElementById('crash-recovery')?.checked || true
                }
            }
        };
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
        
        const configPath = path.join(baseDir, 'cfg_stroop_color_word_task.json');
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
        
        console.log(`Stroop Color-Word configuration saved to: ${configPath}`);
    }

    cancelConfiguration() {
        this.closeConfigModal();
    }

    closeConfigModal() {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.remove('open', 'config-modal');
            modalOverlay.setAttribute('aria-hidden', 'true');
            
            setTimeout(() => {
                const modalContent = modalOverlay.querySelector('.modal-content');
                modalContent.innerHTML = '';
            }, 300);
        }
    }
}

// Export for use
window.StroopColorWordConfig = StroopColorWordConfig;