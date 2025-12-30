#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const configDir = path.join(__dirname, 'src', 'config');
const credentialsFile = path.join(configDir, 'dev-credentials.js');
const templateFile = path.join(configDir, 'dev-credentials.template.js');

console.log('\n====================================');
console.log('  OATS Developer Mode Setup');
console.log('====================================\n');

// Check if dev-credentials.js already exists
if (fs.existsSync(credentialsFile)) {
    rl.question('⚠️  dev-credentials.js already exists. Overwrite? (y/N): ', (answer) => {
        if (answer.toLowerCase() === 'y') {
            setupCredentials();
        } else {
            console.log('\n✓ Setup cancelled. Existing credentials preserved.\n');
            rl.close();
        }
    });
} else {
    setupCredentials();
}

function setupCredentials() {
    rl.question('\nEnter a secure password for Developer Mode: ', (password) => {
        if (!password || password.trim().length < 6) {
            console.log('\n❌ Password must be at least 6 characters long.\n');
            rl.close();
            return;
        }

        const credentialsContent = `// Developer Mode Credentials
// DO NOT COMMIT THIS FILE TO GIT
// Add this file to .gitignore

module.exports = {
    DEV_PASSWORD: '${password.trim()}'
};
`;

        try {
            // Create config directory if it doesn't exist
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            // Write credentials file
            fs.writeFileSync(credentialsFile, credentialsContent, 'utf8');

            console.log('\n✓ Developer Mode credentials created successfully!');
            console.log(`  File: ${credentialsFile}`);
            console.log('\n⚠️  IMPORTANT: Do not commit dev-credentials.js to git!');
            console.log('   Make sure it is listed in .gitignore\n');
            
            // Check if .gitignore includes the file
            const gitignorePath = path.join(__dirname, '.gitignore');
            if (fs.existsSync(gitignorePath)) {
                const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
                if (!gitignoreContent.includes('dev-credentials.js')) {
                    console.log('⚠️  Adding dev-credentials.js to .gitignore...\n');
                    fs.appendFileSync(gitignorePath, '\n# Developer credentials\nsrc/config/dev-credentials.js\n');
                }
            }
        } catch (error) {
            console.error('\n❌ Error creating credentials file:', error.message, '\n');
        }

        rl.close();
    });
}