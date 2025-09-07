import { BIODATA_FIELDS, ERROR_MESSAGES } from '../utils/constants.js';

// Biodata form component
export class BiodataForm {
    constructor(onSubmit, onCancel) {
        this.onSubmit = onSubmit;
        this.onCancel = onCancel;
        this.formData = {};
        this.validationErrors = {};
    }

    generateFormHTML() {
        return `
            <form id="biodata-form" novalidate>
                <div class="modal-header">
                    <h2 class="modal-title">Biodata Form</h2>
                    <button type="button" class="modal-close" aria-label="Close form">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L10 9.293l4.646-4.647a.5.5 0 0 1 .708.708L10.707 10l4.647 4.646a.5.5 0 0 1-.708.708L10 10.707l-4.646 4.647a.5.5 0 0 1-.708-.708L9.293 10 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                        </svg>
                    </button>
                </div>

                <div class="modal-body">
                    <div class="form-section">
                        <h3>Subject Information</h3>
                        
                        <div class="form-group required">
                            <label for="subject_id">Subject ID</label>
                            <input type="text" id="subject_id" name="subject_id" required 
                                   pattern="^[a-zA-Z0-9]{3,20}$"
                                   aria-describedby="subject_id_help subject_id_error">
                            <div class="help-text" id="subject_id_help">
                                Alphanumeric, 3-20 characters. Used for file naming.
                            </div>
                            <div class="error-text" id="subject_id_error" aria-live="polite"></div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Participant Basics</h3>
                        
                        <div class="form-row">
                            <div class="form-group required">
                                <label for="age">Age</label>
                                <input type="number" id="age" name="age" min="18" max="100" required
                                       aria-describedby="age_error">
                                <div class="error-text" id="age_error" aria-live="polite"></div>
                            </div>
                            
                            <div class="form-group required">
                                <label for="sex">Sex at Birth</label>
                                <select id="sex" name="sex" required aria-describedby="sex_error">
                                    <option value="">Select...</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="intersex">Intersex</option>
                                    <option value="prefer_not_to_say">Prefer not to say</option>
                                </select>
                                <div class="error-text" id="sex_error" aria-live="polite"></div>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="gender">Gender (Self-Report)</label>
                                <select id="gender" name="gender">
                                    <option value="">Select...</option>
                                    <option value="man">Man</option>
                                    <option value="woman">Woman</option>
                                    <option value="non_binary">Non-binary</option>
                                    <option value="other">Other</option>
                                    <option value="prefer_not_to_say">Prefer not to say</option>
                                </select>
                            </div>
                            
                            <div class="form-group required">
                                <label for="handedness">Handedness</label>
                                <select id="handedness" name="handedness" required aria-describedby="handedness_error">
                                    <option value="">Select...</option>
                                    <option value="right">Right</option>
                                    <option value="left">Left</option>
                                    <option value="ambidextrous">Ambidextrous</option>
                                </select>
                                <div class="error-text" id="handedness_error" aria-live="polite"></div>
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Language, Hearing & Vision</h3>
                        
                        <div class="form-group required">
                            <label for="native_language">Native Language</label>
                            <input type="text" id="native_language" name="native_language" required
                                   aria-describedby="native_language_error">
                            <div class="error-text" id="native_language_error" aria-live="polite"></div>
                        </div>
                        
                        <div class="form-group">
                            <label for="other_languages">Other Languages</label>
                            <input type="text" id="other_languages" name="other_languages"
                                   placeholder="Separate multiple languages with commas">
                        </div>

                        <div class="form-row">
                            <div class="form-group required">
                                <label for="hearing_status">Hearing Status</label>
                                <select id="hearing_status" name="hearing_status" required 
                                        aria-describedby="hearing_status_error">
                                    <option value="">Select...</option>
                                    <option value="normal">Normal</option>
                                    <option value="hearing_aid">Hearing aid</option>
                                    <option value="cochlear_implant">Cochlear implant</option>
                                    <option value="other">Other</option>
                                </select>
                                <div class="error-text" id="hearing_status_error" aria-live="polite"></div>
                            </div>
                            
                            <div class="form-group required">
                                <label for="vision_correction">Vision Correction</label>
                                <select id="vision_correction" name="vision_correction" required
                                        aria-describedby="vision_correction_error">
                                    <option value="">Select...</option>
                                    <option value="none">None</option>
                                    <option value="glasses">Glasses</option>
                                    <option value="contacts">Contact lenses</option>
                                    <option value="both">Glasses and contacts</option>
                                </select>
                                <div class="error-text" id="vision_correction_error" aria-live="polite"></div>
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Health & Screening</h3>
                        
                        <div class="form-group">
                            <label for="neuro_history">Neurological/Psychiatric History</label>
                            <textarea id="neuro_history" name="neuro_history" rows="2"
                                      placeholder="Any relevant history or 'None'"></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="head_injury">Head Injury History</label>
                            <textarea id="head_injury" name="head_injury" rows="2"
                                      placeholder="Any head injuries or 'None'"></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="medications">Current Medications</label>
                            <textarea id="medications" name="medications" rows="2"
                                      placeholder="List current medications or 'None'"></textarea>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Session Context</h3>
                        
                        <div class="form-row">
                            <div class="form-group required">
                                <label for="sleep_hours">Sleep Last Night (Hours)</label>
                                <input type="number" id="sleep_hours" name="sleep_hours" 
                                       min="0" max="24" step="0.5" required
                                       aria-describedby="sleep_hours_error">
                                <div class="error-text" id="sleep_hours_error" aria-live="polite"></div>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="caffeine" name="caffeine" value="yes">
                                    Caffeine in past 6 hours
                                </label>
                            </div>
                            
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="alcohol" name="alcohol" value="yes">
                                    Alcohol in past 24 hours
                                </label>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="smoking" name="smoking" value="yes">
                                Smoking in past 24 hours
                            </label>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Safety Flags <span class="optional">(Optional - for future EEG/fMRI sessions)</span></h3>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="metal_implants" name="metal_implants" value="yes">
                                Metal implants/pacemaker
                            </label>
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="pregnancy" name="pregnancy" value="yes">
                                Pregnancy
                            </label>
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="claustrophobia" name="claustrophobia" value="yes">
                                Claustrophobia
                            </label>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Consent</h3>
                        
                        <div class="form-group required">
                            <label class="checkbox-label">
                                <input type="checkbox" id="consent_participation" name="consent_participation" 
                                       value="yes" required aria-describedby="consent_participation_error">
                                I consent to participate in this research study and understand I can withdraw at any time.
                            </label>
                            <div class="error-text" id="consent_participation_error" aria-live="polite"></div>
                        </div>
                        
                        <div class="form-group required">
                            <label class="checkbox-label">
                                <input type="checkbox" id="consent_data" name="consent_data" 
                                       value="yes" required aria-describedby="consent_data_error">
                                I consent to the collection and storage of my data for research purposes.
                            </label>
                            <div class="error-text" id="consent_data_error" aria-live="polite"></div>
                        </div>
                    </div>

                    <div class="form-section">
                        <div class="form-group">
                            <label for="notes">Additional Notes</label>
                            <textarea id="notes" name="notes" rows="3"
                                      placeholder="Any additional notes or comments"></textarea>
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
                    max-height: 60vh;
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

                .form-group.required label::after {
                    content: ' *';
                    color: #ff3b30;
                }

                .form-group label {
                    display: block;
                    font-size: 14px;
                    font-weight: 500;
                    color: #1d1d1f;
                    margin-bottom: 6px;
                }

                .checkbox-label {
                    display: flex !important;
                    align-items: flex-start;
                    gap: 8px;
                    cursor: pointer;
                    line-height: 1.4;
                }

                .checkbox-label input[type="checkbox"] {
                    margin: 2px 0 0 0;
                    flex-shrink: 0;
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

                .form-group input:invalid:not(:focus),
                .form-group select:invalid:not(:focus) {
                    border-color: #ff3b30;
                }

                .help-text {
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

                .optional {
                    font-weight: 400;
                    color: #6e6e73;
                    font-size: 14px;
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
                    padding: 10px 20px;
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

    bindEvents(container) {
        const form = container.querySelector('#biodata-form');
        const closeBtn = container.querySelector('.modal-close');
        const cancelBtn = container.querySelector('#cancel-btn');
        const submitBtn = container.querySelector('#submit-btn');

        // Close button
        closeBtn.addEventListener('click', () => {
            this.onCancel();
        });

        // Cancel button
        cancelBtn.addEventListener('click', () => {
            this.onCancel();
        });

        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit(form, submitBtn);
        });

        // Real-time validation
        form.querySelectorAll('input, select, textarea').forEach(field => {
            field.addEventListener('blur', () => {
                this.validateField(field);
            });
            
            field.addEventListener('input', () => {
                this.clearFieldError(field);
            });
        });
    }

    validateField(field) {
        const value = field.type === 'checkbox' ? field.checked : field.value.trim();
        const fieldName = field.name;
        const errorElement = document.getElementById(`${fieldName}_error`);

        let isValid = true;
        let errorMessage = '';

        // Required field validation
        if (field.hasAttribute('required')) {
            if (field.type === 'checkbox' && !field.checked) {
                isValid = false;
                errorMessage = ERROR_MESSAGES.REQUIRED_FIELD;
            } else if (field.type !== 'checkbox' && !value) {
                isValid = false;
                errorMessage = ERROR_MESSAGES.REQUIRED_FIELD;
            }
        }

        // Specific field validations
        if (value && isValid) {
            switch (fieldName) {
                case 'subject_id':
                    if (!/^[a-zA-Z0-9]{3,20}$/.test(value)) {
                        isValid = false;
                        errorMessage = ERROR_MESSAGES.INVALID_SUBJECT_ID;
                    }
                    break;
                case 'age':
                    const age = parseInt(value);
                    if (isNaN(age) || age < 18 || age > 100) {
                        isValid = false;
                        errorMessage = ERROR_MESSAGES.INVALID_AGE;
                    }
                    break;
            }
        }

        // Update error display
        if (errorElement) {
            errorElement.textContent = errorMessage;
        }

        // Update field appearance
        if (isValid) {
            field.classList.remove('error');
        } else {
            field.classList.add('error');
        }

        return isValid;
    }

    clearFieldError(field) {
        const errorElement = document.getElementById(`${field.name}_error`);
        if (errorElement) {
            errorElement.textContent = '';
        }
        field.classList.remove('error');
    }

    validateForm(form) {
        const fields = form.querySelectorAll('input, select, textarea');
        let isValid = true;

        fields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });

        // Special validation for consent checkboxes
        const consentParticipation = form.querySelector('#consent_participation');
        const consentData = form.querySelector('#consent_data');
        
        if (!consentParticipation.checked || !consentData.checked) {
            isValid = false;
            if (!consentParticipation.checked) {
                document.getElementById('consent_participation_error').textContent = ERROR_MESSAGES.CONSENT_REQUIRED;
            }
            if (!consentData.checked) {
                document.getElementById('consent_data_error').textContent = ERROR_MESSAGES.CONSENT_REQUIRED;
            }
        }

        return isValid;
    }

    collectFormData(form) {
        const formData = new FormData(form);
        const data = {};

        // Collect regular fields
        for (const [key, value] of formData.entries()) {
            data[key] = value;
        }

        // Handle checkboxes that weren't checked
        const checkboxes = form.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            if (!checkbox.checked) {
                data[checkbox.name] = 'no';
            }
        });

        return data;
    }

    async handleSubmit(form, submitBtn) {
        if (!this.validateForm(form)) {
            return;
        }

        // Show loading state
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        try {
            const formData = this.collectFormData(form);
            await this.onSubmit(formData);
        } catch (error) {
            console.error('Form submission error:', error);
            
            // Show error state
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
            
            // You could show an error message here
        }
    }
}