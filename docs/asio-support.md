# ASIO Audio (Windows)

On Windows, OATS plays every stimulus and records every microphone response
through the audio interface's ASIO driver (e.g. Focusrite). This gives:

- **Channel control** — choose which interface outputs stimuli go to and which
  input is recorded, globally or per task.
- **Low, fixed latency** — audio bypasses the Windows mixer.
- **One clock for stimulus and recording** — playback and recording run in a
  single full-duplex stream, so the position of a stimulus inside a recording
  is known to the sample. This is what reaction times are measured against.

The engine is `src/shared/audio/asio-engine.js`, built on
[audify](https://github.com/almoghamdani/audify) (Node bindings for RtAudio).
audify ships prebuilt Windows binaries with ASIO support compiled in, so a
normal `npm ci` / installer build includes it — no Steinberg SDK step.

## Setting up a machine

1. Install the interface's driver (Focusrite: **Focusrite Control**) and
   connect the interface.
2. Open OATS and click the **AUDIO** badge (top right).
3. Pick the ASIO device, sample rate, buffer size, the **stimulus output
   channels** (stimuli play on every ticked output) and the **recording input
   channel**.
4. Click **Test output** and **Test input**, then **Save & Apply**. The badge
   turns green and reads **AUDIO: ASIO** when the stream is running.

Settings are saved to `cfg_audio_asio.json` in the task-configurations
folder (`%APPDATA%\Oats\task-configurations` on Windows). By default the
first device whose name contains "Focusrite" is used, at 48 kHz with a
128-sample buffer, outputs 1+2 and input 1.

### Per-task output channels

A task can send its stimuli to different outputs than the global setting by
adding `output_channels` (1-based) to the `audio` section of its config file,
e.g. `"audio": { "volume": 1.0, "output_channels": [3, 4] }`. Supported by
Auditory Stroop, Speeded Classification and all Speech-in-Noise tasks. There
is no UI for this yet: Speech-in-Noise tasks keep the setting when their
configuration is re-saved, but Auditory Stroop and Speeded Classification
rebuild their config from the form and drop it, falling back to the global
channels.

## What each task uses ASIO for

| Task | Playback | Recording | Timing recorded |
|---|---|---|---|
| Stroop Colour Word | — (visual) | ASIO input | Recording start from the stream clock; `stimulus_offset` in results |
| Reading Span | — | ASIO input | — (recall recordings, no RT measured) |
| Auditory Stroop | ASIO | — | RT from the stimulus's actual end time to the click's event timestamp |
| Speeded Classification | ASIO | — | Same as Auditory Stroop |
| SIN: Words, Nonwords, HINT, CST | ASIO | ASIO input | `<take>_timing.json` next to each WAV: stimulus onset inside the recording |
| SIN: Practice, Practice Sentence | ASIO | — | — |
| CVC | no audio | — | — |

Every results file has an **Audio Backend** line naming the backend, device,
sample rate, buffer size, channels and stream latency.

## How the timing works

The engine writes output a fixed number of frames ahead of the hardware
(`prebufferFrames`, default 16), so output frame *k* is always played in the
same driver callback that captures input frame *k*. A stimulus's start sample
minus the recording's start sample, plus the interface's round-trip latency,
is where that stimulus appears in the recording. The `_timing.json` files
store exactly this number.

Wall-clock times (`performance.now()`), used for visual stimuli and mouse
responses, are derived from the stream clock. RtAudio only reports the total
input+output latency for ASIO, so it's split in half by default. If you
measure the real split (e.g. with a loopback cable), set `outputLatencyMs` /
`inputLatencyMs` in `cfg_audio_asio.json`. Sample-domain alignment between a
stimulus and a recording does not depend on this split.

If the app's event loop stalls longer than the pre-buffer, the driver plays
silence and the timeline shifts. The engine detects this, logs it, and marks
affected trials/takes `timing_reliable: false`.

## Fallback

If ASIO can't start (not Windows, no ASIO device, driver error, or
`"enabled": false` in the config), tasks fall back to Web Audio for playback
and sox / MediaRecorder for recording. The AUDIO badge turns amber, its
tooltip and the Audio Setup window say why, and every results file records
the fallback in its **Audio Backend** line — check this line before trusting
reaction times from a session.

## Verifying on real hardware

This has been tested against a simulated ASIO driver (sample-exact stimulus
alignment, channel routing, underrun detection, WAV output, SIN task
saving), not yet on a physical interface. On the first Windows build:

1. Confirm the badge reads **AUDIO: ASIO** and Test output/input work.
2. Run one SIN task item and check the `_timing.json` onset against where the
   stimulus is audible in the WAV (with a loopback cable from the stimulus
   output to the recording input, they should match to within a sample or
   two).
3. If the badge stays amber with a "single-threaded apartment" error, ASIO
   needs to run on a different thread in Electron — report the exact
   message.
