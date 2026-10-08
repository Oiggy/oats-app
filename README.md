# OATS - Offline Assessment Task Suite

A Windows desktop app (Electron) for running cognitive and listening tasks
offline, published by **Brodbeck Lab**. Stimuli play, and spoken responses
are recorded, through an ASIO audio interface (e.g. Focusrite Scarlett) for
sample-accurate timing.

## Tasks

| Task | What the participant does | Saved as |
| --- | --- | --- |
| Stroop Colour Word | Names the ink colour of colour words aloud | `stroopcolorwordtask_<run start>` |
| CVC | Presses SPACE when the last three letters form a real C–V–C word | `cvctask_<run start>` |
| Reading Span | Reads sentences, then recalls the final words aloud | `readingspantask_<run start>` |
| Speeded Classification | Classifies spoken words by first sound or by voice | `speededclassificationtask_<run start>` |
| Auditory Stroop | Judges the speaker's sex, ignoring the word's meaning | `auditorystrooptask_<run start>` |
| Speech in Noise: Nonwords | Repeats nonwords heard in noise (scored by the tester) | `speechinnoisenonwordstask_<run start>` |
| Speech in Noise: Words | Repeats words heard in noise | `speechinnoisewordstask_<run start>` |
| Speech in Noise: HINT | Repeats sentences heard in noise | `speechinnoisehinttask_<run start>` |
| Speech in Noise: CST | Repeats connected-speech sentences heard in noise | `speechinnoisecsttask_<run start>` |

Speech-in-Noise practice is built into each Speech-in-Noise task (Practice
button on its menu).

## Using the app

1. **Pre-task Survey**: enter the participant's details. The survey is
   paged by section (tabs across the top, Back/Next at the bottom); Submit
   checks every section and opens the first one with a problem.
2. **Select a task**, then **Task Configuration**: review the settings and
   save them.
3. **Run the task**. Listening tasks have a **Test Audio** button on their
   first screen: it beeps on each output chosen in Audio Setup, plays a
   sample, and says whether ASIO is working. The result is written to the
   results file.

Pop-ups (confirmations, messages) are drawn inside the app. The layout is
compact so every screen fits a laptop window without scrolling.

The bottom-right corner of the dashboard shows the app version and
publisher, e.g. `OATS v1.0.3 · Brodbeck Lab`.

## Audio (ASIO)

Click **AUDIO** at the top right of the dashboard to choose the ASIO device,
sample rate, buffer size, the **output channels** stimuli play on, and the
**input channel** responses are recorded from. Every task uses these
settings. The badge reads **AUDIO: ASIO** in green while ASIO is running.

- If the interface is unplugged, tasks carry on with Windows audio and the
  results files say so; it reconnects automatically when plugged back in.
- When the laptop sleeps, the app releases the interface and reconnects
  after wake.
- Reaction times are measured from word onset.

Details: [docs/asio-support.md](docs/asio-support.md).

## Where data is saved

On Windows, everything is under `%APPDATA%\Oats` (elsewhere `~/Documents/Oats`):

```
Oats/
├── participants/<participant ID>/       real participants
│   ├── biodata.txt                      pre-task survey
│   ├── <taskname>task_<YYYY-MM-DD_HH-MM-SS-mmmZ>/
│   │   ├── results.txt                  readable summary (+ app version, audio backend, Test Audio result)
│   │   ├── trials.csv                   trial-level data (where the task has trials)
│   │   └── recordings / *.wav           spoken responses (tasks that record)
│   └── speechinnoise_summary.csv        per-SNR scores across the Speech-in-Noise tasks
├── sessions/<DEV_...>/                  Developer Mode runs (same layout)
├── task-configurations/                 saved task settings
└── stimulus-levels.csv                  stimulus level log
```

Every `results.txt` (and `biodata.txt`) records the app version that wrote
it, e.g. `App Version: OATS 1.0.3 (Brodbeck Lab)`.

Every task run gets one folder named `<full task name>task_<run start time>`,
for example `auditorystrooptask_2026-10-08_13-55-21-514Z`.

Error logs: `Documents/Oats/logs/app-error-YYYY-MM-DD.log` (all platforms).
Developer Mode activity: see [developer_mode.md](developer_mode.md).

## Versions and releases

Versions come from builds of the **development** branch:

- Every build of `development` is a new version, one patch higher than the
  last (1.0.0, 1.0.1, 1.0.2, ...). `development` builds automatically on
  every push (merge), and can also be built by hand. The commit is tagged
  `vX.Y.Z` and a GitHub Release with the installer is published under
  **Releases**.
- To start a new minor or major version, raise `"version"` in
  `package.json` on `development` (e.g. to `1.1.0`); the next development
  build uses it, and later builds count up from there.
- Builds of any other branch are test builds, labelled after the next
  version with the branch and run number (e.g.
  `1.0.3-feature-x.12`). They are not tagged or released.

The version appears in the app (dashboard, bottom right), in the installer
name (`OATS Setup 1.0.3.exe`), and in Windows **Settings > Apps > Installed
apps** / **Programs and Features**, with **Brodbeck Lab** as the publisher.

To build any branch by hand: GitHub > **Actions** > **Build Windows Installer
(Any Branch)** > **Run workflow**, pick the branch. The installer is attached
to the run (and, for `development`, to the release).

## Running from source

1. Install Node.js (LTS) from https://nodejs.org/
2. `npm install`
3. `npm start` (or `npm run dev`)

Running from source shows the version as `(dev)`. ASIO needs Windows and the
interface's ASIO driver (for Focusrite: Focusrite Control 2).

Local builds: `npm run build-win` (Windows), `npm run build-mac`,
`npm run build-linux`, `npm run build` (all).

## Project structure

```
oats-app/
├── main.js                      Electron main process (window, sleep/wake events)
├── package.json                 version, publisher (author), build settings
├── .github/workflows/           Windows installer build + versioning
├── docs/asio-support.md
├── developer_mode.md
└── src/
    ├── config/settings.js       loading-screen fonts, colours, timing
    ├── renderer/
    │   ├── pages/               dashboard.html, loading.html
    │   ├── scripts/             dashboard.js, dialogs.js (in-app pop-ups), ...
    │   ├── styles/              dashboard.css, compact.css (compact layout, loaded last)
    │   └── tasks/               one folder per task (sin/ holds the Speech-in-Noise tasks)
    └── shared/
        ├── audio/               ASIO engine, Test Audio check, recorder, stimulus levels
        ├── logging/             error log
        └── storage/             participant folders and run-folder names
```

## Branches

- **development**: integration branch; building it makes a new version.
- **feature/**: new features or functionality.
- **bugfix/ or fix/**: fixes, often for a bug report.
- **hotfix/**: urgent fixes.
- **release/**: preparing a release (e.g. release/v1.0.0).
- **chore/ or docs/**: maintenance, documentation, dependency updates.
- **experiment/ or test/**: trying ideas without affecting the main code.
- **obsolete/**: branches no longer in use, kept for reference.
