// Auditory Stroop Task Configuration Handler
class AuditoryStroopConfig {
    constructor() {
        this.defaultConfig = {
            task: 'auditory-stroop',
            timestamp: null,
            parameters: {
                trials: {
                    practice: 8,
                    main: 20  // Changed from 64 to 20
                },
                timing: {
                    iti: 1200,
                    pre_stimulus_delay: 750,
                    response_timeout: 2500,
                    error_display_duration: 1000
                },
                audio: {
                    volume: 0.8
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
                <h2 class="modal-title">Auditory Stroop Task Configuration</h2>
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
                                    <input type="number" id="practice-trials" name="practice_trials" min="0" max="20" value="8" readonly>
                                    <button type="button" data-action="increase" data-target="practice-trials">+</button>
                                </div>
                                <small class="help-text">Range: 0-20 trials</small>
                            </div>
                            
                            <div class="config-group">
                                <label for="main-trials">Number of Main Trials</label>
                                <div class="number-stepper">
                                    <button type="button" data-action="decrease" data-target="main-trials">−</button>
                                    <input type="number" id="main-trials" name="main_trials" min="0" max="300" value="20" readonly>
                                    <button type="button" data-action="increase" data-target="main-trials">+</button>
                                </div>
                                <small class="help-text">Range: 0-300 trials</small>
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
                                <label for="iti-slider">Inter-trial Interval (ITI Duration)</label>
                                <div class="slider-container">
                                    <input type="range" id="iti-slider" class="config-slider" 
                                           min="500" max="5000" step="50" value="1200">
                                    <div class="slider-value">
                                        <span id="iti-value">1200</span> ms
                                    </div>
                                </div>
                                <small class="help-text">Time between trials (500-5000 ms)</small>
                            </div>
                            
                            <div class="config-group">
                                <label for="pre-stimulus-slider">Pre-stimulus Delay (Fixation Duration)</label>
                                <div class="slider-container">
                                    <input type="range" id="pre-stimulus-slider" class="config-slider" 
                                           min="250" max="2000" step="25" value="750">
                                    <div class="slider-value">
                                        <span id="pre-stimulus-value">750</span> ms
                                    </div>
                                </div>
                                <small class="help-text">Fixation cross duration (250-2000 ms)</small>
                            </div>
                        </div>

                        <div class="config-row">
                            <div class="config-group">
                                <label for="response-timeout-slider">Response Timeout (Max Response Window)</label>
                                <div class="slider-container">
                                    <input type="range" id="response-timeout-slider" class="config-slider" 
                                           min="500" max="5000" step="50" value="2500">
                                    <div class="slider-value">
                                        <span id="response-timeout-value">2500</span> ms
                                    </div>
                                </div>
                                <small class="help-text">Maximum time to respond (500-5000 ms)</small>
                            </div>
                            
                            <div class="config-group">
                                <label for="error-display-slider">Error/No-response Display Duration</label>
                                <div class="slider-container">
                                    <input type="range" id="error-display-slider" class="config-slider" 
                                           min="500" max="3000" step="50" value="1000">
                                    <div class="slider-value">
                                        <span id="error-display-value">1000</span> ms
                                    </div>
                                </div>
                                <small class="help-text">Error message duration (500-3000 ms)</small>
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
                                <label for="volume-slider">
                                    <svg class="config-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.82L4.09 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.09l4.293-3.82a1 1 0 011.617-.82z"/>
                                        <path d="M12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"/>
                                    </svg>
                                    Audio Playback Volume
                                </label>
                                <div class="slider-container">
                                    <input type="range" id="volume-slider" class="config-slider" 
                                           min="0" max="1" step="0.01" value="0.8">
                                    <div class="slider-value">
                                        <span id="volume-value">80</span>%
                                    </div>
                                </div>
                                <small class="help-text">Adjust audio volume (0-100%)</small>
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
        
        // Format volume as percentage
        if (slider.id === 'volume-slider') {
            displayValue = Math.round(parseFloat(slider.value) * 100);
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
            
            const configPath = path.join(baseDir, 'cfg_auditory_stroop_task.json');
            const configData = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configData);
            
            this.applyConfigurationToForm(config);
            
        } catch (error) {
            console.log('No existing Auditory Stroop configuration found, using defaults');
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
            this.setInputValue('iti-slider', params.timing.iti);
            this.setInputValue('pre-stimulus-slider', params.timing.pre_stimulus_delay);
            this.setInputValue('response-timeout-slider', params.timing.response_timeout);
            this.setInputValue('error-display-slider', params.timing.error_display_duration);
        }
        
        // Apply audio parameters
        if (params.audio) {
            this.setInputValue('volume-slider', params.audio.volume);
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

    async loadExistingConfiguration() {
        try {
            const os = window.require('os');
            const path = window.require('path');
            const fs = window.require('fs').promises;

            let baseDir;
            if (process.platform === 'win32') {
                baseDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Oats', 'task-configurations');
            } else {
                baseDir = path.join(os.homedir(), 'Documents', 'Oats', 'task-configurations');
            }

            const configPath = path.join(baseDir, 'cfg_auditory_stroop_task.json');
            const configData = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configData);

            this.applyConfigurationToForm(config);
        } catch (error) {
            console.log('No existing Auditory Stroop configuration found, using defaults');
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
                window.dashboard.showToast('Auditory Stroop configuration saved successfully', 'success');
            }
            
        } catch (error) {
            console.error('Error saving Auditory Stroop configuration:', error);
            if (window.dashboard) {
                window.dashboard.showToast('Failed to save configuration', 'error');
            }
            
            saveBtn.classList.remove('loading');
            saveBtn.disabled = false;
        }
    }

    collectConfigurationData() {
        return {
            task: 'auditory-stroop',
            timestamp: new Date().toISOString(),
            parameters: {
                trials: {
                    practice: parseInt(document.getElementById('practice-trials')?.value) || 8,
                    main: parseInt(document.getElementById('main-trials')?.value) || 64
                },
                timing: {
                    iti: parseInt(document.getElementById('iti-slider')?.value) || 1200,
                    pre_stimulus_delay: parseInt(document.getElementById('pre-stimulus-slider')?.value) || 750,
                    response_timeout: parseInt(document.getElementById('response-timeout-slider')?.value) || 2500,
                    error_display_duration: parseInt(document.getElementById('error-display-slider')?.value) || 1000
                },
                audio: {
                    volume: parseFloat(document.getElementById('volume-slider')?.value) || 0.8
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
        
        const configPath = path.join(baseDir, 'cfg_auditory_stroop_task.json');
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
        
        console.log(`Auditory Stroop configuration saved to: ${configPath}`);
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
window.AuditoryStroopConfig = AuditoryStroopConfig;