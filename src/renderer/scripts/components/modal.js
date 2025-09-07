import { AccessibilityManager } from '../utils/accessibility.js';

// Modal component
export class ModalManager {
    constructor() {
        this.overlay = document.getElementById('modal-overlay');
        this.content = this.overlay.querySelector('.modal-content');
        this.isOpen = false;
        this.previousFocus = null;
        this.removeFocusTrap = null;
        
        this.bindEvents();
    }

    bindEvents() {
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (this.isOpen && e.key === 'Escape') {
                this.close();
            }
        });
    }

    open(content, options = {}) {
        if (this.isOpen) return;

        this.previousFocus = document.activeElement;
        this.content.innerHTML = content;
        
        this.overlay.setAttribute('aria-hidden', 'false');
        this.overlay.classList.add('open');
        this.isOpen = true;

        // Set up focus trap
        this.removeFocusTrap = AccessibilityManager.trapFocus(this.content);

        // Announce modal opening
        if (options.title) {
            AccessibilityManager.announce(`${options.title} dialog opened`);
        }
    }

    close(returnFocus = true) {
        if (!this.isOpen) return;

        this.overlay.classList.remove('open');
        this.overlay.setAttribute('aria-hidden', 'true');
        this.isOpen = false;

        // Remove focus trap
        if (this.removeFocusTrap) {
            this.removeFocusTrap();
            this.removeFocusTrap = null;
        }

        // Return focus
        if (returnFocus && this.previousFocus) {
            setTimeout(() => {
                this.previousFocus.focus();
            }, 300);
        }

        setTimeout(() => {
            this.content.innerHTML = '';
        }, 300);
    }

    isModalOpen() {
        return this.isOpen;
    }
}