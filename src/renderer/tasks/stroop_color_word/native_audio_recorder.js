// STROOP COLOR WORD TASK NATIVE AUDIO RECORDER
const recorder = require('../../../shared/audio/sox-recorder');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const asioEngine = require('../../../shared/audio/asio-engine');

function getSoxInstallMessage() {
    if (process.platform === 'win32') {
        return 'sox is not installed. Download it from https://sourceforge.net/projects/sox/ and add it to your PATH.';
    }
    if (process.platform === 'darwin') {
        return 'sox is not installed. Please run: brew install sox';
    }
    return 'sox is not installed. Please install it via your package manager (e.g. sudo apt install sox).';
}

class NativeAudioRecorder {
    constructor() {
        this.isRecording = false;
        this.recordingStream = null;
        this.outputFile = null;
        this.isPreloaded = false;
        this.preloadedStream = null;

        // Set once a recording is started via the ASIO backend, so
        // stopRecording() knows which code path to tear down.
        this.usingAsio = false;
        this.asioOutputPath = null;
    }

    async preloadMicrophone() {
        try {
            console.log('Pre-loading microphone...');

            if (asioEngine.isEnabled()) {
                const started = await asioEngine.ensureStarted();
                if (started) {
                    console.log('ASIO stream started; microphone pre-loaded via ASIO');
                    this.isPreloaded = true;
                    return true;
                }
                console.warn('ASIO is enabled but failed to start; falling back to sox microphone input');
            }

            // Check sox installation first
            const soxInstalled = await this.checkSoxInstallation();
            if (!soxInstalled) {
                throw new Error(getSoxInstallMessage());
            }

            // Create a dummy recording stream to initialize the microphone
            this.preloadedStream = recorder.record({
                sampleRate: 44100,
                channels: 1,
                compress: false,
                threshold: 0.5,
                silence: '1.0',
                verbose: false,
                recordProgram: 'sox'
            });

            // Start but don't save the audio yet. Node throws an unhandled
            // exception if a stream emits 'error' with no listener attached,
            // so this needs one even though nothing is consuming the data yet.
            this.preloadedStream.stream().on('error', (error) => {
                console.error('Preloaded microphone stream error:', error);
                this.isPreloaded = false;
            });
            this.preloadedStream.stream().resume();
            this.isPreloaded = true;

            console.log('Microphone pre-loaded successfully');
            return true;

        } catch (error) {
            console.error('Failed to pre-load microphone:', error);
            this.isPreloaded = false;
            return false;
        }
    }

    getHighResolutionTime() {
        // Use performance.now() for high-resolution timing
        return performance.now() / 1000.0; // Convert to seconds
    }

    async startRecordingWithPreciseTiming(outputPath, durationMs, volumeLevel = 50) {
        if (asioEngine.isEnabled()) {
            const started = await asioEngine.ensureStarted();
            if (started) {
                return this._startRecordingWithPreciseTimingAsio(outputPath, durationMs);
            }
            console.warn('ASIO is enabled but failed to start; falling back to sox recording');
        }
        return this._startRecordingWithPreciseTimingSox(outputPath, durationMs, volumeLevel);
    }

    async _startRecordingWithPreciseTimingAsio(outputPath, durationMs) {
        const audioStartTime = this.getHighResolutionTime();

        this.usingAsio = true;
        this.asioOutputPath = outputPath;
        this.isRecording = true;
        await asioEngine.startCapture();

        return new Promise((resolve) => {
            setTimeout(async () => {
                await this.stopRecording();
                console.log(`Recording completed (ASIO): ${outputPath}`);
                resolve({
                    outputPath: outputPath,
                    audioStartTime: audioStartTime
                });
            }, durationMs);
        });
    }

    async _startRecordingWithPreciseTimingSox(outputPath, durationMs, volumeLevel = 50) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log(`Starting recording to: ${outputPath}`);

                const audioStartTime = this.getHighResolutionTime();

                // Stop preloaded stream if exists
                if (this.preloadedStream) {
                    this.preloadedStream.stop();
                    this.preloadedStream = null;
                }

                // Check sox installation first
                const soxInstalled = await this.checkSoxInstallation();
                if (!soxInstalled) {
                    throw new Error(getSoxInstallMessage());
                }

                // Ensure output directory exists
                fs.mkdirSync(path.dirname(outputPath), { recursive: true });

                // Create output file stream
                this.outputFile = fs.createWriteStream(outputPath);

                // Configure recording with explicit sox
                this.recordingStream = recorder.record({
                    sampleRate: 44100,
                    channels: 1,
                    compress: false,
                    threshold: 0.5,
                    silence: '1.0',
                    verbose: false,
                    recordProgram: 'sox'
                });

                // Pipe audio to file
                this.recordingStream.stream().pipe(this.outputFile);
                this.isRecording = true;

                // Handle errors
                this.recordingStream.stream().on('error', (error) => {
                    console.error('Recording stream error:', error);
                    this.stopRecording();
                    reject(error);
                });

                this.outputFile.on('error', (error) => {
                    console.error('Output file error:', error);
                    this.stopRecording();
                    reject(error);
                });

