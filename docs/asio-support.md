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

### Reference lab setup (Scarlett 4i4 + JDS Labs Atom Amp 2)

This is the verified working setup for stimulus playback to insert earphones.

Signal path:
**Laptop → Scarlett 4i4 (USB) → Scarlett headphone jack → RCA cable → Atom Amp 2 RCA inputs → Atom headphone output → earphone adapter → insert earphones**

Cabling:
- The Scarlett's front **headphone jack** connects to the cable that splits into two RCA plugs.
- **Red RCA → `R IN`** on the back of the Atom Amp 2, and **white RCA → `L IN`**. Use the "IN" pair, not the "OUT" pair: the OUT sockets are line outputs and the amp makes no sound if you're plugged into them.
- The earphone adapter plugs into the Atom Amp 2's front headphone output.

Atom Amp 2:
- The **GAIN** and **INPUT** buttons are both pressed in.
- With INPUT pressed, the amp uses the RCA inputs rather than the 3.5 mm input.

Focusrite Control 2:
- **Inputs** and **Mixer** tabs: no changes needed.
- **Routing** tab:
  - Analogue outputs → **Headphones: Playback 1–2**
  - Digital outputs → **Loopback: Playback 1–2**

  If the Mixer tab shows "No outputs assigned" and the Routing tab doesn't send Playback 1–2 to the headphones, nothing reaches the amp. This was the cause of "no sound" during setup.

