// Loading Screen Script
class LoadingScreen {
    constructor() {
        this.settings = null;
        this.init();
    }

    async init() {
        // Load settings (in a real app, you might load this from a config file)
        this.settings = {
            fonts: {
                titleSize: '4rem',
                subtitleSize: '1.2rem'
            },
            loading: {
                duration: 3000,
                spinnerSize: '40px'
            }
        };

        this.applySettings();
        this.startLoadingSequence();
    }

    applySettings() {
        // Apply font sizes from settings
        const root = document.documentElement;
        root.style.setProperty('--title-size', this.settings.fonts.titleSize);
        root.style.setProperty('--subtitle-size', this.settings.fonts.subtitleSize);
        root.style.setProperty('--spinner-size', this.settings.loading.spinnerSize);
    }

    startLoadingSequence() {
        // Add any additional loading animations or progress tracking here
        console.log('OATS Loading...');
        
        // You can add progress updates here
        this.updateProgress();
    }

    updateProgress() {
        // Simulate loading progress
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            console.log(`Loading progress: ${progress}%`);
            
            if (progress >= 100) {
                clearInterval(interval);
                console.log('Loading complete!');
                
                // Notify main process that loading is complete
                if (typeof require !== 'undefined') {
                    const { ipcRenderer } = require('electron');
                    ipcRenderer.send('loading-complete');
                }
            }
        }, this.settings.loading.duration / 10);
    }
}

// Initialize loading screen when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new LoadingScreen();
});