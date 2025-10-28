// STROOP COLOR WORD TASK NATIVE AUDIO RECORDER
const recorder = require('node-record-lpcm16');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class NativeAudioRecorder {
    constructor() {
        this.isRecording = false;
        this.recordingStream = null;
        this.outputFile = null;
        this.isPreloaded = false;
        this.preloadedStream = null;
    }

    async preloadMicrophone() {
        try {
            console.log('Pre-loading microphone...');
            
            // Check sox installation first
            const soxInstalled = await this.checkSoxInstallation();
            if (!soxInstalled) {
                throw new Error('sox is not installed. Please run: brew install sox');
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

            // Start but don't save the audio yet
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
                    throw new Error('sox is not installed. Please run: brew install sox');
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
            
            // First check if sox is installed
            const soxInstalled = await this.checkSoxInstallation();
            if (!soxInstalled) {
                console.error('sox is not installed. Please run: brew install sox');
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

    async startRecording(outputPath, durationMs, volumeLevel = 50) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log(`Starting recording to: ${outputPath}`);
                
                // Check sox installation first
                const soxInstalled = await this.checkSoxInstallation();
                if (!soxInstalled) {
                    throw new Error('sox is not installed. Please run: brew install sox');
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

    stopRecording() {
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