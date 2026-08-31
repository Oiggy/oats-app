# Developer Mode

## Setup

No terminal or npm command needed — it's set up directly in the app:

1. Click the "DEV" badge in the top-right corner of the dashboard.
2. The first time, since no password has been set yet, you'll see a
   **"Set Up Developer Mode"** screen instead of a login form. Enter and
   confirm a password (minimum 6 characters) and submit.
3. This writes `src/config/dev-credentials.js` for you, and takes you
   straight to the login screen to finish signing in.

Forgot the password later, or just want to change it? Open the DEV badge's
login screen and click **"Forgot password? Reset it"** — it takes you back
to the same setup screen, and submitting it overwrites the existing password.

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

(Separately, runtime errors — including anything that goes wrong while
Developer Mode is on — are logged to `Oats/logs/app-error-YYYY-MM-DD.log`;
see the README's "Error Logs" section.)

## Security Notes

- **Never commit `dev-credentials.js` to git**
- The file is automatically added to `.gitignore`
- Password is stored in plaintext locally (for development convenience)
- Change your password any time via the "Forgot password? Reset it" link
  described above

## Building for Production

For production builds, ensure `dev-credentials.js` exists with the production
password (set it up once via the in-app flow above on the machine you build
from).

The build process will include this file in the packaged application.