OATS Audio Setup:
- Device: **Focusrite USB ASIO** (6 in / 6 out)
- **48000 Hz**, **128-sample** buffer
- Stimulus outputs: **Out 1 + Out 2** (= Playback 1–2)
- Recording input: **Input 1** (the microphone on the Scarlett's front input 1)
- On the 4i4, ASIO inputs 5–6 are the Loopback pair: a digital copy of Playback 1–2. Don't choose them as the recording input for participants.

Quick check: play any audio in Windows with the Scarlett as the output device. If it's audible in the earphones, OATS's **Test output** will be too.

#### Testing recording without a microphone (Loopback)

The Routing tab above sends **Loopback ← Playback 1–2**, which gives the 4i4 a digital copy of everything playing on Playback 1–2. In ASIO this appears as **Input 5** (left) and **Input 6** (right). Recording from it checks that OATS records, saves and times audio correctly through ASIO, with no microphone or extra cables.

1. **Pause or close any other audio** (YouTube, music, notifications). Loopback records everything sent to Playback 1–2, both OATS stimuli and any Windows audio, mixed together.
2. In OATS, click **AUDIO** and set **Recording input channel = Input 5**. Click **Save & Apply**.
3. Click **Test output**, then straight away **Test input (2 s)**. It should report "Input OK" with a peak level.
4. Run **Speech in Noise: Words** for 2–3 items.
5. Open `%APPDATA%\Oats\sessions\<participant>\Speech_in_Noise\CaST_word\recordings\` (`<participant>` is the ID used, e.g. `DEV_...`) and check:
   - each `.wav` plays back the stimulus word and noise that was heard;
   - each `.wav` has a matching `_timing.json`;
   - the results file's **Audio Backend** line reads `ASIO - Focusrite USB ASIO ...`.
6. **Set Recording input channel back to Input 1** and **Save & Apply** before running participants. Otherwise OATS records the stimulus instead of the participant.

Expected timing difference: loopback is digital and skips the analogue converters. The stimulus therefore appears in the WAV a few milliseconds earlier than `stimulus_onset_in_recording_ms` in `_timing.json`, which includes the full interface round-trip latency. This is normal. To check timing exactly, use a physical loopback cable instead: a ¼" cable from rear **Output 3** into front **Input 1**, with **Out 3** ticked in Audio Setup and Input 1 selected.

### Channels used by tasks

Every task plays and records on the channels chosen with the **AUDIO**
button (Audio Setup); there is no per-task channel setting. A channel the
interface doesn't have is an error, not silently dropped, and the **Audio
Backend** line in each results file names the channels used.

### Test Audio check (every listening task)

Auditory Stroop, Speeded Classification and all Speech-in-Noise tasks have a
**Test Audio** button on their welcome/instruction page. It plays through the
same code and channels as the trials:

1. With ASIO, a beep on each output chosen in Audio Setup, one at a time.
   Listen that each comes out where expected (e.g. Out 1 left, Out 2 right).
2. A sample on all chosen outputs: the warning beep and a word for Auditory
   Stroop / Speeded Classification; a beep for Speech-in-Noise (so the
   participant doesn't hear a test item early).
3. A verdict: **ASIO is working** (device and outputs), **Not using ASIO**
   (with the reason; sound goes to the Windows default output), or **ASIO
   check failed** (e.g. the sample fell back to Web Audio, or an audio
   dropout). It also warns if Windows sounds share the stimulus outputs.

The result is written to the task's results file as an **Audio Check** line
(`not run` if the button wasn't used).

### Live status and built-in help

- **AUDIO badge.** It reads green **AUDIO: ASIO** while the interface is running.
  - If the interface is unplugged or stops delivering audio, it turns back into the plain **AUDIO** button within about 1.5 s. A notice appears, and tasks switch to the fallback audio path instead of freezing; a recording that was interrupted is saved and marked `timing_reliable: false`.
  - When the interface is plugged back in, OATS reconnects automatically (it retries for a few seconds while the driver comes up) and the badge turns green again.
- **Windows sound output (live).** The connected Audio Setup window shows Windows' current default playback device and, for the Focusrite, which Playback pair it uses. It's read from the device name, e.g. "Speakers (Focusrite USB Audio)" = Playback 1–2.
  - If the device name doesn't say which pair it uses (e.g. "Speakers (Focusrite USB Audio)"), 1–2 is assumed and a small menu lets you pick the real pair. Your choice is remembered for that device.
  - A comparison line underneath updates as soon as you tick or untick a stimulus output: **✓ Separate** (Windows → Playback X–Y · Stimuli → Out A+B) or **⚠ Clash** (naming the shared channels).
  - On a clash, a pulsing **"Windows sounds will mix with your stimuli — hover to fix"** chip appears. Hovering it shows the steps to move one of them, and a button that opens Windows Sound settings.
- **SPL calibration.** The **"How to calibrate"** chip next to the field shows the measuring steps on hover.
- **Setup guide.** When ASIO isn't running, Audio Setup shows a **JDS + Focusrite Scarlett 4i4 4th Gen** button above the fallback status. It opens a step-by-step guide to the wiring, Focusrite Control 2 and OATS Audio Setup (the same setup as the reference lab setup above).

### Keeping app stimuli and Windows audio on separate channels

OATS (through ASIO) and Windows (through its normal WDM audio) both send audio into the Focusrite's **Playback** channels:

- Windows' default "Focusrite USB" playback device uses **Playback 1–2**.
- OATS's **Out N** in Audio Setup is ASIO Playback N, so Out 1+2 = Playback 1–2.

With both on 1–2 they're mixed together. To keep them apart, use different pairs. Which pair OATS uses doesn't matter; any outputs can be ticked:

- **Stimuli on 3–4, Windows on 1–2:** tick **Out 3 + Out 4** in Audio Setup and leave Windows as it is.
- **Stimuli on 1–2, Windows on 3–4:** keep Out 1 + 2 in OATS. In the Focusrite Notifier tray icon, choose **Expose Windows Channels**, then pick the 3–4 device as the Windows output (or as the output of the app playing background noise).

Then, in Focusrite Control 2 → **Routing**, send each Playback pair to the physical output you want. For example, Headphones ← the stimulus pair and Line Outputs ← the Windows pair. If both must reach the same earphones, build a mix on the **Mixer** tab with both Playback pairs and route it to Headphones. Leave the stimulus fader at 0 dB, because the fader scales the stimulus level too.

**Volume control.** ASIO bypasses the Windows mixer, so the Windows volume slider never changes the level of OATS stimuli, whatever channels they use. Stimulus level is set only by:

- the task's volume setting in OATS;
- Focusrite Control 2 (mixer faders, if a mix is used);
- the hardware knobs (Scarlett headphone/output knob, Atom Amp volume).

Quick proof on the lab machine:
1. Play a task stimulus.
2. Move the Windows volume slider. The stimulus level must not change.
3. Change the task's volume in Task Configuration. It must change.

If the Windows slider does change it, OATS has fallen back to Web Audio (the AUDIO badge is amber). Check Audio Setup.

### Stimulus level logging (dB / SPL)

Each listening task that saves results (Words, Nonwords, HINT, CST, Auditory Stroop, Speeded Classification) records the stimulus volume used for that participant:

- **In the task's results file**, a line like `Stimulus Level: 150% (+3.52 dB re. stimulus file level), estimated 68.5 dB SPL (calibration 65.0 dB SPL at 100%)`.
- **In a shared log** (`stimulus-levels.csv` in the Oats data folder, e.g. `%APPDATA%\Oats\stimulus-levels.csv`), one row per participant per task, with these columns:
  - `timestamp`
  - `participant_id`
  - `developer_mode`
  - `task`
  - `volume_percent`
  - `gain_db`
  - `calibration_db_spl_at_100`
  - `estimated_db_spl`
  - `audio_backend`

  Filter out `developer_mode = yes` rows, then average `gain_db` or `estimated_db_spl` across participants.

`gain_db` is 20·log10(volume): 0 dB = the stimulus file's own level, +6 dB = 200%. It isn't SPL by itself, because the knobs and earphones also set what reaches the ear. To log estimated SPL:

1. Fix the hardware knob positions (mark or tape them).
2. Play a stimulus or calibration tone at 100% volume and measure the level at the earphone (sound level meter with an insert-earphone coupler).
3. Enter that number in **Audio Setup → SPL calibration**.

From then on, `estimated_db_spl = calibration + gain_db`. Re-measure if the knobs, earphones or interface change. The practice tasks (Practice, Practice Sentence) don't save results, so they aren't logged.

## What each task uses ASIO for

| Task | Playback | Recording | Timing recorded |
|---|---|---|---|
| Stroop Colour Word | — (visual) | ASIO input | Recording start from the stream clock; `stimulus_offset` in results |
| Reading Span | — | ASIO input | — (recall recordings, no RT measured) |
| Auditory Stroop | ASIO | — | RT from **word onset** to the key/click event timestamp; per-trial `audio_backend`, `timing_reliable` |
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

Auditory Stroop and Speeded Classification play each trial's warning tone,
silent gap and word as one continuous sound, so the tone-to-word gap is exact
to the sample. The engine reports the word's start time from the interface's
clock before the word is heard, so responses are timed from true word onset
and responses before it are ignored.

Wall-clock times (`performance.now()`), used for visual stimuli and
key/mouse responses, are derived from the stream clock. RtAudio only reports the total
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
