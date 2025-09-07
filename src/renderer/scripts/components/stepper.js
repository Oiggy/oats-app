import { AccessibilityManager } from '../utils/accessibility.js';
import { STEP_STATES } from '../utils/constants.js';

// Stepper component
export class StepperManager {
    constructor() {
        this.steps = {
            1: { element: document.querySelector('[data-step="1"]'), state: STEP_STATES.CURRENT },
            2: { element: document.querySelector('[data-step="2"]'), state: STEP_STATES.INACTIVE }
        };
        
        this.initialize();
    }

    initialize() {
        // Set initial states
        this.updateStep(1, STEP_STATES.CURRENT);
        this.updateStep(2, STEP_STATES.INACTIVE);
    }

    updateStep(stepNumber, state) {
        const step = this.steps[stepNumber];
        if (!step) return;

        step.state = state;
        const indicator = step.element.querySelector('.step-indicator');
        const circle = indicator.querySelector('.step-circle');
        const connector = step.element.querySelector('.step-connector');

        // Remove all state classes
        circle.classList.remove('inactive', 'current', 'completed');
        
        // Add new state class
        circle.classList.add(state);

        // Update connector for step 1
        if (stepNumber === 1 && connector) {
            if (state === STEP_STATES.COMPLETED) {
                connector.classList.add('completed');
            } else {
                connector.classList.remove('completed');
            }
        }

        // Update accessibility
        this.updateStepAccessibility(stepNumber, state);
    }

    updateStepAccessibility(stepNumber, state) {
        const step = this.steps[stepNumber];
        const stepNames = {
            1: 'Fill Biodata Form',
            2: 'Select a task'
        };

        let statusText = '';
        let ariaLabel = '';

        switch (state) {
            case STEP_STATES.INACTIVE:
                statusText = 'Not started';
                ariaLabel = `${stepNames[stepNumber]} — Not started`;
                break;
            case STEP_STATES.CURRENT:
                statusText = 'Current step';
                ariaLabel = `${stepNames[stepNumber]} — Current step`;
                step.element.setAttribute('aria-current', 'step');
                break;
            case STEP_STATES.COMPLETED:
                statusText = 'Completed';
                ariaLabel = `${stepNames[stepNumber]} — Completed`;
                step.element.removeAttribute('aria-current');
                break;
        }

        // Update step status for screen readers
        AccessibilityManager.updateStepStatus(stepNumber, statusText, stepNames[stepNumber]);
        
        // Update indicator accessibility
        const indicator = step.element.querySelector('.step-indicator');
        indicator.setAttribute('aria-label', ariaLabel);
    }

    completeStep(stepNumber) {
        this.updateStep(stepNumber, STEP_STATES.COMPLETED);
        
        // Update next step to current if it exists
        if (this.steps[stepNumber + 1]) {
            this.updateStep(stepNumber + 1, STEP_STATES.CURRENT);
        }
    }

    getStepState(stepNumber) {
        return this.steps[stepNumber]?.state || STEP_STATES.INACTIVE;
    }
}