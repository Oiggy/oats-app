// Application constants
export const APP_STATES = {
    IDLE: 'idle',
    FORM_OPEN: 'form_open',
    FORM_COMPLETED: 'form_completed',
    TASK_SELECTED: 'task_selected',
    READY_TO_RUN: 'ready_to_run',
    RUNNING: 'running',
    DONE: 'done',
    FAILED: 'failed'
};

export const STEP_STATES = {
    INACTIVE: 'inactive',
    CURRENT: 'current',
    COMPLETED: 'completed'
};

export const TOAST_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    INFO: 'info'
};

export const BIODATA_FIELDS = {
    SUBJECT_ID: 'subject_id',
    AGE: 'age',
    SEX: 'sex',
    GENDER: 'gender',
    HANDEDNESS: 'handedness',
    NATIVE_LANGUAGE: 'native_language',
    OTHER_LANGUAGES: 'other_languages',
    HEARING_STATUS: 'hearing_status',
    VISION_CORRECTION: 'vision_correction',
    NEURO_HISTORY: 'neuro_history',
    HEAD_INJURY: 'head_injury',
    MEDICATIONS: 'medications',
    SLEEP_HOURS: 'sleep_hours',
    CAFFEINE: 'caffeine',
    ALCOHOL: 'alcohol',
    SMOKING: 'smoking',
    METAL_IMPLANTS: 'metal_implants',
    PREGNANCY: 'pregnancy',
    CLAUSTROPHOBIA: 'claustrophobia',
    CONSENT_PARTICIPATION: 'consent_participation',
    CONSENT_DATA: 'consent_data',
    NOTES: 'notes'
};

export const ERROR_MESSAGES = {
    SAVE_FAILED: 'Failed to save biodata. Please try again.',
    INVALID_SUBJECT_ID: 'Subject ID must be alphanumeric and 3-20 characters long.',
    REQUIRED_FIELD: 'This field is required.',
    INVALID_AGE: 'Please enter a valid age between 18 and 100.',
    CONSENT_REQUIRED: 'Both consent checkboxes must be checked to continue.'
};

export const SUCCESS_MESSAGES = {
    BIODATA_SAVED: 'Biodata saved for {subjectId}.',
    FORM_COMPLETED: 'Biodata form completed. Select a task.',
    TASK_SELECTED: 'Task selected: {taskName}. Run the task is now enabled.'
};