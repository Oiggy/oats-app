// Integration script for loading the Speeded Classification Task into the main dashboard

class TaskIntegration {
    static async loadSpeededClassificationTask(participantId) {
        try {
            // Store participant ID for the task
            if (window.sessionStorage) {
                window.sessionStorage.setItem('currentParticipantId', participantId);
            }
            
            // Load the task panel HTML
            const taskPanelPath = '../tasks/speeded_classification/task-panel.html';
            const response = await fetch(taskPanelPath);
            
            if (!response.ok) {
                throw new Error(`Failed to load task panel: ${response.status} - ${response.statusText}`);
            }
            
            const html = await response.text();
            
            // Replace the main dashboard content
            const mainContent = document.querySelector('.main-content') || document.querySelector('.dashboard-container');
            if (mainContent) {
                mainContent.innerHTML = html;
                
                // CORRECTED CSS PATH - this was the problem!
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = '../tasks/speeded_classification/task-panel.css';
                link.onload = () => console.log('CSS loaded successfully');
                link.onerror = () => console.error('Failed to load CSS');
                document.head.appendChild(link);
                
                // Load and initialize task controller
                const script = document.createElement('script');
                script.src = '../tasks/speeded_classification/task-controller.js';
                script.onload = () => {
                    console.log('Task controller loaded successfully');
                };
                script.onerror = (error) => {
                    console.error('Failed to load task controller:', error);
                };
                document.head.appendChild(script);
                
                return true;
            } else {
                throw new Error('Could not find main content area');
            }
            
        } catch (error) {
            console.error('Failed to load Speeded Classification Task:', error);
            alert('Failed to load the Speeded Classification Task: ' + error.message);
            return false;
        }
    }
    
    static returnToDashboard() {
        // Reload the main dashboard
        if (window.location.reload) {
            window.location.reload();
        } else {
            // Fallback: redirect to dashboard
            window.location.href = './dashboard.html';
        }
    }
}

// Make integration functions available globally
window.loadSpeededClassificationTask = TaskIntegration.loadSpeededClassificationTask;
window.returnToDashboard = TaskIntegration.returnToDashboard;