// File management service
export class FileManager {
    constructor() {
        this.fs = window.fs || window.require?.('fs').promises;
        this.path = window.path || window.require?.('path');
    }

    async saveSubjectData(subjectId, biodataFormData) {
        try {
            // Create subjects directory structure
            const subjectsDir = this.path.join(process.cwd(), 'Subjects');
            const subjectDir = this.path.join(subjectsDir, subjectId);
            
            // Ensure directories exist
            await this.ensureDirectoryExists(subjectsDir);
            await this.ensureDirectoryExists(subjectDir);

            // Generate biodata content
            const biodataContent = this.generateBiodataContent(biodataFormData);
            const biodataPath = this.path.join(subjectDir, 'biodata.txt');

            // Atomic write using temp file
            const tempPath = `${biodataPath}.tmp`;
            await this.fs.writeFile(tempPath, biodataContent, 'utf8');
            await this.fs.rename(tempPath, biodataPath);

            return {
                success: true,
                path: biodataPath
            };
        } catch (error) {
            console.error('Error saving subject data:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async ensureDirectoryExists(dirPath) {
        try {
            await this.fs.access(dirPath);
        } catch {
            await this.fs.mkdir(dirPath, { recursive: true });
        }
    }

    generateBiodataContent(formData) {
        const timestamp = new Date().toISOString();
        const appVersion = '1.0.0'; // You can get this from package.json
        
        let content = '';
        content += '# OATS Biodata File\n';
        content += `# Generated: ${timestamp}\n`;
        content += `# App Version: ${appVersion}\n`;
        content += '# ==========================================\n\n';

        // Subject Information
        content += '[Subject Information]\n';
        content += `Subject ID: ${formData.subject_id || ''}\n`;
        content += `Age: ${formData.age || ''}\n`;
        content += `Sex at Birth: ${formData.sex || ''}\n`;
        content += `Gender: ${formData.gender || ''}\n`;
        content += `Handedness: ${formData.handedness || ''}\n\n`;

        // Language, Hearing & Vision
        content += '[Language, Hearing & Vision]\n';
        content += `Native Language: ${formData.native_language || ''}\n`;
        content += `Other Languages: ${formData.other_languages || ''}\n`;
        content += `Hearing Status: ${formData.hearing_status || ''}\n`;
        content += `Vision Correction: ${formData.vision_correction || ''}\n\n`;

        // Health & Screening
        content += '[Health & Screening]\n';
        content += `Neurological/Psychiatric History: ${formData.neuro_history || 'None'}\n`;
        content += `Head Injury History: ${formData.head_injury || 'None'}\n`;
        content += `Current Medications: ${formData.medications || 'None'}\n\n`;

        // Session Context
        content += '[Session Context]\n';
        content += `Sleep Last Night (Hours): ${formData.sleep_hours || ''}\n`;
        content += `Caffeine in Past 6h: ${formData.caffeine === 'yes' ? 'Yes' : 'No'}\n`;
        content += `Alcohol in Past 24h: ${formData.alcohol === 'yes' ? 'Yes' : 'No'}\n`;
        content += `Smoking in Past 24h: ${formData.smoking === 'yes' ? 'Yes' : 'No'}\n\n`;

        // Safety Flags
        content += '[Safety Flags]\n';
        content += `Metal Implants/Pacemaker: ${formData.metal_implants === 'yes' ? 'Yes' : 'No'}\n`;
        content += `Pregnancy: ${formData.pregnancy === 'yes' ? 'Yes' : 'No'}\n`;
        content += `Claustrophobia: ${formData.claustrophobia === 'yes' ? 'Yes' : 'No'}\n\n`;

        // Consent
        content += '[Consent]\n';
        content += `Participation Consent: ${formData.consent_participation === 'yes' ? 'Yes' : 'No'}\n`;
        content += `Data Storage Consent: ${formData.consent_data === 'yes' ? 'Yes' : 'No'}\n\n`;

        // Additional Notes
        if (formData.notes && formData.notes.trim()) {
            content += '[Additional Notes]\n';
            content += `${formData.notes.trim()}\n\n`;
        }

        return content;
    }

    async loadSubjectData(subjectId) {
        try {
            const subjectDir = this.path.join(process.cwd(), 'Subjects', subjectId);
            const biodataPath = this.path.join(subjectDir, 'biodata.txt');
            
            const content = await this.fs.readFile(biodataPath, 'utf8');
            return {
                success: true,
                content,
                path: biodataPath
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async listSubjects() {
        try {
            const subjectsDir = this.path.join(process.cwd(), 'Subjects');
            const subjects = await this.fs.readdir(subjectsDir);
            
            // Filter to only include directories with biodata.txt
            const validSubjects = [];
            for (const subject of subjects) {
                const subjectDir = this.path.join(subjectsDir, subject);
                const biodataPath = this.path.join(subjectDir, 'biodata.txt');
                
                try {
                    await this.fs.access(biodataPath);
                    validSubjects.push(subject);
                } catch {
                    // Skip if biodata.txt doesn't exist
                }
            }
            
            return {
                success: true,
                subjects: validSubjects
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                subjects: []
            };
        }
    }
}