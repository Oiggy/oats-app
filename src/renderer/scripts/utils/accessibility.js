// Accessibility utilities
export class AccessibilityManager {
    static announce(message, priority = 'polite') {
        const announcer = document.createElement('div');
        announcer.setAttribute('aria-live', priority);
        announcer.setAttribute('aria-atomic', 'true');
        announcer.style.position = 'absolute';
        announcer.style.left = '-9999px';
        announcer.style.width = '1px';
        announcer.style.height = '1px';
        announcer.style.overflow = 'hidden';
        
        document.body.appendChild(announcer);
        announcer.textContent = message;
        
        setTimeout(() => {
            document.body.removeChild(announcer);
        }, 1000);
    }

    static trapFocus(element) {
        const focusableElements = element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        const handleTabKey = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        e.preventDefault();
                    }
                }
            }
        };

        element.addEventListener('keydown', handleTabKey);
        firstElement?.focus();

        return () => {
            element.removeEventListener('keydown', handleTabKey);
        };
    }

    static updateStepStatus(stepNumber, status, label) {
        const statusElement = document.getElementById(`step-${stepNumber}-status`);
        if (statusElement) {
            statusElement.textContent = `${label} — ${status}`;
        }
    }
}