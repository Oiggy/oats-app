// Dashboard - All-in-one version for Electron compatibility
// dashboard.js
class Dashboard {
    constructor() {
        this.currentState = 'idle';
        this.currentSubject = null;
        this.selectedTask = null;
        this.toasts = new Set();
        this.developerMode = false;
        this.developerName = null;
        this.devModeStartTime = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.initializeDashboard();
        this.setupDeveloperMode();
        console.log('OATS Dashboard initialized');
    }

    setupDeveloperMode() {
        // Add developer mode indicator to the page
        const devModeIndicator = document.createElement('div');
        devModeIndicator.id = 'dev-mode-indicator';
        devModeIndicator.innerHTML = `
            <div class="dev-mode-badge" id="dev-mode-badge">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M5.5 2a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-1 0v-11a.5.5 0 0 1 .5-.5zm5 0a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-1 0v-11a.5.5 0 0 1 .5-.5z"/>
                    <path d="M0 2.5A.5.5 0 0 1 .5 2h15a.5.5 0 0 1 0 1h-15a.5.5 0 0 1-.5-.5z"/>
                </svg>
                <span id="dev-mode-text">DEV</span>
            </div>
            <style>
                #dev-mode-indicator {
                    position: fixed;
                    top: 16px;
                    right: 16px;
                    z-index: 9999;
                }
                
                .dev-mode-badge {
                    background: #6e6e73;
                    color: white;
                    padding: 6px 12px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                }
                
                .dev-mode-badge:hover {
                    background: #86868b;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                }
                
                .dev-mode-badge.active {
                    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
                }
                
                .dev-mode-badge.active:hover {
                    background: linear-gradient(135deg, #ff7b7b 0%, #fe6a7f 100%);
                }
            </style>
        `;
        document.body.appendChild(devModeIndicator);

        // Click handler for the badge
        const badge = document.getElementById('dev-mode-badge');
        badge.addEventListener('click', () => {
            if (this.developerMode) {
                this.exitDeveloperMode();
            } else {
                this.showDeveloperModeLogin();
            }
        });
    }

    showDeveloperModeLogin() {
        const modalOverlay = document.getElementById('modal-overlay');
        const modalContent = modalOverlay.querySelector('.modal-content');
        
        modalContent.innerHTML = `
            <form id="dev-login-form">
                <div class="modal-header dev-modal-header">
                    <button type="button" class="modal-close dev-modal-close" id="dev-login-close" aria-label="Close">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L10 9.293l4.646-4.647a.5.5 0 0 1 .708.708L10.707 10l4.647 4.646a.5.5 0 0 1-.708.708L10 10.707l-4.646 4.647a.5.5 0 0 1-.708-.708L9.293 10 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                        </svg>
                    </button>
                    <h2 class="modal-title dev-modal-title">Developer Mode Access</h2>
                </div>

                <div class="modal-body">
                    <div class="dev-login-content">
                        <div class="dev-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                            </svg>
                        </div>
                        
                        <p class="dev-description">
                            Enter your credentials to enable developer mode. 
                            This will allow quick testing by auto-filling the biodata form.
                        </p>

                        <div class="dev-form-group">
                            <label for="dev-name">Developer Name</label>
                            <input type="text" id="dev-name" name="dev_name" 
                                placeholder="Enter your name" required autofocus>
                        </div>

                        <div class="dev-form-group">
                            <label for="dev-password">Password</label>
                            <input type="password" id="dev-password" name="dev_password" 
                                placeholder="Enter password" required>
                        </div>

                        <div class="error-message" id="dev-login-error"></div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button type="button" class="button-secondary" id="dev-login-cancel">Cancel</button>
                    <button type="submit" class="button-primary" id="dev-login-submit">
                        <span class="button-text">Login</span>
                        <span class="button-loading" aria-hidden="true">Verifying...</span>
                    </button>
                </div>
            </form>

            <style>
                /* Custom header for developer mode modal */
                .dev-modal-header {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px 24px;
                    border-bottom: 1px solid #e5e5e7;
                }

                .dev-modal-close {
                    position: absolute;
                    left: 16px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    padding: 8px;
                    cursor: pointer;
                    border-radius: 6px;
                    color: #6e6e73;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .dev-modal-close:hover {
                    background-color: #f5f5f7;
                    color: #1d1d1f;
                }

                .dev-modal-title {
                    font-size: 20px;
                    font-weight: 600;
                    color: #1d1d1f;
                    margin: 0;
                    text-align: center;
                }

                .dev-login-content {
                    text-align: center;
                    padding: 0 24px 24px 24px;
                }

                .dev-icon {
                    width: 80px;
                    height: 80px;
                    margin: 0 auto 24px;
                    background: linear-gradient(135deg, #007aff 0%, #5856d6 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                }

                .dev-description {
                    font-size: 14px;
                    color: #6e6e73;
                    line-height: 1.5;
                    margin-bottom: 32px;
                }

                .dev-form-group {
                    margin-bottom: 20px;
                    text-align: left;
                }

                .dev-form-group label {
                    display: block;
                    font-size: 14px;
                    font-weight: 500;
                    color: #1d1d1f;
                    margin-bottom: 8px;
                }

                .dev-form-group input {
                    width: 100%;
                    padding: 12px 16px;
                    border: 1.5px solid #d2d2d7;
                    border-radius: 8px;
                    font-size: 15px;
                    transition: all 0.2s ease;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }

                .dev-form-group input:focus {
                    outline: none;
                    border-color: #007aff;
                    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
                }

                .dev-form-group input::placeholder {
                    color: #86868b;
                }

                .error-message {
                    color: #ff3b30;
                    font-size: 13px;
                    margin-top: 16px;
                    padding: 12px;
                    background: #fff5f5;
                    border-radius: 8px;
                    border: 1px solid #ffdddd;
                    min-height: 20px;
                    text-align: left;
                    display: none;
                }

                .error-message:not(:empty) {
                    display: block;
                }

                #dev-login-form .modal-footer {
                    padding: 20px 24px;
                    border-top: 1px solid #e5e5e7;
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    background: #fafafa;
                }
            </style>
        `;

        modalOverlay.classList.add('open');
        modalOverlay.setAttribute('aria-hidden', 'false');

        // Event listeners
        document.getElementById('dev-login-close').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('dev-login-cancel').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('dev-login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleDeveloperModeLogin();
        });

