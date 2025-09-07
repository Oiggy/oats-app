// Toast notification component
export class ToastManager {
    constructor() {
        this.container = document.getElementById('toast-container');
        this.toasts = new Set();
    }

    show(message, type = 'success', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');

        this.container.appendChild(toast);
        this.toasts.add(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto-hide
        setTimeout(() => {
            this.hide(toast);
        }, duration);

        return toast;
    }

    hide(toast) {
        if (this.toasts.has(toast)) {
            toast.classList.remove('show');
            
            setTimeout(() => {
                if (toast.parentNode) {
                    this.container.removeChild(toast);
                }
                this.toasts.delete(toast);
            }, 300);
        }
    }

    clear() {
        this.toasts.forEach(toast => this.hide(toast));
    }
}