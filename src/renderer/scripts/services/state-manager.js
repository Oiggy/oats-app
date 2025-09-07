import { APP_STATES } from '../utils/constants.js';
import { AccessibilityManager } from '../utils/accessibility.js';

// Application state management
export class StateManager {
    constructor() {
        this.currentState = APP_STATES.IDLE;
        this.currentSubject = null;
        this.selectedTask = null;
        this.listeners = new Map();
        
        this.initialize();
    }

    initialize() {
        this.setState(APP_STATES.IDLE);
    }

    setState(newState, data = {}) {
        const previousState = this.currentState;
        this.currentState = newState;

        console.log(`State transition: ${previousState} → ${newState}`);

        // Update UI based on state
        this.updateUI(newState, data);

        // Notify listeners
        this.notifyListeners(newState, previousState, data);
    }

    updateUI(state, data = {}) {
        const biodataBtn = document.getElementById('biodata-btn');
        const taskDropdown = document.getElementById('task-dropdown');
        const runTaskBtn = document.getElementById('run-task-btn');
        const subjectDisplay = document.getElementById('subject-display');

        switch (state) {
            case APP_STATES.IDLE:
                // Initial state
                biodataBtn.disabled = false;
                taskDropdown.disabled = true;
                runTaskBtn.disabled = true;
                subjectDisplay.textContent = '**Subject ID**';
                subjectDisplay.classList.add('empty');
                break;

            case APP_STATES.FORM_OPEN:
                // Form is being opened
                biodataBtn.classList.add('loading');
                biodataBtn.disabled = true;
                break;

            case APP_STATES.FORM_COMPLETED:
                // Form completed successfully
                biodataBtn.classList.remove('loading');
                biodataBtn.disabled = false;
                taskDropdown.disabled = false;
                runTaskBtn.disabled = true;
                
                if (data.subjectId) {
                    this.currentSubject = data.subjectId;
                    subjectDisplay.textContent = data.subjectId;
                    subjectDisplay.classList.remove('empty');
                }

                // Focus on task dropdown
                setTimeout(() => {
                    taskDropdown.focus();
                    AccessibilityManager.announce('Biodata form completed. Select a task.');
                }, 100);
                break;

            case APP_STATES.TASK_SELECTED:
                // Task has been selected
                runTaskBtn.disabled = false;
                this.selectedTask = data.taskName;
                
                AccessibilityManager.announce(
                    `Task selected: ${data.taskName}. Run the task is now enabled.`
                );
                break;

            case APP_STATES.READY_TO_RUN:
                // Ready to run the task
                runTaskBtn.disabled = false;
                break;

            case APP_STATES.RUNNING:
                // Task is running
                runTaskBtn.classList.add('loading');
                runTaskBtn.disabled = true;
                biodataBtn.disabled = true;
                taskDropdown.disabled = true;
                break;

            case APP_STATES.DONE:
                // Task completed
                runTaskBtn.classList.remove('loading');
                runTaskBtn.disabled = false;
                biodataBtn.disabled = false;
                taskDropdown.disabled = false;
                break;

            case APP_STATES.FAILED:
                // Task failed
                runTaskBtn.classList.remove('loading');
                runTaskBtn.disabled = false;
                biodataBtn.disabled = false;
                taskDropdown.disabled = false;
                break;
        }
    }

    getState() {
        return this.currentState;
    }

    getCurrentSubject() {
        return this.currentSubject;
    }

    getSelectedTask() {
        return this.selectedTask;
    }

    canTransitionTo(targetState) {
        const transitions = {
            [APP_STATES.IDLE]: [APP_STATES.FORM_OPEN],
            [APP_STATES.FORM_OPEN]: [APP_STATES.FORM_COMPLETED, APP_STATES.IDLE],
            [APP_STATES.FORM_COMPLETED]: [APP_STATES.TASK_SELECTED, APP_STATES.FORM_OPEN],
            [APP_STATES.TASK_SELECTED]: [APP_STATES.READY_TO_RUN, APP_STATES.RUNNING, APP_STATES.FORM_OPEN],
            [APP_STATES.READY_TO_RUN]: [APP_STATES.RUNNING, APP_STATES.FORM_OPEN],
            [APP_STATES.RUNNING]: [APP_STATES.DONE, APP_STATES.FAILED],
            [APP_STATES.DONE]: [APP_STATES.FORM_OPEN, APP_STATES.TASK_SELECTED, APP_STATES.RUNNING],
            [APP_STATES.FAILED]: [APP_STATES.FORM_OPEN, APP_STATES.TASK_SELECTED, APP_STATES.RUNNING]
        };

        return transitions[this.currentState]?.includes(targetState) || false;
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    notifyListeners(newState, previousState, data) {
        const eventName = `state:${newState}`;
        if (this.listeners.has(eventName)) {
            this.listeners.get(eventName).forEach(callback => {
                try {
                    callback({ newState, previousState, data });
                } catch (error) {
                    console.error('Error in state listener:', error);
                }
            });
        }

        // Also notify general state change listeners
        if (this.listeners.has('stateChange')) {
            this.listeners.get('stateChange').forEach(callback => {
                try {
                    callback({ newState, previousState, data });
                } catch (error) {
                    console.error('Error in state change listener:', error);
                }
            });
        }
    }

    reset() {
        this.currentSubject = null;
        this.selectedTask = null;
        this.setState(APP_STATES.IDLE);
    }
}