        // Focus on name input
        setTimeout(() => {
            document.getElementById('dev-name').focus();
        }, 100);
    }

    async handleDeveloperModeLogin() {
        const nameInput = document.getElementById('dev-name');
        const passwordInput = document.getElementById('dev-password');
        const errorEl = document.getElementById('dev-login-error');
        const submitBtn = document.getElementById('dev-login-submit');

        const name = nameInput.value.trim();
        const password = passwordInput.value;

        // Clear previous errors
        errorEl.textContent = '';

        if (!name || !password) {
            errorEl.textContent = '⚠️ Please enter both name and password.';
            return;
        }

        // Show loading state
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        // Add small delay for better UX
        await new Promise(resolve => setTimeout(resolve, 300));

        try {
            // Load credentials
            const credentials = await this.loadDevCredentials();
            
            // Verify password
            if (password === credentials.DEV_PASSWORD) {
                // Successful login
                this.developerName = name;
                this.developerMode = true;
                this.devModeStartTime = new Date();
                
                // Log entry
                await this.logDeveloperModeEvent('ENTER', name);
                
                // Update UI
                this.updateDeveloperModeBadge(true, name);
                this.closeModal();
                this.showToast(`Developer Mode enabled for ${name}`, 'success');
                
                console.log(`🔧 Developer Mode ENABLED for ${name}`);
                
                // Auto-fill biodata if in idle state
                if (this.currentState === 'idle') {
                    setTimeout(() => {
                        this.autoFillBiodata();
                    }, 500);
                }
            } else {
                // Failed login
                errorEl.textContent = '❌ Invalid password. Please try again.';
                passwordInput.value = '';
                passwordInput.focus();
                
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
            }
        } catch (error) {
            console.error('Developer mode login error:', error);
            
            // Provide helpful error message
            let errorMessage = '❌ Configuration error. ';
            
            if (error.message.includes('not found')) {
                errorMessage += 'Please run: npm run setup-dev';
            } else if (error.message.includes('DEV_PASSWORD')) {
                errorMessage += 'Invalid credentials file format.';
            } else {
                errorMessage += 'Please check dev-credentials.js file.';
            }
            
            errorEl.textContent = errorMessage;
            
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    }

    async loadDevCredentials() {
        try {
            const path = window.require('path');
            const fs = window.require('fs');
            const { app } = window.require('@electron/remote') || window.require('electron').remote;
            
            // Get the correct path to dev-credentials.js
            const appPath = app.getAppPath();
            const credentialsPath = path.join(appPath, 'src', 'config', 'dev-credentials.js');
            
            console.log('Loading credentials from:', credentialsPath);
            
            // Check if file exists
            if (!fs.existsSync(credentialsPath)) {
                throw new Error('dev-credentials.js not found. Please run: npm run setup-dev');
            }
            
            // Load the credentials
            delete require.cache[require.resolve(credentialsPath)]; // Clear cache
            const credentials = window.require(credentialsPath);
            
            if (!credentials.DEV_PASSWORD) {
                throw new Error('DEV_PASSWORD not found in credentials file');
            }
            
            return credentials;
        } catch (error) {
            console.error('Failed to load dev-credentials.js:', error);
            throw error;
        }
    }

    async exitDeveloperMode() {
        if (!this.developerMode) return;

        const confirmExit = confirm(`Exit Developer Mode?\n\nLogged in as: ${this.developerName}`);
        
        if (confirmExit) {
            // Log exit
            await this.logDeveloperModeEvent('EXIT', this.developerName);
            
            // Reset developer mode
            this.developerMode = false;
            const duration = this.calculateSessionDuration();
            const devName = this.developerName;
            this.developerName = null;
            this.devModeStartTime = null;
            
            // Update UI
            this.updateDeveloperModeBadge(false);
            this.showToast(`Developer Mode disabled (Session: ${duration})`, 'info');
            
            console.log(`🔧 Developer Mode session ended for ${devName} (Duration: ${duration})`);
        }
    }

    updateDeveloperModeBadge(active, name = null) {
        const badge = document.getElementById('dev-mode-badge');
        const text = document.getElementById('dev-mode-text');
        
        if (active) {
            badge.classList.add('active');
            text.textContent = name ? name.substring(0, 10) : 'DEV MODE';
        } else {
            badge.classList.remove('active');
            text.textContent = 'DEV';
        }
    }

    calculateSessionDuration() {
        if (!this.devModeStartTime) return '0m';
        
        const now = new Date();
        const durationMs = now - this.devModeStartTime;
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        
        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        return `${seconds}s`;
    }

    async logDeveloperModeEvent(action, name) {
        try {
            const os = window.require('os');
            const path = window.require('path');
            const fs = window.require('fs').promises;
            
            // Determine log directory
            let logDir;
            if (process.platform === 'win32') {
                logDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Oats', 'dev-mode-logs');
            } else if (process.platform === 'darwin') {
                logDir = path.join(os.homedir(), 'Documents', 'Oats', 'dev-mode-logs');
            } else {
                logDir = path.join(os.homedir(), 'Documents', 'Oats', 'dev-mode-logs');
            }
            
            // Create directory if it doesn't exist
            await fs.mkdir(logDir, { recursive: true });
            
            // Create log entry
            const timestamp = new Date().toISOString();
            const date = new Date().toISOString().split('T')[0];
            const logFile = path.join(logDir, `dev-mode-${date}.log`);
            
            let logEntry = `[${timestamp}] ${action} - ${name}`;
            
            if (action === 'EXIT' && this.devModeStartTime) {
                const duration = this.calculateSessionDuration();
                logEntry += ` (Duration: ${duration})`;
            }
            
            logEntry += '\n';
            
            // Append to log file
            await fs.appendFile(logFile, logEntry, 'utf8');
            
            console.log(`📝 Developer mode logged: ${logEntry.trim()}`);
        } catch (error) {
            console.error('Failed to log developer mode event:', error);
        }
    }

    autoFillBiodata() {
        // Generate a test participant ID with timestamp
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        const testParticipantId = `DEV_${timestamp}`;
        
        // Simulate biodata form completion
        const testBiodata = {
            participant_id: testParticipantId,
            experimenter_initials: this.developerName ? this.developerName.substring(0, 4).toUpperCase() : 'DEV',
            age: '25',
            dominant_hand: 'right',
            gender: 'prefer_not_say',
            education: 'bachelor',
            primary_schooling_country: 'US',
            native_language: 'english',
            lang_l1_percent: 100,
            lang_l2_percent: 0,
            lang_other_percent: 0,
            vision_today: 'normal',
            color_vision: 'no',
            hearing_today: 'normal',
            tinnitus: 'no',
            sleep_hours: '7-8',
            caffeine: '1',
            consent_participation: 'yes'
        };

        // Store the form data
        this.currentFormData = testBiodata;
        
        // Update UI
        this.handleBiodataSuccess(testParticipantId, testBiodata);
        
        this.showToast(`Auto-filled biodata for: ${testParticipantId}`, 'success');
    }

    handleBiodataButtonClick() {
        console.log('Opening biodata form...');
        
        // If developer mode is enabled, auto-fill instead of showing form
        if (this.developerMode) {
            this.autoFillBiodata();
            return;
        }
        
        // Show loading state
        const biodataBtn = document.getElementById('biodata-btn');
        biodataBtn.classList.add('loading');
        biodataBtn.disabled = true;

        // Simulate brief loading delay
        setTimeout(() => {
            this.openBiodataForm();
            biodataBtn.classList.remove('loading');
            biodataBtn.disabled = false;
        }, 500);
    }

    setupEventListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('Dashboard DOM loaded');
        });

        // Biodata form button
        const biodataBtn = document.getElementById('biodata-btn');
        if (biodataBtn) {
            biodataBtn.addEventListener('click', () => {
                console.log('Biodata button clicked');
                this.handleBiodataButtonClick();
            });
        } else {
            console.error('Biodata button not found');
        }

        // Task dropdown - FIXED VERSION
        const taskDropdown = document.getElementById('task-dropdown');
        if (taskDropdown) {
            console.log('Task dropdown found, attaching event listener');
            taskDropdown.addEventListener('change', (e) => {
                console.log('Task dropdown changed to:', e.target.value);
                this.handleTaskSelection(e.target.value);
            });
        } else {
            console.error('Task dropdown not found!');
        }

        // Task configuration button
        const taskConfigBtn = document.getElementById('task-config-btn');
        if (taskConfigBtn) {
            console.log('Task config button found, attaching event listener');
            taskConfigBtn.addEventListener('click', () => {
                console.log('Task config button clicked');
                this.handleTaskConfigButtonClick();
            });
        } else {
            console.error('Task config button not found!');
        }

        // Run task button
        const runTaskBtn = document.getElementById('run-task-btn');
        if (runTaskBtn) {
            runTaskBtn.addEventListener('click', () => {
                this.handleRunTaskClick();
            });
        } else {
            console.error('Run task button not found!');
        }

        // Modal close events
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    this.closeModal();
                }
            });
        }

        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }


    handleTaskSelection(taskValue) {
        console.log('handleTaskSelection called with:', taskValue);
        
        const taskConfigBtn = document.getElementById('task-config-btn');
        const runTaskBtn = document.getElementById('run-task-btn');
        
        if (!taskValue) {
            // Disable buttons when no task selected
            if (taskConfigBtn) {
                taskConfigBtn.disabled = true;
            }
            if (runTaskBtn) {
                runTaskBtn.disabled = true;
            }
            this.updateStepState(3, 'inactive');
            return;
        }

        const taskSelect = document.getElementById('task-dropdown');
        const selectedOption = taskSelect.options[taskSelect.selectedIndex];
        const taskName = selectedOption.text;

        // Store selected task info
        this.selectedTask = taskName;
        this.selectedTaskValue = taskValue;
        this.currentState = 'task_selected';

        // Update stepper - mark step 2 as completed, step 3 as current
        this.updateStepState(2, 'completed');
        this.updateStepState(3, 'current');

        // Enable ONLY task config button (not run task button yet)
        if (taskConfigBtn) {
            taskConfigBtn.disabled = false;
            console.log('Task config button enabled for:', taskValue);
        } else {
            console.error('Task config button not found!');
        }

        // Keep run task button disabled until configuration is saved
        if (runTaskBtn) {
            runTaskBtn.disabled = true;
        }

        this.showToast(`Task selected: ${taskName}. Please configure the task before running.`, 'info');
    }


    async handleTaskConfigButtonClick() {
        if (!this.selectedTaskValue) return;

        const taskConfigBtn = document.getElementById('task-config-btn');
        
        // Show loading state
        taskConfigBtn.classList.add('loading');
        taskConfigBtn.disabled = true;

        // Brief loading delay
        setTimeout(() => {
            this.openTaskConfigModal();
            taskConfigBtn.classList.remove('loading');
            taskConfigBtn.disabled = false;
        }, 500);
    }

    async openTaskConfigModal() {
        const modalOverlay = document.getElementById('modal-overlay');
        const modalContent = modalOverlay.querySelector('.modal-content');
        
        // Add config modal class
        modalOverlay.classList.add('config-modal');
        
        // Generate configuration form based on selected task
        const configHTML = await this.generateTaskConfigHTML();
        modalContent.innerHTML = configHTML;
        
        modalOverlay.classList.add('open');
        modalOverlay.setAttribute('aria-hidden', 'false');
        
        // Bind configuration events
        this.bindConfigEvents();
        
        // Load existing configuration if available
        await this.loadTaskConfiguration();
        
        // Focus first tab
        const firstTab = modalContent.querySelector('.config-tab');
        if (firstTab) {
            setTimeout(() => firstTab.focus(), 100);
        }
    }

    async generateTaskConfigHTML() {
        console.log('Selected task value:', this.selectedTaskValue);

        const taskName = this.selectedTask;
        
        if (this.selectedTaskValue === 'speeded-classification') {
            return this.generateSpeededClassificationConfig();
        } else if (this.selectedTaskValue === 'auditory-stroop') {
            if (!window.auditoryStroopConfig) {
                window.auditoryStroopConfig = new AuditoryStroopConfig();
            }
            return window.auditoryStroopConfig.generateConfigHTML();
        } else if (this.selectedTaskValue === 'stroop-color-word') {
            if (!window.stroopColorWordConfig) {
                window.stroopColorWordConfig = new StroopColorWordConfig();
            }
            return window.stroopColorWordConfig.generateConfigHTML();
        } else if (this.selectedTaskValue === 'cvc') {
            if (!window.cvcConfig) {
                window.cvcConfig = new CVCConfig();
            }
            return window.cvcConfig.generateConfigHTML();
        } else if (this.selectedTaskValue === 'reading-span') {
            if (!window.readingSpanConfig) {
                window.readingSpanConfig = new ReadingSpanConfig();
            }
            return window.readingSpanConfig.generateConfigHTML();
        } else if (this.selectedTaskValue === 'reading-span') {
            if (!window.readingSpanConfig) {
                window.readingSpanConfig = new ReadingSpanConfig();
            }
            return window.readingSpanConfig.generateConfigHTML();
        } else if (this.selectedTaskValue === 'hint-practice') {
            // Initialize Practice Sentence config
            if (!window.practiceSentenceConfig) {
                window.practiceSentenceConfig = new PracticeSentenceConfig();
            }
            return window.practiceSentenceConfig.generateConfigHTML();
        } else if (this.selectedTaskValue === 'cast-practice') {
            // Initialize Practice CaST config
            if (!window.practiceCastConfig) {
                window.practiceCastConfig = new PracticeCastConfig();
            }
            return window.practiceCastConfig.generateConfigHTML();
        } else if (this.selectedTaskValue === 'cst') {
            // Initialize CST config
            if (!window.cstConfig) {
                window.cstConfig = new CSTConfig();
            }
            return window.cstConfig.generateConfigHTML();
        } else if (this.selectedTaskValue === 'hint') {
            // Initialize HINT config
            if (!window.hintConfig) {
                window.hintConfig = new HINTConfig();
            }
            return window.hintConfig.generateConfigHTML();
        } else if (this.selectedTaskValue === 'cast-word') {
            // Initialize CaST Word config
            if (!window.castWordConfig) {
                window.castWordConfig = new CaSTWordConfig();
            }
            return window.castWordConfig.generateConfigHTML();
        } else if (this.selectedTaskValue === 'cast-nonword') {
            // Initialize CaST Non-word config
            if (!window.castNonwordConfig) {
                window.castNonwordConfig = new CaSTNonwordConfig();
            }
            return window.castNonwordConfig.generateConfigHTML();
        }
  
        // Fallback for other tasks
        return `
            <div class="modal-header">
                <h2 class="modal-title">${taskName} Configuration</h2>
                <button type="button" class="modal-close" aria-label="Close configuration">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L10 9.293l4.646-4.647a.5.5 0 0 1 .708.708L10.707 10l4.647 4.646a.5.5 0 0 1-.708.708L10 10.707l-4.646 4.647a.5.5 0 0 1-.708-.708L9.293 10 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <p>Configuration settings for ${taskName} are not yet implemented.</p>
            </div>
            <div class="modal-footer">
                <button type="button" class="button-secondary" id="config-cancel-btn">Cancel</button>
                <button type="button" class="button-primary" id="config-save-btn">Save Configuration</button>
            </div>
        `;
    }

    generateSpeededClassificationConfig() {
        return `
            <div class="modal-header">
                <h2 class="modal-title">Speeded Classification Task Configuration</h2>
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
                                <label for="practice-phoneme">Number of Practice Trials (Phoneme)</label>
                                <div class="number-stepper">
                                    <button type="button" data-action="decrease" data-target="practice-phoneme">−</button>
                                    <input type="number" id="practice-phoneme" name="practice_phoneme" min="0" max="20" value="1" readonly>
                                    <button type="button" data-action="increase" data-target="practice-phoneme">+</button>
                                </div>
                            </div>
                            
                            <div class="config-group">
                                <label for="practice-voice">Number of Practice Trials (Voice)</label>
                                <div class="number-stepper">
                                    <button type="button" data-action="decrease" data-target="practice-voice">−</button>
                                    <input type="number" id="practice-voice" name="practice_voice" min="0" max="20" value="1" readonly>
                                    <button type="button" data-action="increase" data-target="practice-voice">+</button>
                                </div>
                            </div>
                        </div>

                        <div class="config-row">
                            <div class="config-group">
                                <label for="main-phoneme">Number of Main Trials (Phoneme)</label>
                                <div class="number-stepper">
                                    <button type="button" data-action="decrease" data-target="main-phoneme">−</button>
                                    <input type="number" id="main-phoneme" name="main_phoneme" min="0" max="20" value="2" readonly>
                                    <button type="button" data-action="increase" data-target="main-phoneme">+</button>
                                </div>
                            </div>
                            
                            <div class="config-group">
                                <label for="main-voice">Number of Main Trials (Voice)</label>
                                <div class="number-stepper">
                                    <button type="button" data-action="decrease" data-target="main-voice">−</button>
                                    <input type="number" id="main-voice" name="main_voice" min="0" max="20" value="2" readonly>
                                    <button type="button" data-action="increase" data-target="main-voice">+</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Timing Tab -->
                <div class="config-tab-content" id="timing-tab">
                    <div class="config-card">
                        <h3>Timing Parameters</h3>
                        
                        <div class="config-group">
                            <label for="iti-slider">Inter-trial Interval (ITI)</label>
                            <div class="slider-control">
                                <div class="slider-value">
                                    <span>ITI Duration</span>
                                    <span class="slider-value-display" id="iti-value">1000 ms</span>
                                </div>
                                <input type="range" id="iti-slider" name="iti" min="500" max="3000" step="100" value="1000" class="config-slider">
                            </div>
                        </div>

                        <div class="config-group">
                            <label for="pre-stimulus-slider">Pre-stimulus Delay</label>
                            <div class="slider-control">
                                <div class="slider-value">
                                    <span>Delay Duration</span>
                                    <span class="slider-value-display" id="pre-stimulus-value">1500 ms</span>
                                </div>
                                <input type="range" id="pre-stimulus-slider" name="pre_stimulus_delay" min="500" max="3000" step="100" value="1500" class="config-slider">
                            </div>
                        </div>

                        <div class="config-group">
                            <label for="response-timeout-slider">Response Timeout</label>
                            <div class="slider-control">
                                <div class="slider-value">
                                    <span>Timeout Duration</span>
                                    <span class="slider-value-display" id="timeout-value">10000 ms</span>
                                </div>
                                <input type="range" id="response-timeout-slider" name="response_timeout" min="2000" max="15000" step="500" value="10000" class="config-slider">
                            </div>
                        </div>

                        <div class="config-group">
                            <label for="error-display-slider">Trial Result Display Duration (Error/No-response)</label>
                            <div class="slider-control">
                                <div class="slider-value">
                                    <span>Display Duration</span>
                                    <span class="slider-value-display" id="error-display-value">2000 ms</span>
                                </div>
                                <input type="range" id="error-display-slider" name="error_display_duration" min="500" max="5000" step="500" value="2000" class="config-slider">
                            </div>
                            <div class="help-text">Correct responses tie to ITI duration</div>
                        </div>
                    </div>
                </div>


                <!-- Audio Tab -->
                <div class="config-tab-content" id="audio-tab">
                    <div class="config-card">
                        <h3>Audio Parameters</h3>
                        
                        <div class="config-group">
                            <label for="volume-slider">Audio Playback Volume</label>
                            <div class="slider-control">
                                <div class="slider-value">
                                    <span>Volume Level</span>
                                    <span class="slider-value-display" id="volume-value">70%</span>
                                    <span class="volume-icon" id="volume-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                                        </svg>
                                    </span>
                                </div>
                                <input type="range" id="volume-slider" name="audio_volume" min="0.1" max="1.0" step="0.1" value="0.7" class="config-slider">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Data Tab -->
                <div class="config-tab-content" id="data-tab">
                    <div class="config-card">
                        <h3>Data Handling</h3>
                        
                        <div class="config-group">
                            <label for="crash-recovery">Enable Crash Recovery Logs</label>
                            <div class="toggle-switch">
                                <input type="checkbox" id="crash-recovery" name="crash_recovery" checked>
                                <span class="toggle-slider"></span>
                            </div>
                            <div class="help-text">Automatically save progress to recover from unexpected crashes</div>
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
        const taskConfigMap = {
            'speeded-classification': () => {
                // Existing speeded classification binding code
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
                        this.saveTaskConfiguration();
                    });
                }

                // Tab switching
                const tabs = modalContent.querySelectorAll('.config-tab');
                tabs.forEach(tab => {
                    tab.addEventListener('click', () => {
                        this.switchConfigTab(tab.getAttribute('data-tab'));
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
            },
            'auditory-stroop': () => {
                if (window.auditoryStroopConfig) {
                    window.auditoryStroopConfig.bindConfigEvents();
                }
            },
            'stroop-color-word': () => {
                if (window.stroopColorWordConfig) {
                    window.stroopColorWordConfig.bindConfigEvents();
                }
            },
            'cvc': () => {
                if (window.cvcConfig) {
                    window.cvcConfig.bindConfigEvents();
                }
            },
            'reading-span': () => {
                if (window.readingSpanConfig) {
                    window.readingSpanConfig.bindConfigEvents();
                }
            },
            'hint-practice': () => {
                if (window.practiceSentenceConfig) {
                    window.practiceSentenceConfig.bindConfigEvents();
                }
            },
            'cast-practice': () => {
                if (window.practiceCastConfig) {
                    window.practiceCastConfig.bindConfigEvents();
                }
            },
            'cst': () => {
                if (window.cstConfig) {
                    window.cstConfig.bindConfigEvents();
                }
            },
            'hint': () => {
                if (window.hintConfig) {
                    window.hintConfig.bindConfigEvents();
                }
            },
            'cast-word': () => {
                if (window.castWordConfig) {
                    window.castWordConfig.bindConfigEvents();
                }
            },
            'cast-nonword': () => {
                if (window.castNonwordConfig) {
                    window.castNonwordConfig.bindConfigEvents();
                }
            }
        };

        const bindFunction = taskConfigMap[this.selectedTaskValue];
        if (bindFunction) {
            bindFunction();
        } else {
            this.bindGenericConfigEvents();
        }
    }

    // Add this new method for generic config binding
    bindGenericConfigEvents() {
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

        // Save button - just close for unimplemented tasks
        const saveBtn = modalContent.querySelector('#config-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.closeConfigModal();
                this.showToast('Configuration not yet implemented', 'info');
            });
        }
    }

    switchConfigTab(tabName) {
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
        const step = parseInt(button.getAttribute('data-step')) || 1;
        const input = document.getElementById(targetId);
        
        if (!input) return;

        let currentValue = parseInt(input.value) || 0;
        const min = parseInt(input.getAttribute('min')) || 0;
        const max = parseInt(input.getAttribute('max')) || 100;

        if (action === 'increase' && currentValue < max) {
            currentValue += step;
        } else if (action === 'decrease' && currentValue > min) {
            currentValue -= step;
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
            case 'iti':
                document.getElementById('iti-value').textContent = `${value} ms`;
                break;
            case 'pre_stimulus_delay':
                document.getElementById('pre-stimulus-value').textContent = `${value} ms`;
                break;
            case 'response_timeout':
                document.getElementById('timeout-value').textContent = `${value} ms`;
                break;
            case 'error_display_duration':
                document.getElementById('error-display-value').textContent = `${value} ms`;
                break;
            case 'audio_volume':
                const percentage = Math.round(value * 100);
                document.getElementById('volume-value').textContent = `${percentage}%`;
                this.updateVolumeIcon(value);
                break;
        }
    }

    updateVolumeIcon(volume) {
        const icon = document.getElementById('volume-icon');
        if (!icon) return;
        
        const scale = 0.8 + (volume * 0.4); // Scale from 0.8 to 1.2
        icon.style.transform = `scale(${scale})`;
    }

    async saveTaskConfiguration() {
        const saveBtn = document.getElementById('config-save-btn');
        saveBtn.classList.add('loading');
        saveBtn.disabled = true;

        try {
            // Collect configuration data
            const config = this.collectConfigurationData();
            
            // Save to JSON file
            await this.saveConfigurationToFile(config);
            
            // Show success message
            this.showToast('Configuration saved successfully', 'success');
            
            // Close modal
            this.closeConfigModal();
            
            // Mark step 3 as completed and enable run task button
            this.updateStepState(3, 'completed');
            
            // Enable run task button
            const runTaskBtn = document.getElementById('run-task-btn');
            if (runTaskBtn) {
                runTaskBtn.disabled = false;
                console.log('Run task button enabled after configuration save');
            }
            
            // Update state
            this.currentState = 'ready_to_run';
            
        } catch (error) {
            console.error('Error saving configuration:', error);
            this.showToast('Failed to save configuration', 'error');
            
            // Reset button state
            saveBtn.classList.remove('loading');
            saveBtn.disabled = false;
        }
    }

    collectConfigurationData() {
        const config = {
            task: 'speeded-classification',
            timestamp: new Date().toISOString(),
            parameters: {
                trials: {
                    practice_phoneme: parseInt(document.getElementById('practice-phoneme')?.value) || 1,
                    practice_voice: parseInt(document.getElementById('practice-voice')?.value) || 1,
                    main_phoneme: parseInt(document.getElementById('main-phoneme')?.value) || 2,
                    main_voice: parseInt(document.getElementById('main-voice')?.value) || 2
                },
                timing: {
                    iti: parseInt(document.getElementById('iti-slider')?.value) || 1000,
                    pre_stimulus_delay: parseInt(document.getElementById('pre-stimulus-slider')?.value) || 1500,
                    response_timeout: parseInt(document.getElementById('response-timeout-slider')?.value) || 10000,
                    error_display_duration: parseInt(document.getElementById('error-display-slider')?.value) || 2000
                },
                audio: {
                    volume: parseFloat(document.getElementById('volume-slider')?.value) || 0.7
                },
                data: {
                    crash_recovery: document.getElementById('crash-recovery')?.checked || true
                }
            }
        };
        
        return config;
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
        
        // Ensure directory exists
        await fs.mkdir(baseDir, { recursive: true });
        
        // Save configuration file
        const configPath = path.join(baseDir, 'cfg_speeded_classification_task.json');
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
        
        console.log(`Configuration saved to: ${configPath}`);
    }

    async loadTaskConfiguration() {
        const taskLoadMap = {
            'speeded-classification': async () => {
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
                    
                    const configPath = path.join(baseDir, 'cfg_speeded_classification_task.json');
                    const configData = await fs.readFile(configPath, 'utf8');
                    const config = JSON.parse(configData);
                    
                    this.applyConfigurationToForm(config);
                    
                } catch (error) {
                    console.log('No existing speeded classification configuration found, using defaults');
                }
            },
            'auditory-stroop': async () => {
                if (window.auditoryStroopConfig) {
                    await window.auditoryStroopConfig.loadExistingConfiguration();
                }
            },
            'stroop-color-word': async () => {
                if (window.stroopColorWordConfig) {
                    await window.stroopColorWordConfig.loadExistingConfiguration();
                }
            },
            'cvc': async () => {
                if (window.cvcConfig) {
                    await window.cvcConfig.loadExistingConfiguration();
                }
            },
            'reading-span': async () => {
                if (window.readingSpanConfig) {
                    await window.readingSpanConfig.loadExistingConfiguration();
                }
            },
            'hint-practice': async () => {
                if (window.practiceSentenceConfig) {
                    await window.practiceSentenceConfig.loadExistingConfiguration();
                    window.practiceSentenceConfig.updateUIFromConfig();
                }
            },
            'cast-practice': async () => {
                if (window.practiceCastConfig) {
                    await window.practiceCastConfig.loadExistingConfiguration();
                    window.practiceCastConfig.updateUIFromConfig();
                }
            },
            'cst': async () => {
                if (window.cstConfig) {
                    await window.cstConfig.loadExistingConfiguration();
                    window.cstConfig.updateUIFromConfig();
                }
            },
            'hint': async () => {
                if (window.hintConfig) {
                    await window.hintConfig.loadExistingConfiguration();
                    window.hintConfig.updateUIFromConfig();
                }
            },
            'cast-word': async () => {
                if (window.castWordConfig) {
                    await window.castWordConfig.loadExistingConfiguration();
                    window.castWordConfig.updateUIFromConfig();
                }
            },
            'cast-nonword': async () => {
                if (window.castNonwordConfig) {
                    await window.castNonwordConfig.loadExistingConfiguration();
                    window.castNonwordConfig.updateUIFromConfig();
                }
            }
        };

        const loadFunction = taskLoadMap[this.selectedTaskValue];
        if (loadFunction) {
            await loadFunction();
        }
    }

    applyConfigurationToForm(config) {
        const params = config.parameters;
        
        // Apply trial parameters
        if (params.trials) {
            this.setInputValue('practice-phoneme', params.trials.practice_phoneme);
            this.setInputValue('practice-voice', params.trials.practice_voice);
            this.setInputValue('main-phoneme', params.trials.main_phoneme);
            this.setInputValue('main-voice', params.trials.main_voice);
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
        const sliders = document.querySelectorAll('.config-slider');
        sliders.forEach(slider => this.updateSliderValue(slider));
    }

    setInputValue(id, value) {
        const input = document.getElementById(id);
        if (input && value !== undefined) {
            input.value = value;
        }
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

    initializeDashboard() {
        this.updateStepState(1, 'current');
        this.updateStepState(2, 'inactive');
        this.updateStepState(3, 'inactive');
        
        const biodataBtn = document.getElementById('biodata-btn');
        if (biodataBtn) {
            biodataBtn.focus();
        }
    }

    handleBiodataButtonClick() {
        console.log('Opening biodata form...');
        
        // Show loading state
        const biodataBtn = document.getElementById('biodata-btn');
        biodataBtn.classList.add('loading');
        biodataBtn.disabled = true;

        // Simulate brief loading delay
        setTimeout(() => {
            this.openBiodataForm();
            biodataBtn.classList.remove('loading');
            biodataBtn.disabled = false;
        }, 500);
    }

    openBiodataForm() {
        const modalOverlay = document.getElementById('modal-overlay');
        const modalContent = modalOverlay.querySelector('.modal-content');
        
        modalContent.innerHTML = this.generateBiodataFormHTML();
        modalOverlay.classList.add('open');
        modalOverlay.setAttribute('aria-hidden', 'false');
        
        // Bind form events
        this.bindFormEvents();
        
        // Focus first input
        const firstInput = modalContent.querySelector('input');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }

    generateBiodataFormHTML() {
        const currentDate = new Date();
        const sessionDate = currentDate.toISOString().split('T')[0];
        const startTime = currentDate.toTimeString().split(' ')[0].substring(0, 5);

        return `
            <form id="biodata-form" novalidate>
                <div class="modal-header">
                    <h2 class="modal-title">Participant Information</h2>
                    <button type="button" class="modal-close" aria-label="Close form">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L10 9.293l4.646-4.647a.5.5 0 0 1 .708.708L10.707 10l4.647 4.646a.5.5 0 0 1-.708.708L10 10.707l-4.646 4.647a.5.5 0 0 1-.708-.708L9.293 10 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                        </svg>
                    </button>
                </div>

                <div class="modal-body">
                    <!-- Session Info -->
                    <div class="form-section">
                        <h3>Session Information</h3>
                        
                        <div class="form-row">
                            <div class="form-group required">
                                <label for="participant_id">Participant ID</label>
                                <input type="text" id="participant_id" name="participant_id" required 
                                    pattern="^[a-zA-Z0-9]{2,20}$" placeholder="Enter participant ID">
                                <div class="error-text" id="participant_id_error"></div>
                            </div>
                            
                            <div class="form-group">
                                <label for="experimenter_initials">Experimenter Initials</label>
                                <input type="text" id="experimenter_initials" name="experimenter_initials" 
                                    placeholder="Optional" maxlength="4">
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Session Date</label>
                                <input type="date" value="${sessionDate}" readonly style="background: #f5f5f7;">
                            </div>
                            
                            <div class="form-group">
                                <label>Start Time</label>
                                <input type="time" value="${startTime}" readonly style="background: #f5f5f7;">
                            </div>
                        </div>
                    </div>

                    <!-- A) About You -->
                    <div class="form-section">
                        <h3>A) About You</h3>
                        
                        <div class="form-row">
                            <div class="form-group required">
                                <label for="age">Age</label>
                                <select id="age" name="age" required>
                                    <option value="">Select age...</option>
                                    ${Array.from({length: 83}, (_, i) => i + 18).map(age => 
                                        `<option value="${age}">${age}</option>`
                                    ).join('')}
                                </select>
                                <div class="error-text" id="age_error"></div>
                            </div>
                            
                            <div class="form-group required">
                                <label for="dominant_hand">Dominant Hand</label>
                                <div class="radio-group">
                                    <label class="radio-label">
                                        <input type="radio" name="dominant_hand" value="right" required>
                                        Right
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="dominant_hand" value="left" required>
                                        Left
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="dominant_hand" value="both" required>
                                        Both
                                    </label>
                                </div>
                                <div class="error-text" id="dominant_hand_error"></div>
                            </div>
                        </div>

                        <div class="form-group required">
                            <label>Gender</label>
                            <div class="radio-group">
                                <label class="radio-label">
                                    <input type="radio" name="gender" value="female" required>
                                    Female
                                </label>
                                <label class="radio-label">
                                    <input type="radio" name="gender" value="male" required>
                                    Male
                                </label>
                                <label class="radio-label">
                                    <input type="radio" name="gender" value="non_binary" required>
                                    Non-binary
                                </label>
                                <label class="radio-label">
                                    <input type="radio" name="gender" value="prefer_not_say" required>
                                    Prefer not to say
                                </label>
                                <label class="radio-label">
                                    <input type="radio" name="gender" value="self_describe" required>
                                    Self-describe
                                </label>
                            </div>
                            <div class="conditional-field" id="gender_self_describe" style="display: none;">
                                <input type="text" name="gender_self_describe_text" placeholder="Please specify...">
                            </div>
                            <div class="error-text" id="gender_error"></div>
                        </div>

                        <div class="form-row">
                            <div class="form-group required">
                                <label for="education">Highest Education Completed</label>
                                <select id="education" name="education" required>
                                    <option value="">Select...</option>
                                    <option value="high_school">High School</option>
                                    <option value="some_college">Some College</option>
                                    <option value="bachelor">Bachelor's Degree</option>
                                    <option value="graduate">Graduate Degree</option>
                                    <option value="other">Other</option>
                                </select>
                                <div class="conditional-field" id="education_other" style="display: none;">
                                    <input type="text" name="education_other_text" placeholder="Please specify...">
                                </div>
                                <div class="error-text" id="education_error"></div>
                            </div>
                            
                            <div class="form-group required">
                                <label for="primary_schooling_country">Country of Primary Schooling</label>
                                <select id="primary_schooling_country" name="primary_schooling_country" required>
                                    <option value="">Select...</option>
                                    <option value="US">United States</option>
                                    <option value="CA">Canada</option>
                                    <option value="GB">United Kingdom</option>
                                    <option value="AU">Australia</option>
                                    <option value="DE">Germany</option>
                                    <option value="FR">France</option>
                                    <option value="ES">Spain</option>
                                    <option value="IT">Italy</option>
                                    <option value="JP">Japan</option>
                                    <option value="CN">China</option>
                                    <option value="IN">India</option>
                                    <option value="BR">Brazil</option>
                                    <option value="MX">Mexico</option>
                                    <option value="other">Other</option>
                                </select>
                                <div class="conditional-field" id="schooling_country_other" style="display: none;">
                                    <input type="text" name="schooling_country_other_text" placeholder="Please specify country...">
                                </div>
                                <div class="error-text" id="primary_schooling_country_error"></div>
                            </div>
                        </div>
                    </div>

                    <!-- B) Language & Reading -->
                    <div class="form-section">
                        <h3>B) Language & Reading</h3>
                        
                        <div class="form-group required">
                            <label for="native_language">Native / First Language(s)</label>
                            <select id="native_language" name="native_language" required>
                                <option value="">Select...</option>
                                <option value="english">English</option>
                                <option value="spanish">Spanish</option>
                                <option value="mandarin">Mandarin Chinese</option>
                                <option value="hindi">Hindi</option>
                                <option value="arabic">Arabic</option>
                                <option value="portuguese">Portuguese</option>
                                <option value="bengali">Bengali</option>
                                <option value="russian">Russian</option>
                                <option value="japanese">Japanese</option>
                                <option value="french">French</option>
                                <option value="german">German</option>
                                <option value="korean">Korean</option>
                                <option value="italian">Italian</option>
                                <option value="other">Other</option>
                            </select>
                            <div class="conditional-field" id="native_language_other" style="display: none;">
                                <input type="text" name="native_language_other_text" placeholder="Please specify language...">
                            </div>
                            <div class="error-text" id="native_language_error"></div>
                        </div>

                        <div class="form-group">
                            <label>Daily Language Use (%)</label>
                            <div class="slider-group">
                                <div class="slider-item">
                                    <label for="lang_l1_percent">L1 (First Language): <span id="lang_l1_value">50</span>%</label>
                                    <input type="range" id="lang_l1_percent" name="lang_l1_percent" min="0" max="100" value="50" class="slider">
                                </div>
                                <div class="slider-item">
                                    <label for="lang_l2_percent">L2 (Second Language): <span id="lang_l2_value">30</span>%</label>
                                    <input type="range" id="lang_l2_percent" name="lang_l2_percent" min="0" max="100" value="30" class="slider">
                                </div>
                                <div class="slider-item">
                                    <label for="lang_other_percent">Other: <span id="lang_other_value">20</span>%</label>
                                    <input type="range" id="lang_other_percent" name="lang_other_percent" min="0" max="100" value="20" class="slider">
                                </div>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="english_age_start">Age Began Using English Regularly</label>
                                <select id="english_age_start" name="english_age_start">
                                    <option value="">Select...</option>
                                    <option value="0">Birth (0)</option>
                                    ${Array.from({length: 25}, (_, i) => i + 1).map(age => 
                                        `<option value="${age}">${age}</option>`
                                    ).join('')}
                                    <option value="26">26+</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="reading_hours_weekly">Hours of Reading per Week</label>
                                <select id="reading_hours_weekly" name="reading_hours_weekly">
                                    <option value="">Select...</option>
                                    <option value="0">0</option>
                                    <option value="1-2">1-2</option>
                                    <option value="3-5">3-5</option>
                                    <option value="6-10">6-10</option>
                                    <option value="11-15">11-15</option>
                                    <option value="16-20">16-20</option>
                                    <option value="21+">21+</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Self-rated English Proficiency (1 = Poor, 7 = Excellent)</label>
                            <div class="likert-group">
                                <div class="likert-item">
                                    <label for="english_speaking">Speaking: <span id="english_speaking_value">4</span></label>
                                    <input type="range" id="english_speaking" name="english_speaking" min="1" max="7" value="4" class="likert-slider">
                                    <div class="likert-labels">
                                        <span>Poor</span>
                                        <span>Excellent</span>
                                    </div>
                                </div>
                                <div class="likert-item">
                                    <label for="english_listening">Listening: <span id="english_listening_value">4</span></label>
                                    <input type="range" id="english_listening" name="english_listening" min="1" max="7" value="4" class="likert-slider">
                                    <div class="likert-labels">
                                        <span>Poor</span>
                                        <span>Excellent</span>
                                    </div>
                                </div>
                                <div class="likert-item">
                                    <label for="english_reading">Reading: <span id="english_reading_value">4</span></label>
                                    <input type="range" id="english_reading" name="english_reading" min="1" max="7" value="4" class="likert-slider">
                                    <div class="likert-labels">
                                        <span>Poor</span>
                                        <span>Excellent</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Reading Difficulties Ever Diagnosed?</label>
                            <div class="toggle-group">
                                <label class="toggle-label">
                                    <input type="radio" name="reading_difficulties" value="no">
                                    No
                                </label>
                                <label class="toggle-label">
                                    <input type="radio" name="reading_difficulties" value="yes">
                                    Yes
                                </label>
                            </div>
                            <div class="conditional-field" id="reading_difficulties_details" style="display: none;">
                                <textarea name="reading_difficulties_text" placeholder="Please describe..." rows="2"></textarea>
                            </div>
                        </div>
                    </div>

                    <!-- C) Vision & Color -->
                    <div class="form-section">
                        <h3>C) Vision & Color</h3>
                        
                        <div class="form-row">
                            <div class="form-group required">
                                <label>Vision Today</label>
                                <div class="radio-group">
                                    <label class="radio-label">
                                        <input type="radio" name="vision_today" value="normal" required>
                                        Normal
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="vision_today" value="corrected" required>
                                        Corrected
                                    </label>
                                </div>
                                <div class="error-text" id="vision_today_error"></div>
                            </div>
                            
                            <div class="form-group required">
                                <label>Color-vision Deficiency Diagnosed?</label>
                                <div class="radio-group">
                                    <label class="radio-label">
                                        <input type="radio" name="color_vision" value="no" required>
                                        No
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="color_vision" value="yes" required>
                                        Yes
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="color_vision" value="unsure" required>
                                        Unsure
                                    </label>
                                </div>
                                <div class="error-text" id="color_vision_error"></div>
                            </div>
                        </div>
                    </div>

                    <!-- D) Hearing & Sound History -->
                    <div class="form-section">
                        <h3>D) Hearing & Sound History</h3>
                        
                        <div class="form-row">
                            <div class="form-group required">
                                <label>Hearing Today</label>
                                <div class="radio-group">
                                    <label class="radio-label">
                                        <input type="radio" name="hearing_today" value="normal" required>
                                        Normal
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="hearing_today" value="difficulty" required>
                                        Some difficulty
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="hearing_today" value="hearing_aid" required>
                                        Use hearing aid
                                    </label>
                                </div>
                                <div class="error-text" id="hearing_today_error"></div>
                            </div>
                            
                            <div class="form-group required">
                                <label>Tinnitus</label>
                                <div class="radio-group">
                                    <label class="radio-label">
                                        <input type="radio" name="tinnitus" value="no" required>
                                        No
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="tinnitus" value="occasional" required>
                                        Yes, occasional
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="tinnitus" value="constant" required>
                                        Yes, constant
                                    </label>
                                </div>
                                <div class="error-text" id="tinnitus_error"></div>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Loud Noise in Last 24h</label>
                                <div class="toggle-group">
                                    <label class="toggle-label">
                                        <input type="radio" name="loud_noise" value="no">
                                        No
                                    </label>
                                    <label class="toggle-label">
                                        <input type="radio" name="loud_noise" value="yes">
                                        Yes
                                    </label>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label>Ever Had Hearing Test?</label>
                                <div class="toggle-group">
                                    <label class="toggle-label">
                                        <input type="radio" name="hearing_test" value="no">
                                        No
                                    </label>
                                    <label class="toggle-label">
                                        <input type="radio" name="hearing_test" value="yes">
                                        Yes
                                    </label>
                                </div>
                                <div class="conditional-field" id="hearing_test_year" style="display: none;">
                                    <input type="number" name="hearing_test_year_value" placeholder="Year" min="1950" max="2024">
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Ear Conditions or Surgeries?</label>
                            <div class="toggle-group">
                                <label class="toggle-label">
                                    <input type="radio" name="ear_conditions" value="no">
                                    No
                                </label>
                                <label class="toggle-label">
                                    <input type="radio" name="ear_conditions" value="yes">
                                    Yes
                                </label>
                            </div>
                            <div class="conditional-field" id="ear_conditions_details" style="display: none;">
                                <textarea name="ear_conditions_text" placeholder="Please describe..." rows="2"></textarea>
                            </div>
                        </div>
                    </div>

                    <!-- E) Health & Medications (Today) -->
                    <div class="form-section">
                        <h3>E) Health & Medications (Today)</h3>
                        
                        <div class="form-group">
                            <label>Neurological/Psychiatric History</label>
                            <div class="checkbox-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" name="neuro_history" value="tbi">
                                    Traumatic Brain Injury (TBI)
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="neuro_history" value="epilepsy">
                                    Epilepsy
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="neuro_history" value="adhd">
                                    ADHD
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="neuro_history" value="depression_anxiety">
                                    Depression/Anxiety
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="neuro_history" value="migraine">
                                    Migraine
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="neuro_history" value="other">
                                    Other
                                </label>
                            </div>
                            <div class="conditional-field" id="neuro_history_other" style="display: none;">
                                <textarea name="neuro_history_other_text" placeholder="Please describe..." rows="2"></textarea>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Current Medications Today</label>
                            <div class="toggle-group">
                                <label class="toggle-label">
                                    <input type="radio" name="current_medications" value="none">
                                    None
                                </label>
                                <label class="toggle-label">
                                    <input type="radio" name="current_medications" value="add_entry">
                                    Add Entry
                                </label>
                            </div>
                            <div class="conditional-field" id="medications_list" style="display: none;">
                                <select name="medication_type">
                                    <option value="">Select medication type...</option>
                                    <option value="pain_relief">Pain Relief (Tylenol, Ibuprofen, etc.)</option>
                                    <option value="antidepressant">Antidepressant</option>
                                    <option value="stimulant">Stimulant (ADHD medication)</option>
                                    <option value="antihistamine">Antihistamine (Allergy medication)</option>
                                    <option value="blood_pressure">Blood Pressure medication</option>
                                    <option value="birth_control">Birth Control</option>
                                    <option value="vitamin">Vitamin/Supplement</option>
                                    <option value="other">Other</option>
                                </select>
                                <input type="text" name="medication_other_text" placeholder="Specify medication name..." style="margin-top: 8px;">
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group required">
                                <label for="sleep_hours">Sleep Last Night (Hours)</label>
                                <select id="sleep_hours" name="sleep_hours" required>
                                    <option value="">Select...</option>
                                    <option value="0-2">0-2 hours</option>
                                    <option value="3-4">3-4 hours</option>
                                    <option value="5-6">5-6 hours</option>
                                    <option value="7-8">7-8 hours</option>
                                    <option value="9-10">9-10 hours</option>
                                    <option value="11+">11+ hours</option>
                                </select>
                                <div class="error-text" id="sleep_hours_error"></div>
                            </div>
                            
                            <div class="form-group required">
                                <label>Caffeine in Last 4h</label>
                                <div class="radio-group">
                                    <label class="radio-label">
                                        <input type="radio" name="caffeine" value="0" required>
                                        0
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="caffeine" value="1" required>
                                        1
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="caffeine" value="2+" required>
                                        2+
                                    </label>
                                </div>
                                <div class="error-text" id="caffeine_error"></div>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Alcohol in Last 24h</label>
                                <div class="radio-group">
                                    <label class="radio-label">
                                        <input type="radio" name="alcohol" value="no">
                                        No
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="alcohol" value="1-2">
                                        1-2 drinks
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="alcohol" value="3+">
                                        3+ drinks
                                    </label>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label>Recreational Drugs/Nicotine in Last 24h</label>
                                <div class="toggle-group">
                                    <label class="toggle-label">
                                        <input type="radio" name="drugs_nicotine" value="no">
                                        No
                                    </label>
                                    <label class="toggle-label">
                                        <input type="radio" name="drugs_nicotine" value="yes">
                                        Yes
                                    </label>
                                </div>
                                <div class="conditional-field" id="drugs_nicotine_details" style="display: none;">
                                    <textarea name="drugs_nicotine_text" placeholder="Please describe..." rows="2"></textarea>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- F) Music & Motor -->
                    <div class="form-section">
                        <h3>F) Music & Motor</h3>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Formal Music Training (Years)</label>
                                <div class="radio-group">
                                    <label class="radio-label">
                                        <input type="radio" name="music_training" value="0">
                                        0
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="music_training" value="1-3">
                                        1-3
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="music_training" value="4-7">
                                        4-7
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="music_training" value="8+">
                                        8+
                                    </label>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label>Weekly Music Practice Now (Hours)</label>
                                <div class="radio-group">
                                    <label class="radio-label">
                                        <input type="radio" name="music_practice" value="0">
                                        0
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="music_practice" value="1-2">
                                        1-2
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="music_practice" value="3-5">
                                        3-5
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="music_practice" value="6+">
                                        6+
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Motor Limitations Affecting Responses?</label>
                            <div class="toggle-group">
                                <label class="toggle-label">
                                    <input type="radio" name="motor_limitations" value="no">
                                    No
                                </label>
                                <label class="toggle-label">
                                    <input type="radio" name="motor_limitations" value="yes">
                                    Yes
                                </label>
                            </div>
                            <div class="conditional-field" id="motor_limitations_details" style="display: none;">
                                <textarea name="motor_limitations_text" placeholder="Please describe..." rows="2"></textarea>
                            </div>
                        </div>
                    </div>

                    <!-- G) Today's Setup -->
                    <div class="form-section">
                        <h3>G) Today's Setup</h3>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Glasses/Contacts Worn During Tasks?</label>
                                <div class="radio-group">
                                    <label class="radio-label">
                                        <input type="radio" name="vision_correction_during_tasks" value="no">
                                        No
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="vision_correction_during_tasks" value="glasses">
                                        Glasses
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="vision_correction_during_tasks" value="contacts">
                                        Contacts
                                    </label>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label>Preferred Response Hand</label>
                                <div class="radio-group">
                                    <label class="radio-label">
                                        <input type="radio" name="preferred_response_hand" value="right">
                                        Right
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="preferred_response_hand" value="left">
                                        Left
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="preferred_response_hand" value="either">
                                        Either
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Headphones Comfortable?</label>
                            <div class="toggle-group">
                                <label class="toggle-label">
                                    <input type="radio" name="headphones_comfortable" value="yes">
                                    Yes
                                </label>
                                <label class="toggle-label">
                                    <input type="radio" name="headphones_comfortable" value="no">
                                    No
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- H) Consent & Contact -->
                    <div class="form-section">
                        <h3>H) Consent & Contact</h3>
                        
                        <div class="form-group required">
                            <label class="checkbox-label consent-label">
                                <input type="checkbox" id="consent_participation" name="consent_participation" 
                                    value="yes" required>
                                I consent to take part in today's tasks.
                            </label>
                            <div class="error-text" id="consent_participation_error"></div>
                        </div>

                        <div class="form-group">
                            <label>May We Re-contact You?</label>
                            <div class="toggle-group">
                                <label class="toggle-label">
                                    <input type="radio" name="recontact" value="no">
                                    No
                                </label>
                                <label class="toggle-label">
                                    <input type="radio" name="recontact" value="yes">
                                    Yes
                                </label>
                            </div>
                            <div class="conditional-field" id="contact_info" style="display: none;">
                                <input type="email" name="contact_email" placeholder="Email (optional)" style="margin-bottom: 8px;">
                                <input type="tel" name="contact_phone" placeholder="Phone (optional)">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button type="button" class="button-secondary" id="cancel-btn">Cancel</button>
                    <button type="submit" class="button-primary" id="submit-btn">
                        <span class="button-text">Submit</span>
                        <span class="button-loading" aria-hidden="true">Saving...</span>
                    </button>
                </div>
            </form>

            <style>
                .modal-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 24px 0;
                    border-bottom: 1px solid #e5e5e7;
                    margin-bottom: 24px;
                }

                .modal-title {
                    font-size: 20px;
                    font-weight: 600;
                    color: #1d1d1f;
                    margin: 0;
                }

                .modal-close {
                    background: none;
                    border: none;
                    padding: 8px;
                    cursor: pointer;
                    border-radius: 6px;
                    color: #6e6e73;
                    transition: all 0.2s ease;
                }

                .modal-close:hover {
                    background-color: #f5f5f7;
                    color: #1d1d1f;
                }

                .modal-body {
                    padding: 0 24px;
                    max-height: 70vh;
                    overflow-y: auto;
                }

                .form-section {
                    margin-bottom: 32px;
                }

                .form-section h3 {
                    font-size: 17px;
                    font-weight: 600;
                    color: #1d1d1f;
                    margin-bottom: 16px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #f5f5f7;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }

                .form-group {
                    margin-bottom: 16px;
                }

                .form-group.required > label:first-child::after {
                    content: ' *';
                    color: #ff3b30;
                }

                .form-group label {
                    display: block;
                    font-size: 14px;
                    font-weight: 500;
                    color: #1d1d1f;
                    margin-bottom: 8px;
                }

                .form-group input,
                .form-group select,
                .form-group textarea {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1.5px solid #d2d2d7;
                    border-radius: 8px;
                    font-size: 14px;
                    transition: border-color 0.2s ease;
                    font-family: inherit;
                }

                .form-group input:focus,
                .form-group select:focus,
                .form-group textarea:focus {
                    outline: none;
                    border-color: #007aff;
                    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
                }

                .radio-group,
                .toggle-group,
                .checkbox-group {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    margin-top: 8px;
                }

                .radio-label,
                .toggle-label,
                .checkbox-label {
                    display: flex !important;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    margin-bottom: 0 !important;
                }

                .consent-label {
                    font-weight: 500 !important;
                    color: #1d1d1f;
                    padding: 12px;
                    border: 1.5px solid #d2d2d7;
                    border-radius: 8px;
                    background: #f8f9ff;
                }

                .radio-label input,
                .toggle-label input,
                .checkbox-label input {
                    margin: 0;
                    width: auto;
                    padding: 0;
                    border: none;
                    box-shadow: none;
                }

                .conditional-field {
                    margin-top: 12px;
                    padding: 12px;
                    background: #f8f9fa;
                    border-radius: 6px;
                    border: 1px solid #e5e5e7;
                }

                .slider-group,
                .likert-group {
                    margin-top: 12px;
                }

                .slider-item,
                .likert-item {
                    margin-bottom: 16px;
                }

                .slider,
                .likert-slider {
                    width: 100%;
                    height: 6px;
                    border-radius: 3px;
                    background: #d2d2d7;
                    outline: none;
                    margin-top: 8px;
                }

                .slider::-webkit-slider-thumb,
                .likert-slider::-webkit-slider-thumb {
                    appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #007aff;
                    cursor: pointer;
                    border: 2px solid white;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
                }

                .likert-labels {
                    display: flex;
                    justify-content: space-between;
                    font-size: 12px;
                    color: #6e6e73;
                    margin-top: 4px;
                }

                .error-text {
                    font-size: 12px;
                    color: #ff3b30;
                    margin-top: 4px;
                    min-height: 16px;
                }

                .modal-footer {
                    padding: 24px;
                    border-top: 1px solid #e5e5e7;
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                }

                .button-secondary,
                .button-primary {
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    position: relative;
                    overflow: hidden;
                }

                .button-secondary {
                    background: none;
                    border: 1.5px solid #d2d2d7;
                    color: #1d1d1f;
                }

                .button-secondary:hover {
                    border-color: #007aff;
                    background-color: #f8f9ff;
                }

                .button-primary {
                    background: linear-gradient(135deg, #007aff 0%, #5856d6 100%);
                    border: none;
                    color: white;
                }

                .button-primary:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
                }

                .button-primary:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                .button-primary.loading .button-text {
                    opacity: 0;
                }

                .button-primary.loading .button-loading {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    display: block;
                }

                .button-loading {
                    display: none;
                }
            </style>
        `;
    }

    bindFormEvents() {
        const form = document.getElementById('biodata-form');
        const closeBtn = document.querySelector('.modal-close');
        const cancelBtn = document.getElementById('cancel-btn');
        const submitBtn = document.getElementById('submit-btn');

        // Close/Cancel buttons
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeModal());
        }

        // Form submission
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit(form, submitBtn);
            });
        }

        // Set up conditional field logic
        this.setupConditionalFields();
        
        // Set up slider interactions
        this.setupSliders();
        
        // Set up language percentage validation
        this.setupLanguageSliders();
    }

    setupConditionalFields() {
        // Gender self-describe
        const genderRadios = document.querySelectorAll('input[name="gender"]');
        const genderSelfDescribe = document.getElementById('gender_self_describe');
        
        genderRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'self_describe' && radio.checked) {
                    genderSelfDescribe.style.display = 'block';
                } else {
                    genderSelfDescribe.style.display = 'none';
                }
            });
        });

        // Education other
        const educationSelect = document.getElementById('education');
        const educationOther = document.getElementById('education_other');
        
        educationSelect.addEventListener('change', () => {
            if (educationSelect.value === 'other') {
                educationOther.style.display = 'block';
            } else {
                educationOther.style.display = 'none';
            }
        });

        // Primary schooling country other
        const schoolingSelect = document.getElementById('primary_schooling_country');
        const schoolingOther = document.getElementById('schooling_country_other');
        
        schoolingSelect.addEventListener('change', () => {
            if (schoolingSelect.value === 'other') {
                schoolingOther.style.display = 'block';
            } else {
                schoolingOther.style.display = 'none';
            }
        });

        // Native language other
        const nativeLanguageSelect = document.getElementById('native_language');
        const nativeLanguageOther = document.getElementById('native_language_other');
        
        nativeLanguageSelect.addEventListener('change', () => {
            if (nativeLanguageSelect.value === 'other') {
                nativeLanguageOther.style.display = 'block';
            } else {
                nativeLanguageOther.style.display = 'none';
            }
        });

        // Reading difficulties
        const readingDifficultyRadios = document.querySelectorAll('input[name="reading_difficulties"]');
        const readingDifficultyDetails = document.getElementById('reading_difficulties_details');
        
        readingDifficultyRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'yes' && radio.checked) {
                    readingDifficultyDetails.style.display = 'block';
                } else {
                    readingDifficultyDetails.style.display = 'none';
                }
            });
        });

        // Hearing test year
        const hearingTestRadios = document.querySelectorAll('input[name="hearing_test"]');
        const hearingTestYear = document.getElementById('hearing_test_year');
        
        hearingTestRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'yes' && radio.checked) {
                    hearingTestYear.style.display = 'block';
                } else {
                    hearingTestYear.style.display = 'none';
                }
            });
        });

        // Ear conditions
        const earConditionsRadios = document.querySelectorAll('input[name="ear_conditions"]');
        const earConditionsDetails = document.getElementById('ear_conditions_details');
        
        earConditionsRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'yes' && radio.checked) {
                    earConditionsDetails.style.display = 'block';
                } else {
                    earConditionsDetails.style.display = 'none';
                }
            });
        });

        // Neurological history other
        const neuroHistoryOther = document.querySelector('input[name="neuro_history"][value="other"]');
        const neuroHistoryOtherField = document.getElementById('neuro_history_other');
        
        if (neuroHistoryOther) {
            neuroHistoryOther.addEventListener('change', () => {
                if (neuroHistoryOther.checked) {
                    neuroHistoryOtherField.style.display = 'block';
                } else {
                    neuroHistoryOtherField.style.display = 'none';
                }
            });
        }

        // Current medications
        const medicationsRadios = document.querySelectorAll('input[name="current_medications"]');
        const medicationsList = document.getElementById('medications_list');
        
        medicationsRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'add_entry' && radio.checked) {
                    medicationsList.style.display = 'block';
                } else {
                    medicationsList.style.display = 'none';
                }
            });
        });

        // Drugs/nicotine details
        const drugsNicotineRadios = document.querySelectorAll('input[name="drugs_nicotine"]');
        const drugsNicotineDetails = document.getElementById('drugs_nicotine_details');
        
        drugsNicotineRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'yes' && radio.checked) {
                    drugsNicotineDetails.style.display = 'block';
                } else {
                    drugsNicotineDetails.style.display = 'none';
                }
            });
        });

        // Motor limitations
        const motorLimitationsRadios = document.querySelectorAll('input[name="motor_limitations"]');
        const motorLimitationsDetails = document.getElementById('motor_limitations_details');
        
        motorLimitationsRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'yes' && radio.checked) {
                    motorLimitationsDetails.style.display = 'block';
                } else {
                    motorLimitationsDetails.style.display = 'none';
                }
            });
        });

        // Re-contact details
        const recontactRadios = document.querySelectorAll('input[name="recontact"]');
        const contactInfo = document.getElementById('contact_info');
        
        recontactRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'yes' && radio.checked) {
                    contactInfo.style.display = 'block';
                } else {
                    contactInfo.style.display = 'none';
                }
            });
        });
    }

    setupSliders() {
        // English proficiency sliders
        const englishSpeaking = document.getElementById('english_speaking');
        const englishListening = document.getElementById('english_listening');
        const englishReading = document.getElementById('english_reading');
        
        if (englishSpeaking) {
            englishSpeaking.addEventListener('input', () => {
                document.getElementById('english_speaking_value').textContent = englishSpeaking.value;
            });
        }
        
        if (englishListening) {
            englishListening.addEventListener('input', () => {
                document.getElementById('english_listening_value').textContent = englishListening.value;
            });
        }
        
        if (englishReading) {
            englishReading.addEventListener('input', () => {
                document.getElementById('english_reading_value').textContent = englishReading.value;
            });
        }
    }

    setupLanguageSliders() {
        const l1Slider = document.getElementById('lang_l1_percent');
        const l2Slider = document.getElementById('lang_l2_percent');
        const otherSlider = document.getElementById('lang_other_percent');
        
        const l1Value = document.getElementById('lang_l1_value');
        const l2Value = document.getElementById('lang_l2_value');
        const otherValue = document.getElementById('lang_other_value');

        function updateLanguagePercentages() {
            const l1 = parseInt(l1Slider.value);
            const l2 = parseInt(l2Slider.value);
            const other = parseInt(otherSlider.value);
            const total = l1 + l2 + other;

            l1Value.textContent = l1;
            l2Value.textContent = l2;
            otherValue.textContent = other;

            // Change color if total doesn't equal 100
            const sliders = [l1Slider, l2Slider, otherSlider];
            if (total !== 100) {
                sliders.forEach(slider => {
                    slider.style.accentColor = '#ff3b30';
                });
            } else {
                sliders.forEach(slider => {
                    slider.style.accentColor = '#007aff';
                });
            }
        }

        if (l1Slider && l2Slider && otherSlider) {
            l1Slider.addEventListener('input', updateLanguagePercentages);
            l2Slider.addEventListener('input', updateLanguagePercentages);
            otherSlider.addEventListener('input', updateLanguagePercentages);
        }
    }
    async handleFormSubmit(form, submitBtn) {
        console.log('Form submitted');
        
        // Clear previous errors
        document.querySelectorAll('.error-text').forEach(el => el.textContent = '');

        let hasErrors = false;
        const errors = {};

        // Get form data
        const formData = new FormData(form);
        const data = {};
        
        // Convert FormData to regular object
        for (const [key, value] of formData.entries()) {
            if (data[key]) {
                // Handle multiple values (like checkboxes)
                if (Array.isArray(data[key])) {
                    data[key].push(value);
                } else {
                    data[key] = [data[key], value];
                }
            } else {
                data[key] = value;
            }
        }

        // Add unchecked checkboxes and radio buttons
        const checkboxes = form.querySelectorAll('input[type="checkbox"]:not(:checked)');
        checkboxes.forEach(cb => {
            if (!data[cb.name]) {
                data[cb.name] = 'no';
            }
        });

        // Validate required fields
        const requiredFields = {
            participant_id: 'Participant ID is required.',
            age: 'Age is required.',
            dominant_hand: 'Dominant hand is required.',
            gender: 'Gender is required.',
            education: 'Education level is required.',
            primary_schooling_country: 'Country of primary schooling is required.',
            native_language: 'Native language is required.',
            vision_today: 'Vision status is required.',
            color_vision: 'Color vision status is required.',
            hearing_today: 'Hearing status is required.',
            tinnitus: 'Tinnitus status is required.',
            sleep_hours: 'Sleep hours is required.',
            caffeine: 'Caffeine consumption is required.',
            consent_participation: 'Consent is required to continue.'
        };

        // Check required fields
        for (const [field, message] of Object.entries(requiredFields)) {
            if (field === 'consent_participation') {
                // Special handling for consent checkbox
                const consentCheckbox = form.querySelector('#consent_participation');
                if (!consentCheckbox.checked) {
                    errors[field] = message;
                    hasErrors = true;
                }
            } else {
                // For other fields, just check if they have any value
                if (!data[field] || data[field] === '') {
                    errors[field] = message;
                    hasErrors = true;
                }
            }
        }

        // Validate participant ID format
        if (data.participant_id && !/^[a-zA-Z0-9]{2,20}$/.test(data.participant_id)) {
            errors.participant_id = 'Participant ID must be alphanumeric, 2-20 characters.';
            hasErrors = true;
        }

        // Validate conditional fields
        if (data.gender === 'self_describe' && (!data.gender_self_describe_text || data.gender_self_describe_text.trim() === '')) {
            errors.gender = 'Please specify gender.';
            hasErrors = true;
        }

        if (data.education === 'other' && (!data.education_other_text || data.education_other_text.trim() === '')) {
            errors.education = 'Please specify education level.';
            hasErrors = true;
        }

        if (data.primary_schooling_country === 'other' && (!data.schooling_country_other_text || data.schooling_country_other_text.trim() === '')) {
            errors.primary_schooling_country = 'Please specify country.';
            hasErrors = true;
        }

        if (data.native_language === 'other' && (!data.native_language_other_text || data.native_language_other_text.trim() === '')) {
            errors.native_language = 'Please specify language.';
            hasErrors = true;
        }

        // Validate language percentages - get values directly from sliders
        const l1Slider = document.getElementById('lang_l1_percent');
        const l2Slider = document.getElementById('lang_l2_percent');
        const otherSlider = document.getElementById('lang_other_percent');

        if (l1Slider && l2Slider && otherSlider) {
            const l1Percent = parseInt(l1Slider.value) || 0;
            const l2Percent = parseInt(l2Slider.value) || 0;
            const otherPercent = parseInt(otherSlider.value) || 0;
            const totalPercent = l1Percent + l2Percent + otherPercent;

            if (totalPercent !== 100) {
                hasErrors = true;
                // Show error near the sliders
                const sliderGroup = document.querySelector('.slider-group');
                if (sliderGroup) {
                    let errorDiv = sliderGroup.querySelector('.language-error');
                    if (!errorDiv) {
                        errorDiv = document.createElement('div');
                        errorDiv.className = 'error-text language-error';
                        sliderGroup.appendChild(errorDiv);
                    }
                    errorDiv.textContent = `Language percentages must total 100%. Current total: ${totalPercent}%`;
                }
            } else {
                // Clear any existing language error
                const sliderGroup = document.querySelector('.slider-group');
                if (sliderGroup) {
                    const errorDiv = sliderGroup.querySelector('.language-error');
                    if (errorDiv) {
                        errorDiv.remove();
                    }
                }
            }
        }

        // Display errors
        for (const [field, message] of Object.entries(errors)) {
            const errorElement = document.getElementById(`${field}_error`);
            if (errorElement) {
                errorElement.textContent = message;
            }
        }

        if (hasErrors) {
            // Scroll to first error
            const firstError = document.querySelector('.error-text:not(:empty)');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        // Show loading state
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        try {
            // Simulate saving data
            await this.simulateSaveData(data.participant_id);
            
            // Success!
            this.closeModal();
            this.handleBiodataSuccess(data.participant_id, data);
            
        } catch (error) {
            console.error('Error saving biodata:', error);
            this.showToast('Failed to save biodata. Please try again.', 'error');
            
            // Reset button state
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    }

    async simulateSaveData(participantId) {
        // Get platform-specific app data directory
        const os = window.require('os');
        const path = window.require('path');
        const fs = window.require('fs').promises;
        
        let baseDir;
        if (process.platform === 'win32') {
            // Windows: %APPDATA%/Oats/sessions/
            baseDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Oats', 'sessions');
        } else if (process.platform === 'darwin') {
            // macOS: ~/Documents/Oats/sessions/
            baseDir = path.join(os.homedir(), 'Documents', 'Oats', 'sessions');
        } else {
            // Linux/other: ~/Documents/Oats/sessions/
            baseDir = path.join(os.homedir(), 'Documents', 'Oats', 'sessions');
        }
        
        // Create participant directory
        const participantDir = path.join(baseDir, participantId);
        
        try {
            // Ensure directory exists
            await fs.mkdir(participantDir, { recursive: true });
            
            // Generate biodata content
            const biodataContent = this.generateBiodataFileContent(participantId);
            
            // Save biodata.txt
            const biodataPath = path.join(participantDir, 'biodata.txt');
            await fs.writeFile(biodataPath, biodataContent, 'utf8');
            
            console.log(`Biodata saved to: ${biodataPath}`);
            return { success: true, path: biodataPath };
            
        } catch (error) {
            console.error('Error saving biodata:', error);
            throw new Error(`Failed to save biodata: ${error.message}`);
        }
    }


    generateBiodataFileContent(participantId) {
        const currentDate = new Date();
        const timestamp = currentDate.toISOString();
        const sessionDate = currentDate.toLocaleDateString();
        const startTime = currentDate.toLocaleTimeString();
        
        // Get all form data (you'll need to store this when form is submitted)
        const formData = this.currentFormData || {};
        
        let content = '';
        content += '# OATS - Participant Biodata\n';
        content += '# ==========================================\n';
        content += `# Generated: ${timestamp}\n`;
        content += `# Session Date: ${sessionDate}\n`;
        content += `# Start Time: ${startTime}\n`;
        content += '# ==========================================\n\n';

        // Session Information
        content += '[Session Information]\n';
        content += `Participant ID: ${participantId}\n`;
        content += `Session Date: ${sessionDate}\n`;
        content += `Start Time: ${startTime}\n`;
        content += `Experimenter Initials: ${formData.experimenter_initials || 'N/A'}\n\n`;

        // A) About You
        content += '[A) About You]\n';
        content += `Age: ${formData.age || 'N/A'}\n`;
        content += `Gender: ${this.formatGenderResponse(formData)}\n`;
        content += `Highest Education: ${this.formatEducationResponse(formData)}\n`;
        content += `Dominant Hand: ${formData.dominant_hand || 'N/A'}\n`;
        content += `Country of Primary Schooling: ${this.formatSchoolingCountryResponse(formData)}\n\n`;

        // B) Language & Reading
        content += '[B) Language & Reading]\n';
        content += `Native Language: ${this.formatNativeLanguageResponse(formData)}\n`;
        content += `Daily Language Use: L1=${formData.lang_l1_percent || 0}%, L2=${formData.lang_l2_percent || 0}%, Other=${formData.lang_other_percent || 0}%\n`;
        content += `Age Began Using English: ${formData.english_age_start || 'N/A'}\n`;
        content += `English Proficiency - Speaking: ${formData.english_speaking || 'N/A'}/7\n`;
        content += `English Proficiency - Listening: ${formData.english_listening || 'N/A'}/7\n`;
        content += `English Proficiency - Reading: ${formData.english_reading || 'N/A'}/7\n`;
        content += `Reading Difficulties: ${this.formatReadingDifficultiesResponse(formData)}\n`;
        content += `Hours of Reading per Week: ${formData.reading_hours_weekly || 'N/A'}\n\n`;

        // C) Vision & Color
        content += '[C) Vision & Color]\n';
        content += `Vision Today: ${formData.vision_today || 'N/A'}\n`;
        content += `Color-vision Deficiency: ${formData.color_vision || 'N/A'}\n\n`;

        // D) Hearing & Sound History
        content += '[D) Hearing & Sound History]\n';
        content += `Hearing Today: ${formData.hearing_today || 'N/A'}\n`;
        content += `Tinnitus: ${formData.tinnitus || 'N/A'}\n`;
        content += `Loud Noise in Last 24h: ${formData.loud_noise || 'N/A'}\n`;
        content += `Ever Had Hearing Test: ${this.formatHearingTestResponse(formData)}\n`;
        content += `Ear Conditions: ${this.formatEarConditionsResponse(formData)}\n\n`;

        // E) Health & Medications
        content += '[E) Health & Medications (Today)]\n';
        content += `Neurological/Psychiatric History: ${this.formatNeuroHistoryResponse(formData)}\n`;
        content += `Current Medications: ${this.formatMedicationsResponse(formData)}\n`;
        content += `Sleep Last Night: ${formData.sleep_hours || 'N/A'}\n`;
        content += `Caffeine in Last 4h: ${formData.caffeine || 'N/A'}\n`;
        content += `Alcohol in Last 24h: ${formData.alcohol || 'N/A'}\n`;
        content += `Drugs/Nicotine in Last 24h: ${this.formatDrugsNicotineResponse(formData)}\n\n`;

        // F) Music & Motor
        content += '[F) Music & Motor]\n';
        content += `Music Training (Years): ${formData.music_training || 'N/A'}\n`;
        content += `Music Practice (Hours/Week): ${formData.music_practice || 'N/A'}\n`;
        content += `Motor Limitations: ${this.formatMotorLimitationsResponse(formData)}\n\n`;

        // G) Today's Setup
        content += '[G) Today\'s Setup]\n';
        content += `Vision Correction During Tasks: ${formData.vision_correction_during_tasks || 'N/A'}\n`;
        content += `Headphones Comfortable: ${formData.headphones_comfortable || 'N/A'}\n`;
        content += `Preferred Response Hand: ${formData.preferred_response_hand || 'N/A'}\n\n`;

        // H) Consent & Contact
        content += '[H) Consent & Contact]\n';
        content += `Participation Consent: ${formData.consent_participation === 'yes' ? 'Yes' : 'No'}\n`;
        content += `May Re-contact: ${formData.recontact || 'N/A'}\n`;
        if (formData.recontact === 'yes') {
            content += `Contact Email: ${formData.contact_email || 'N/A'}\n`;
            content += `Contact Phone: ${formData.contact_phone || 'N/A'}\n`;
        }

        return content;
    }


    formatGenderResponse(formData) {
        if (formData.gender === 'self_describe') {
            return `Self-describe: ${formData.gender_self_describe_text || 'N/A'}`;
        }
        return formData.gender || 'N/A';
    }

    formatEducationResponse(formData) {
        if (formData.education === 'other') {
            return `Other: ${formData.education_other_text || 'N/A'}`;
        }
        return formData.education || 'N/A';
    }

    formatSchoolingCountryResponse(formData) {
        if (formData.primary_schooling_country === 'other') {
            return `Other: ${formData.schooling_country_other_text || 'N/A'}`;
        }
        return formData.primary_schooling_country || 'N/A';
    }

    formatNativeLanguageResponse(formData) {
        if (formData.native_language === 'other') {
            return `Other: ${formData.native_language_other_text || 'N/A'}`;
        }
        return formData.native_language || 'N/A';
    }

    formatReadingDifficultiesResponse(formData) {
        if (formData.reading_difficulties === 'yes') {
            return `Yes: ${formData.reading_difficulties_text || 'N/A'}`;
        }
        return formData.reading_difficulties || 'N/A';
    }

    formatHearingTestResponse(formData) {
        if (formData.hearing_test === 'yes') {
            return `Yes (${formData.hearing_test_year_value || 'Year not specified'})`;
        }
        return formData.hearing_test || 'N/A';
    }

    formatEarConditionsResponse(formData) {
        if (formData.ear_conditions === 'yes') {
            return `Yes: ${formData.ear_conditions_text || 'N/A'}`;
        }
        return formData.ear_conditions || 'N/A';
    }

    formatNeuroHistoryResponse(formData) {
        if (Array.isArray(formData.neuro_history)) {
            let response = formData.neuro_history.join(', ');
            if (formData.neuro_history.includes('other') && formData.neuro_history_other_text) {
                response += ` (Other: ${formData.neuro_history_other_text})`;
            }
            return response || 'None';
        }
        return formData.neuro_history || 'None';
    }

    formatMedicationsResponse(formData) {
        if (formData.current_medications === 'add_entry') {
            let response = formData.medication_type || 'Unspecified';
            if (formData.medication_other_text) {
                response += ` (${formData.medication_other_text})`;
            }
            return response;
        }
        return formData.current_medications || 'None';
    }

    formatDrugsNicotineResponse(formData) {
        if (formData.drugs_nicotine === 'yes') {
            return `Yes: ${formData.drugs_nicotine_text || 'N/A'}`;
        }
        return formData.drugs_nicotine || 'N/A';
    }

    formatMotorLimitationsResponse(formData) {
        if (formData.motor_limitations === 'yes') {
            return `Yes: ${formData.motor_limitations_text || 'N/A'}`;
        }
        return formData.motor_limitations || 'N/A';
    }    

    handleBiodataSuccess(participantId, formData) {
        // Update subject display
        const subjectDisplay = document.getElementById('subject-display');
        if (subjectDisplay) {
            subjectDisplay.textContent = participantId;
            subjectDisplay.classList.remove('empty');
        }

        // Update stepper
        this.updateStepState(1, 'completed');
        this.updateStepState(2, 'current');

        // Enable task dropdown
        const taskDropdown = document.getElementById('task-dropdown');
        if (taskDropdown) {
            taskDropdown.disabled = false;
            setTimeout(() => taskDropdown.focus(), 100);
        }

        // Show success message
        this.showToast(`Participant information saved for ${participantId}.`, 'success');
        
        this.currentSubject = participantId;
        this.currentState = 'form_completed';
        this.currentFormData = formData; // Store form data for potential later use
    }

    async handleRunTaskClick() {
        if (!this.selectedTask) return;

        const runTaskBtn = document.getElementById('run-task-btn');
        
        // Show loading state
        runTaskBtn.classList.add('loading');
        runTaskBtn.disabled = true;

        try {
            // Simulate task execution
            console.log(`Running task: ${this.selectedTask} for subject: ${this.currentSubject}`);
            
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second simulation
            
            // Task completed
            runTaskBtn.classList.remove('loading');
            runTaskBtn.disabled = false;
            
            this.showToast(`Task "${this.selectedTask}" completed successfully`, 'success');
            
        } catch (error) {
            console.error('Task execution error:', error);
            
            runTaskBtn.classList.remove('loading');
            runTaskBtn.disabled = false;
            
            this.showToast(`Task failed: ${error.message}`, 'error');
        }
    }

    updateStepState(stepNumber, state) {
        const stepElement = document.querySelector(`[data-step="${stepNumber}"]`);
        if (!stepElement) return;

        const circle = stepElement.querySelector('.step-circle');
        const connector = stepElement.querySelector('.step-connector');

        // Remove all state classes
        circle.classList.remove('inactive', 'current', 'completed');
        
        // Add new state class
        circle.classList.add(state);

        // Update connectors for completed steps
        if (connector) {
            if (state === 'completed') {
                connector.classList.add('completed');
            } else {
                connector.classList.remove('completed');
            }
        }
    }

    closeModal() {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.remove('open');
            modalOverlay.setAttribute('aria-hidden', 'true');
            
            setTimeout(() => {
                const modalContent = modalOverlay.querySelector('.modal-content');
                modalContent.innerHTML = '';
            }, 300);
        }
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        toastContainer.appendChild(toast);
        this.toasts.add(toast);

        // Show animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto-hide after 4 seconds
        setTimeout(() => {
            this.hideToast(toast);
        }, 4000);
    }

    hideToast(toast) {
        if (this.toasts.has(toast)) {
            toast.classList.remove('show');
            
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
                this.toasts.delete(toast);
            }, 300);
        }
    }
}

