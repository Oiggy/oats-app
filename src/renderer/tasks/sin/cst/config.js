class CSTConfig {
    constructor() {
        this.configName = 'cfg_cst_task.json';
        this.defaultConfig = {
            task: 'cst',
            parameters: {
                audio: {
                    volume: 1.0
                },
                data: {
                    enable_crash_recovery_logs: true
                }
            }
        };
        this.currentConfig = { ...this.defaultConfig };
    }

    async loadConfig() {
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
        
        const configPath = path.join(baseDir, this.configName);
        
        try {
            const data = await fs.readFile(configPath, 'utf8');
            this.currentConfig = JSON.parse(data);
            console.log('CST config loaded:', this.currentConfig);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
            console.log('Config file not found, will create new one');
        }
    }

    async saveConfig() {
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
        const configPath = path.join(baseDir, this.configName);
        
        await fs.writeFile(configPath, JSON.stringify(this.currentConfig, null, 2));
        console.log('CST config saved to:', configPath);
    }

    generateConfigHTML() {
        return `
            <div class="modal-header">
                <h2 class="modal-title">CST Task Configuration</h2>
                <button type="button" class="modal-close" aria-label="Close configuration">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L10 9.293l4.646-4.647a.5.5 0 0 1 .708.708L10.707 10l4.647 4.646a.5.5 0 0 1-.708.708L10 10.707l-4.646 4.647a.5.5 0 0 1-.708-.708L9.293 10 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                    </svg>
                </button>
            </div>

            <div class="modal-body">
                <!-- Tabs -->
                <div class="config-tabs">
                    <button class="config-tab active" data-tab="audio">Audio Settings</button>
                    <button class="config-tab" data-tab="data">Data Collection</button>
                </div>

                <!-- Audio Tab -->
                <div class="config-tab-content active" id="audio-tab">
                    <div class="config-card">
                        <h3>Audio Playback</h3>
                        
                        <div class="config-group">
                            <label for="cst-audio-volume">Volume</label>
                            <div class="slider-control">
                                <div class="slider-value">
                                    <span>Volume Level</span>
                                    <span class="slider-value-display" id="cst-volume-value">${Math.round(this.currentConfig.parameters.audio.volume * 100)}%</span>
                                </div>
                                <input type="range" id="cst-audio-volume" name="volume" 
                                       min="0" max="3" step="0.1" value="${this.currentConfig.parameters.audio.volume}" class="config-slider">
                            </div>
                            <div class="help-text">Adjust the playback volume for audio stimuli (0-300%). Above 100% boosts quiet stimuli louder than their original recording level.</div>
                        </div>
                    </div>
                </div>

                <!-- Data Tab -->
                <div class="config-tab-content" id="data-tab">
                    <div class="config-card">
                        <h3>Data Collection</h3>
                        
                        <div class="config-group">
                            <label for="cst-crash-recovery">Enable Crash Recovery Logs</label>
                            <div class="toggle-switch">
                                <input type="checkbox" id="cst-crash-recovery" name="crash_recovery" 
                                       ${this.currentConfig.parameters.data.enable_crash_recovery_logs ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </div>
                            <div class="help-text">Save progress data to allow recovery if the task is interrupted</div>
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
        
        const closeBtn = modalContent.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeConfigModal();
            });
        }

        const cancelBtn = modalContent.querySelector('#config-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeConfigModal();
            });
        }

        const saveBtn = modalContent.querySelector('#config-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                await this.saveConfiguration();
            });
        }

        const tabs = modalContent.querySelectorAll('.config-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.getAttribute('data-tab'));
            });
        });

        const volumeSlider = document.getElementById('cst-audio-volume');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('cst-volume-value').textContent = Math.round(value * 100) + '%';
                this.currentConfig.parameters.audio.volume = value;
            });
        }

        const crashRecoveryCheckbox = document.getElementById('cst-crash-recovery');
        const crashRecoveryToggle = crashRecoveryCheckbox?.parentElement.querySelector('.toggle-slider');
        
        if (crashRecoveryCheckbox && crashRecoveryToggle) {
            crashRecoveryToggle.addEventListener('click', () => {
                crashRecoveryCheckbox.checked = !crashRecoveryCheckbox.checked;
                this.currentConfig.parameters.data.enable_crash_recovery_logs = crashRecoveryCheckbox.checked;
            });
            
            crashRecoveryCheckbox.addEventListener('change', () => {
                this.currentConfig.parameters.data.enable_crash_recovery_logs = crashRecoveryCheckbox.checked;
            });
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.config-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.config-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    async saveConfiguration() {
        const saveBtn = document.getElementById('config-save-btn');
        saveBtn.classList.add('loading');
        saveBtn.disabled = true;

        try {
            await this.saveConfig();
            
            if (window.dashboard) {
                window.dashboard.showToast('Configuration saved successfully', 'success');
                window.dashboard.closeConfigModal();
                window.dashboard.updateStepState(3, 'completed');
                
                const runTaskBtn = document.getElementById('run-task-btn');
                if (runTaskBtn) {
                    runTaskBtn.disabled = false;
                }
            }
        } catch (error) {
            console.error('Error saving config:', error);
            alert('Failed to save configuration. Please try again.');
            
            saveBtn.classList.remove('loading');
            saveBtn.disabled = false;
        }
    }

    async loadExistingConfiguration() {
        try {
            await this.loadConfig();
        } catch (error) {
            console.log('No existing CST configuration found, using defaults');
        }
    }

    updateUIFromConfig() {
        const volumeSlider = document.getElementById('cst-audio-volume');
        if (volumeSlider) {
            volumeSlider.value = this.currentConfig.parameters.audio.volume;
            document.getElementById('cst-volume-value').textContent = 
                Math.round(this.currentConfig.parameters.audio.volume * 100) + '%';
        }

        const crashRecovery = document.getElementById('cst-crash-recovery');
        if (crashRecovery) {
            crashRecovery.checked = this.currentConfig.parameters.data.enable_crash_recovery_logs;
        }
    }

    closeConfigModal() {
        if (window.dashboard) {
            window.dashboard.closeConfigModal();
        }
    }
}

window.CSTConfig = CSTConfig;
window.cstConfig = new CSTConfig();