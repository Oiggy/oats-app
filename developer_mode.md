# Developer Mode

Developer Mode is a local convenience for quick testing, not a security
feature — there's no password. Clicking the badge just asks for a name and
turns it on.

## Usage

1. Click the "DEV" badge in the top-right corner of the dashboard

2. Enter your name and click "Enable"

3. Developer Mode will be activated:
   - Badge turns red and shows your name
   - Biodata form is automatically filled when clicking "Pre-task Survey"
   - Quick testing workflow enabled

4. Click the badge again to exit Developer Mode

## Logging

Developer Mode activity (who turned it on/off, and for how long) is logged
to `Documents/Oats/dev-mode-logs/dev-mode-YYYY-MM-DD.log`, on every platform
including Windows — the same easy-to-find `Documents/Oats` folder used for
the app's error log (see the README's "Error Logs" section) and everything
else it saves locally.

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