// Add this function to your existing dashboard.js
function connectTaskIntegration() {
    const runTaskBtn = document.getElementById('run-task-btn');
    
    if (runTaskBtn) {
        // Override the existing click handler
        runTaskBtn.addEventListener('click', async function() {
            const taskDropdown = document.getElementById('task-dropdown');
            const selectedTask = taskDropdown ? taskDropdown.value : null;
            
            if (!selectedTask) {
                alert('Please select a task first');
                return;
            }
            
            if (selectedTask === 'speeded-classification') {
                // Get participant ID
                const participantId = getParticipantId();
                
                if (!participantId) {
                    alert('Please complete the pre-task survey first');
                    return;
                }
                
                // Call the integration function
                if (window.loadSpeededClassificationTask) {
                    await window.loadSpeededClassificationTask(participantId);
                } else {
                    alert('Task integration not loaded');
                }
            } else if (selectedTask === 'auditory-stroop') {
                // Get participant ID
                const participantId = getParticipantId();
                
                if (!participantId) {
                    alert('Please complete the pre-task survey first');
                    return;
                }
                
                // Call the auditory stroop integration function
                if (window.loadAuditoryStroopTask) {
                    await window.loadAuditoryStroopTask(participantId);
                } else {
                    alert('Auditory Stroop task integration not loaded');
                }
            } else if (selectedTask === 'stroop-color-word') {
                // Get participant ID
                const participantId = getParticipantId();
                
                if (!participantId) {
                    alert('Please complete the pre-task survey first');
                    return;
                }
                
                // Call the stroop color-word integration function
                if (window.loadStroopColorWordTask) {
                    await window.loadStroopColorWordTask(participantId);
                } else {
                    alert('Stroop Color-Word task integration not loaded');
                }
            } else if (selectedTask === 'cvc') {
                // Get participant ID
                const participantId = getParticipantId();
                
                if (!participantId) {
                    alert('Please complete the pre-task survey first');
                    return;
                }
                
                // Call the CVC integration function
                if (window.loadCVCTask) {
                    await window.loadCVCTask(participantId);
                } else {
                    alert('CVC task integration not loaded');
                }
            } else if (selectedTask === 'reading-span') {
                // Get participant ID
                const participantId = getParticipantId();
                
                if (!participantId) {
                    alert('Please complete the pre-task survey first');
                    return;
                }
                
                // Call the Reading Span integration function
                if (window.loadReadingSpanTask) {
                    await window.loadReadingSpanTask(participantId);
                } else {
                    alert('Reading Span task integration not loaded');
                }
            } else if (selectedTask === 'hint-practice') {
                // Get participant ID
                const participantId = getParticipantId();
                
                if (!participantId) {
                    alert('Please complete the pre-task survey first');
                    return;
                }
                
                // Call the Practice Sentence integration function
                if (window.loadPracticeSentenceTask) {
                    await window.loadPracticeSentenceTask(participantId);
                } else {
                    alert('Practice Sentence task integration not loaded');
                }
            } else if (selectedTask === 'cast-practice') {
                // Get participant ID
                const participantId = getParticipantId();
                
                if (!participantId) {
                    alert('Please complete the pre-task survey first');
                    return;
                }
                
                // Call the Practice CaST integration function
                if (window.loadPracticeCastTask) {
                    await window.loadPracticeCastTask(participantId);
                } else {
                    alert('Practice CaST task integration not loaded');
                }
            } else if (selectedTask === 'cst') {
                // Get participant ID
                const participantId = getParticipantId();
                
                if (!participantId) {
                    alert('Please complete the pre-task survey first');
                    return;
                }
                
                // Call the CST integration function
                if (window.loadCSTTask) {
                    await window.loadCSTTask(participantId);
                } else {
                    alert('CST task integration not loaded');
                }
            } else if (selectedTask === 'hint') {
                // Get participant ID
                const participantId = getParticipantId();
                
                if (!participantId) {
                    alert('Please complete the pre-task survey first');
                    return;
                }
                
                // Call the HINT integration function
                if (window.loadHINTTask) {
                    await window.loadHINTTask(participantId);
                } else {
                    alert('HINT task integration not loaded');
                }
            } else if (selectedTask === 'cast-word') {
                // Get participant ID
                const participantId = getParticipantId();
                
                if (!participantId) {
                    alert('Please complete the pre-task survey first');
                    return;
                }
                
                // Call the CaST Word integration function
                if (window.loadCaSTWordTask) {
                    await window.loadCaSTWordTask(participantId);
                } else {
                    alert('CaST Word task integration not loaded');
                }
            } else if (selectedTask === 'cast-nonword') {
                // Get participant ID
                const participantId = getParticipantId();
                
                if (!participantId) {
                    alert('Please complete the pre-task survey first');
                    return;
                }
                
                // Call the CaST Non-word integration function
                if (window.loadCaSTNonwordTask) {
                    await window.loadCaSTNonwordTask(participantId);
                } else {
                    alert('CaST Non-word task integration not loaded');
                }
            }
        });
    }
}


function getParticipantId() {
    // Get from subject display
    const subjectDisplay = document.getElementById('subject-display');
    if (subjectDisplay && subjectDisplay.textContent !== '**Subject ID**') {
        return subjectDisplay.textContent;
    }
    return 'test_participant'; // fallback
}

// COMBINE INTO ONE DOMContentLoaded LISTENER
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing dashboard...');
    
    // Initialize the dashboard first
    window.dashboard = new Dashboard();
    
    // Then connect task integration after a short delay
    setTimeout(connectTaskIntegration, 500);
    
    console.log('Dashboard.js loaded, task integration will be connected in 500ms');
});