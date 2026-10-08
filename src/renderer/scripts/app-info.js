// APP VERSION
//
// The version Windows shows under Installed apps (set by the development
// build, see README "Versions and releases"), for the dashboard and for
// every results file, so each dataset says which build produced it.
//   oatsAppInfo.version()  "1.0.3"
//   oatsAppInfo.line()     "OATS 1.0.3 (Brodbeck Lab)", or "... run from source"

(function () {
    function remoteApp() {
        try {
            return window.require('@electron/remote').app;
        } catch (error) {
            return null;
        }
    }

    window.oatsAppInfo = {
        publisher: 'Brodbeck Lab',
        version() {
            const app = remoteApp();
            return app ? app.getVersion() : 'unknown';
        },
        isInstalled() {
            const app = remoteApp();
            return !!(app && app.isPackaged);
        },
        line() {
            return `OATS ${this.version()} (${this.publisher}${this.isInstalled() ? '' : ', run from source'})`;
        }
    };
})();
