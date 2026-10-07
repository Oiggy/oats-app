// Auditory Stroop Task Configuration Handler
class AuditoryStroopConfig {
    constructor() {
        this.defaultConfig = {
            task: 'auditory-stroop',
            version: 2,
            timestamp: null,
            parameters: {
                trials: {
                    practice: 12,     // not specified in the paper
                    repetitions: 6    // 12 word-voice pairings x 6 = 72 trials (paper)
                },
                timing: {
                    warning_tone_frequency: 500,
                    warning_tone_duration: 100,
                    warning_to_stimulus_delay: 500,
                    iti: 2000,
                    response_timeout: 3000,
                    error_display_duration: 1500
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
                        <small class="help-text">
                            The words <em>mother</em>, <em>father</em> and <em>person</em> by 2 male and 2 female talkers
                            give 12 word–voice pairings (congruent, neutral, incongruent). Paper: each pairing presented
                            6 times = 72 trials (24 per condition) in one block.
                        </small>
                        
                        <div class="config-row">
                            <div class="config-group">
                                <label for="practice-trials">Number of Practice Trials</label>
                                <div class="number-stepper">
                                    <button type="button" data-action="decrease" data-target="practice-trials">−</button>
                                    <input type="number" id="practice-trials" name="practice_trials" min="0" max="24" value="12" readonly>
                                    <button type="button" data-action="increase" data-target="practice-trials">+</button>
                                </div>
                                <small class="help-text">With feedback; not specified in the paper (0-24)</small>
                            </div>
                            
                            <div class="config-group">
                                <label for="repetitions">Presentations per Word–Voice Pairing</label>
                                <div class="number-stepper">
                                    <button type="button" data-action="decrease" data-target="repetitions">−</button>
                                    <input type="number" id="repetitions" name="repetitions" min="1" max="12" value="6" readonly>
                                    <button type="button" data-action="increase" data-target="repetitions">+</button>
                                </div>
                                <small class="help-text">12 pairings &times; this value = main trials (paper: 6 → 72)</small>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Timing Tab -->
                <div class="config-tab-content" id="timing-tab">
                    <div class="config-card">
                        <h3>Timing Parameters</h3>
                        <small class="help-text">Each trial: 500-Hz warning tone, then the word. RTs are measured from word onset.</small>
                        
                        <div class="config-row">
                            <div class="config-group">
                                <label for="warning-delay-slider">Warning Tone → Word Delay</label>
                                <div class="slider-container">
                                    <input type="range" id="warning-delay-slider" class="config-slider" 
                                           min="100" max="2000" step="50" value="500">
                                    <div class="slider-value">
                                        <span id="warning-delay-value">500</span> ms
                                    </div>
                                </div>
                                <small class="help-text">Paper: 500 ms</small>
                            </div>
                            
                            <div class="config-group">
                                <label for="response-timeout-slider">Response Deadline</label>
                                <div class="slider-container">
                                    <input type="range" id="response-timeout-slider" class="config-slider" 
                                           min="1000" max="10000" step="100" value="3000">
                                    <div class="slider-value">
                                        <span id="response-timeout-value">3000</span> ms
                                    </div>
                                </div>
                                <small class="help-text">From word onset; slower responses count as incorrect (paper: 3 s)</small>
                            </div>
                        </div>

                        <div class="config-row">
                            <div class="config-group">
                                <label for="iti-slider">Delay after Response</label>
                                <div class="slider-container">
                                    <input type="range" id="iti-slider" class="config-slider" 
                                           min="500" max="5000" step="50" value="2000">
                                    <div class="slider-value">
                                        <span id="iti-value">2000</span> ms
                                    </div>
                                </div>
                                <small class="help-text">Response → next warning tone (paper: 2 s)</small>
                            </div>
                            
                            <div class="config-group">
                                <label for="error-display-slider">Practice Feedback Duration</label>
                                <div class="slider-container">
                                    <input type="range" id="error-display-slider" class="config-slider" 
                                           min="500" max="3000" step="50" value="1500">
                                    <div class="slider-value">
                                        <span id="error-display-value">1500</span> ms
                                    </div>
                                </div>
                                <small class="help-text">Feedback is shown on practice trials only</small>
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
        // Configurations from the old placeholder version don't follow the
        // paper's design; fall back to the paper defaults.
        if (!config || config.version !== 2) config = this.defaultConfig;
        const params = config.parameters;
        
        // Apply trial parameters
        if (params.trials) {
            this.setInputValue('practice-trials', params.trials.practice);
            this.setInputValue('repetitions', params.trials.repetitions);
        }
        
        // Apply timing parameters
        if (params.timing) {
            this.setInputValue('iti-slider', params.timing.iti);
            this.setInputValue('warning-delay-slider', params.timing.warning_to_stimulus_delay);
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
        const intValue = (id, fallback) => {
            const v = parseInt(document.getElementById(id)?.value);
            return isNaN(v) ? fallback : v;
        };
        const crashRecovery = document.getElementById('crash-recovery');
        return {
            task: 'auditory-stroop',
            version: 2,
            timestamp: new Date().toISOString(),
            parameters: {
                trials: {
                    practice: intValue('practice-trials', 12),
                    repetitions: intValue('repetitions', 6)
                },
                timing: {
                    warning_tone_frequency: 500,
                    warning_tone_duration: 100,
                    warning_to_stimulus_delay: intValue('warning-delay-slider', 500),
                    iti: intValue('iti-slider', 2000),
                    response_timeout: intValue('response-timeout-slider', 3000),
                    error_display_duration: intValue('error-display-slider', 1500)
                },
                audio: {
                    volume: parseFloat(document.getElementById('volume-slider')?.value) || 0.8
                },
                data: {
                    crash_recovery: crashRecovery ? crashRecovery.checked : true
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
                // Unless something was opened again in the meantime
                if (modalOverlay.classList.contains('open')) return;
                const modalContent = modalOverlay.querySelector('.modal-content');
                modalContent.innerHTML = '';
            }, 300);
        }
    }
}

// Export for use
window.AuditoryStroopConfig = AuditoryStroopConfig;