                // Stop recording after duration
                setTimeout(() => {
                    this.stopRecording();
                    console.log(`Recording completed: ${outputPath}`);
                    resolve({
                        outputPath: outputPath,
                        audioStartTime: audioStartTime
                    });
                }, durationMs);

            } catch (error) {
                console.error('Failed to start recording:', error);
                reject(error);
            }
        });
    }

    async checkSoxInstallation() {
        return new Promise((resolve) => {
            const sox = spawn('sox', ['--version']);

            sox.on('close', (code) => {
                if (code === 0) {
                    console.log('sox is installed');
                    resolve(true);
                } else {
                    console.log('sox is not properly installed');
                    resolve(false);
                }
            });

            sox.on('error', (error) => {
                console.log('sox not found:', error.message);
                resolve(false);
            });
        });
    }

    async testAudio() {
        try {
            console.log('Testing microphone...');

            if (asioEngine.isEnabled()) {
                const started = await asioEngine.ensureStarted();
                if (started) {
                    return await this._testAudioAsio();
                }
                console.warn('ASIO is enabled but failed to start; falling back to sox microphone test');
            }

            // First check if sox is installed
            const soxInstalled = await this.checkSoxInstallation();
            if (!soxInstalled) {
                console.error(getSoxInstallMessage());
                return false;
            }

            // Test if recording is available
            const testStream = recorder.record({
                sampleRate: 44100,
                channels: 1,
                silence: '2.0',
                threshold: 0.5,
                verbose: true, // Enable verbose for debugging
                recordProgram: 'sox'
            });

            let hasAudio = false;
            let errorOccurred = false;

            // Listen for audio data
            testStream.stream().on('data', (chunk) => {
                if (chunk.length > 0) {
                    hasAudio = true;
                }
            });

            // Listen for errors
            testStream.stream().on('error', (error) => {
                console.error('Recording stream error:', error);
                errorOccurred = true;
            });

            // Stop test after 1 second
            setTimeout(() => {
                testStream.stop();
            }, 1000);

            // Wait a bit longer to check results
            await this.wait(1500);

            if (errorOccurred) {
                console.log('Microphone test: FAILED - Error occurred');
                return false;
            } else if (hasAudio) {
                console.log('Microphone test: PASSED');
                return true;
            } else {
                console.log('Microphone test: FAILED - No audio detected');
                return false;
            }

        } catch (error) {
            console.error('Audio test failed:', error);
            return false;
        }
    }

    async _testAudioAsio() {
        await asioEngine.startCapture();
        await this.wait(1000);
        const hasAudio = asioEngine.stopCaptureDiscard();
        console.log(hasAudio ? 'Microphone test: PASSED (ASIO)' : 'Microphone test: FAILED - No audio detected (ASIO)');
        return hasAudio;
    }

    async startRecording(outputPath, durationMs, volumeLevel = 50) {
        if (asioEngine.isEnabled()) {
            const started = await asioEngine.ensureStarted();
            if (started) {
                return this._startRecordingAsio(outputPath, durationMs);
            }
            console.warn('ASIO is enabled but failed to start; falling back to sox recording');
        }
        return this._startRecordingSox(outputPath, durationMs, volumeLevel);
    }

    async _startRecordingAsio(outputPath, durationMs) {
        this.usingAsio = true;
        this.asioOutputPath = outputPath;
        this.isRecording = true;
        await asioEngine.startCapture();

        return new Promise((resolve) => {
            setTimeout(async () => {
                await this.stopRecording();
                console.log(`Recording completed (ASIO): ${outputPath}`);
                resolve(outputPath);
            }, durationMs);
        });
    }

    async _startRecordingSox(outputPath, durationMs, volumeLevel = 50) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log(`Starting recording to: ${outputPath}`);

                // Check sox installation first
                const soxInstalled = await this.checkSoxInstallation();
                if (!soxInstalled) {
                    throw new Error(getSoxInstallMessage());
                }

                // Ensure output directory exists
                fs.mkdirSync(path.dirname(outputPath), { recursive: true });

                // Create output file stream
                this.outputFile = fs.createWriteStream(outputPath);

                // Configure recording with explicit sox
                this.recordingStream = recorder.record({
                    sampleRate: 44100,
                    channels: 1,
                    compress: false,
                    threshold: 0.5,
                    silence: '1.0',
                    verbose: false,
                    recordProgram: 'sox'
                });

                // Pipe audio to file
                this.recordingStream.stream().pipe(this.outputFile);
                this.isRecording = true;

                // Handle errors
                this.recordingStream.stream().on('error', (error) => {
                    console.error('Recording stream error:', error);
                    this.stopRecording();
                    reject(error);
                });

                this.outputFile.on('error', (error) => {
                    console.error('Output file error:', error);
                    this.stopRecording();
                    reject(error);
                });

                // Stop recording after duration
                setTimeout(() => {
                    this.stopRecording();
                    console.log(`Recording completed: ${outputPath}`);
                    resolve(outputPath);
                }, durationMs);

            } catch (error) {
                console.error('Failed to start recording:', error);
                reject(error);
            }
        });
    }

    async stopRecording() {
        if (this.usingAsio) {
            if (!this.isRecording) return;
            this.isRecording = false;
            this.usingAsio = false;
            try {
                await asioEngine.stopCaptureToFile(this.asioOutputPath);
            } catch (error) {
                console.error('Error finalizing ASIO recording:', error);
            }
            return;
        }

        if (this.recordingStream && this.isRecording) {
            this.recordingStream.stop();
            this.isRecording = false;
        }

        if (this.outputFile) {
            this.outputFile.end();
            this.outputFile = null;
        }
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = NativeAudioRecorder;
