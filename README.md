# OATS - Offline Assessment Task Suite

## Setup Instructions

1. **Install Node.js** (if not already installed)
   - Download from https://nodejs.org/
   - Choose the LTS version

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the application**
   ```bash
   npm start
   ```

4. **Development mode**
   ```bash
   npm run dev
   ```


## Project Structure

```
oats-app/
├── package.json              # Project configuration and dependencies
├── main.js                   # Main Electron process
├── src/
│   ├── config/
│   │   └── settings.js       # Configuration settings (font sizes, colors, etc.)
│   └── renderer/
│       ├── pages/
│       │   ├── loading.html  # Loading screen
│       │   └── dashboard.html # Main dashboard
│       ├── styles/
│       │   ├── loading.css   # Loading screen styles
│       │   └── dashboard.css # Dashboard styles
│       └── scripts/
│           ├── loading.js    # Loading screen logic
│           └── dashboard.js  # Dashboard logic
```


## Customizing Font Sizes

Edit the `src/config/settings.js` file to adjust font sizes:

```javascript
fonts: {
    titleSize: '4rem',        // OATS title font size
    subtitleSize: '1.2rem',   // Subtitle font size
    bodySize: '1rem'          // Body text font size
}
```


## ASIO Audio Support (Windows)

On Windows, OATS plays stimuli and records responses through the audio
interface's ASIO driver (e.g. Focusrite), with selectable output/input
channels and a shared sample clock for precise reaction times. Configure it
from the **AUDIO** badge on the dashboard. If ASIO is unavailable the app
falls back to Web Audio / sox and says so in every results file. See
[docs/asio-support.md](docs/asio-support.md).


## Error Logs

Every run of the app writes runtime errors — renderer exceptions, unhandled
promise rejections, main-process crashes, and anything reported via
`console.error` in the task code — to a daily log file, so a bug can be
diagnosed without DevTools having been open at the time. It's always under
`Documents/Oats/logs/app-error-YYYY-MM-DD.log`, on every platform including
Windows, so it's somewhere easy to find rather than a hidden system folder.

This is separate from the developer-mode activity log described in
[developer_mode.md](developer_mode.md).


## Building for Distribution

- **Windows**: `npm run build-win`
- **macOS**: `npm run build-mac`
- **Linux**: `npm run build-linux`
- **All platforms**: `npm run build`


## Next Steps

The dashboard is ready for additional features. You can:
1. Add new sections to the dashboard
2. Implement assessment tools
3. Add data management features
4. Customize the UI further

The modular structure makes it easy to add new functionality without affecting existing code.


## Common Branch Types (Prefixes)

- **feature/**: For developing new features or functionality.
- **bugfix/ or fix/**: For fixing issues, often associated with a bug report.
- **hotfix/**: For urgent, critical fixes that need to go directly to production.
- **release/**: For preparing a new production release (e.g., release/v1.0.0).
- **chore/ or docs/**: For maintenance tasks, documentation updates, or dependency updates.
- **experiment/ or test/**: For testing ideas without affecting the main codebase.
- **obsolete/**: For branches no longer in use. 
