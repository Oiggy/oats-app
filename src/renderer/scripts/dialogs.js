// IN-APP DIALOGS
//
// Replaces the browser's alert() / confirm() (which show as Windows system
// pop-ups) with dialogs drawn in the app's own style:
//   await oatsDialog.alert('Saved.', { title: 'Results' });
//   if (await oatsDialog.confirm('Exit the task?', { okText: 'Exit', danger: true })) { ... }
// Enter = OK, Escape = Cancel. While a dialog is open, key presses don't
// reach the task underneath (e.g. Space in CVC, M/F in Auditory Stroop).

(function () {
    const queue = [];
    let open = null;

    function injectStyles() {
        if (document.getElementById('oats-dialog-styles')) return;
        const style = document.createElement('style');
        style.id = 'oats-dialog-styles';
        style.textContent = `
            .oats-dialog-overlay { position: fixed; inset: 0; z-index: 30000; display: flex; align-items: center; justify-content: center;
                background: rgba(0, 0, 0, 0.35); backdrop-filter: blur(2px); animation: oats-dialog-fade 0.12s ease-out; }
            .oats-dialog { width: min(420px, calc(100vw - 32px)); background: #fff; border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,0.25);
                padding: 18px 20px 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1d1d1f;
                animation: oats-dialog-pop 0.14s ease-out; }
            .oats-dialog-title { font-size: 15px; font-weight: 600; margin: 0 0 6px; }
            .oats-dialog-message { font-size: 13px; line-height: 1.45; color: #3a3a3c; white-space: pre-line; max-height: 50vh; overflow-y: auto; }
            .oats-dialog-buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
            .oats-dialog-buttons button { min-width: 84px; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer;
                border: 1px solid #d2d2d7; background: #fff; color: #1d1d1f; }
            .oats-dialog-buttons button:hover { background: #f5f5f7; }
            .oats-dialog-buttons .oats-dialog-ok { background: #007aff; border-color: #007aff; color: #fff; }
            .oats-dialog-buttons .oats-dialog-ok:hover { background: #0066d6; }
            .oats-dialog-buttons .oats-dialog-ok.danger { background: #ff3b30; border-color: #ff3b30; }
            .oats-dialog-buttons .oats-dialog-ok.danger:hover { background: #e0352b; }
            @keyframes oats-dialog-fade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes oats-dialog-pop { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        `;
        document.head.appendChild(style);
    }

    function escapeHtml(text) {
        return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function show(next) {
        injectStyles();
        open = next;
        const overlay = document.createElement('div');
        overlay.className = 'oats-dialog-overlay';
        overlay.innerHTML = `
            <div class="oats-dialog" role="${next.kind === 'confirm' ? 'alertdialog' : 'dialog'}" aria-modal="true">
                ${next.title ? `<div class="oats-dialog-title">${escapeHtml(next.title)}</div>` : ''}
                <div class="oats-dialog-message">${escapeHtml(next.message)}</div>
                <div class="oats-dialog-buttons">
                    ${next.kind === 'confirm' ? `<button type="button" class="oats-dialog-cancel">${escapeHtml(next.cancelText)}</button>` : ''}
                    <button type="button" class="oats-dialog-ok ${next.danger ? 'danger' : ''}">${escapeHtml(next.okText)}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const previousFocus = document.activeElement;

        const close = (result) => {
            window.removeEventListener('keydown', onKey, true);
            overlay.remove();
            open = null;
            if (previousFocus && previousFocus.focus && document.contains(previousFocus)) previousFocus.focus();
            next.resolve(result);
            if (queue.length) show(queue.shift());
        };
        // Captured before any task listener: the task never sees these keys
        const onKey = (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); close(true); } else if (e.key === 'Escape') { e.preventDefault(); close(next.kind === 'confirm' ? false : true); }
        };
        window.addEventListener('keydown', onKey, true);
        overlay.querySelector('.oats-dialog-ok').addEventListener('click', () => close(true));
        const cancel = overlay.querySelector('.oats-dialog-cancel');
        if (cancel) cancel.addEventListener('click', () => close(false));
        overlay.querySelector('.oats-dialog-ok').focus();
    }

    function request(kind, message, options = {}) {
        return new Promise((resolve) => {
            const item = {
                kind,
                message: message == null ? '' : String(message),
                title: options.title || (kind === 'confirm' ? 'Please confirm' : ''),
                okText: options.okText || 'OK',
                cancelText: options.cancelText || 'Cancel',
                danger: !!options.danger,
                resolve
            };
            if (open) queue.push(item); else show(item);
        });
    }

    window.oatsDialog = {
        alert: (message, options) => request('alert', message, options),
        confirm: (message, options) => request('confirm', message, options)
    };

    // Anything that still calls alert() gets the in-app dialog too
    window.alert = (message) => { window.oatsDialog.alert(message); };
})();
