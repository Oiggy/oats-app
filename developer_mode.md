# Developer Mode

## Setup

1. Run the setup script to create your developer credentials:
```bash
   npm run setup-dev
```

2. Enter a secure password when prompted (minimum 6 characters)

3. The script will create `src/config/dev-credentials.js` with your password

## Usage

1. Click the "DEV" badge in the top-right corner of the dashboard

2. Enter your developer name and password

3. Developer Mode will be activated:
   - Badge turns red and shows your name
   - Biodata form is automatically filled when clicking "Pre-task Survey"
   - Quick testing workflow enabled

4. Click the badge again to exit Developer Mode

## Logging

Developer Mode activity is logged to:
- **Windows**: `%APPDATA%/Roaming/Oats/dev-mode-logs/`
- **macOS/Linux**: `~/Documents/Oats/dev-mode-logs/`

Log files are named: `dev-mode-YYYY-MM-DD.log`

Each log entry includes:
- Timestamp
- Action (ENTER/EXIT)
- Developer name
- Session duration (for EXIT events)

Example log:
```
[2024-12-30T10:15:23.456Z] ENTER - John Doe
[2024-12-30T10:45:12.789Z] EXIT - John Doe (Duration: 29m 49s)
```

## Security Notes

- **Never commit `dev-credentials.js` to git**
- The file is automatically added to `.gitignore`
- Password is stored in plaintext locally (for development convenience)
- Change your password regularly by running `npm run setup-dev` again

## Building for Production

For production builds, ensure `dev-credentials.js` exists with the production password.

The build process will include this file in the packaged application.