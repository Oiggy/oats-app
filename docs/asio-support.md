# ASIO Audio Support (Windows)

OATS can optionally route stimulus playback and microphone recording through
an [ASIO](https://en.wikipedia.org/wiki/Audio_Stream_Input/Output) audio
interface instead of the OS's normal audio path. ASIO is Steinberg's
low-latency, low-overhead audio I/O API, used by professional audio
interfaces on Windows. This matters for OATS specifically because several
tasks (Reading Span, Stroop Color-Word) time participant speech onset
relative to stimulus playback, and several others play speech-in-noise
stimuli where output timing/quality matters — ASIO's lower, more consistent
latency than the default OS audio mixer can improve the accuracy of those
measurements when a supported interface is available.

Support is built on
[node-audio-asio](https://github.com/distopik/node-audio-asio), a thin
native Node addon around the ASIO SDK.

## Important limitations

- **Windows only.** ASIO does not exist on macOS or Linux; on those
  platforms (and on Windows without the setup below) OATS behaves exactly as
  it did before this feature existed — stimuli play through the Web Audio
  API and the microphone records through `sox`/`node-record-lpcm16`.
- **node-audio-asio is alpha-quality, proof-of-concept software.** It is not
  published on npm, and it is not something `npm install` can fully set up
  for you: because the Steinberg ASIO SDK cannot be redistributed, you must
  download it yourself, extract it into the `node-audio-asio` package
  directory, and rebuild the native addon before it will load. Follow that
  project's own README for the current steps. It's listed as an
  `optionalDependency` here specifically so that `npm install` doesn't fail
  for everyone else when that native build isn't possible or hasn't been
  done yet.
- **Same sample rate as the stimulus audio.** This integration does not
  resample. Every WAV asset shipped with OATS is 44.1kHz, 16-bit, mono, so
  `cfg_audio_asio.json`'s `sampleRate` should stay at `44100` unless you
  also replace the stimulus files. A mismatch plays audio at the wrong
  pitch/speed rather than failing outright — watch the console for the
  warning this integration logs when it detects one.
- **Not verified against real ASIO hardware.** This integration was written
  directly against node-audio-asio's documented API and this project's own
  existing audio code, but it has not been exercised end-to-end on Windows
  with a physical ASIO interface. Treat it as a starting point and validate
  it against your specific audio hardware before relying on it for data
  collection.

## Enabling it

1. Set up `node-audio-asio` per its README (SDK download, `npm link`,
   rebuild). Confirm `require('node-audio-asio')` works from a plain Node
   REPL on the target machine before wiring it into OATS.
2. Create (or edit) `cfg_audio_asio.json` in OATS's shared task-configuration
   directory — the same folder every other `cfg_*_task.json` file already
   lives in:
   - Windows: `%APPDATA%\Oats\task-configurations\cfg_audio_asio.json`
3. Set `"enabled": true` and point `driver` at the exact name of your ASIO
   driver, as shown in your audio interface's control panel (e.g. the
   bundled ASIO4ALL driver identifies itself as `"ASIO4ALL v2"`).

Example `cfg_audio_asio.json`:

```json
{
  "enabled": true,
  "driver": "ASIO4ALL v2",
  "sampleRate": 44100,
  "bitsPerSample": 24,
  "samplesPerBlock": 256,
  "endianess": "little",
  "inputChannels": [0],
  "outputChannels": [0, 1]
}
```

All fields are optional; anything omitted falls back to the defaults shown
above. Leaving `enabled` as `false` (or leaving the file out entirely) keeps
OATS on its existing Web Audio / sox behavior — nothing about the app
changes unless a technician deliberately opts in.

## What's wired up

- `src/shared/audio/asio-engine.js` — the shared engine. It owns a single,
  persistent ASIO stream (ASIO drivers are meant to be opened once and kept
  running, not opened per sound) and exposes `playFile()`,
  `startCapture()`/`stopCaptureToFile()`, and `clearOutputQueue()`. It's
  loaded the same way the rest of the app loads task-local native modules —
  via `window.require(path.join(appPath, ...))` — so it works both in `npm
  start` and in a packaged build.
- `src/renderer/tasks/reading_span/native_audio_recorder.js` and
  `src/renderer/tasks/stroop_color_word/native_audio_recorder.js` — try the
  ASIO engine first for microphone capture when it's enabled and available,
  and fall back to the existing sox-based recorder otherwise. The public API
  (`preloadMicrophone`, `startRecording`, `startRecordingWithPreciseTiming`,
  `stopRecording`, `testAudio`) is unchanged, so nothing else in those tasks
  needed to change.
- Every task that plays WAV stimuli through the Web Audio API
  (`auditory_stroop`, `speeded_classification`, and the SIN battery:
  `cast_word`, `cast_nonword`, `cst`, `hint`, `practice_cast`,
  `practice_sentence`) now checks for an enabled ASIO engine before falling
  back to their existing `AudioContext`-based playback.

## Why the Web Audio path can't just be "pointed at" ASIO

Modern browsers do support a `setSinkId()`/`{sinkId}` mechanism for routing
Web Audio output to a specific device, but that only works with devices the
OS audio mixer already exposes (WASAPI on Windows). ASIO drivers
deliberately bypass that OS mixer for lower latency, so an ASIO device never
shows up as a selectable Web Audio sink — the only way to reach it is
through a native addon like node-audio-asio, which is why playback and
recording go through a completely separate code path when ASIO is enabled,
rather than reusing the existing `AudioContext` graph.
