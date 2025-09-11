const fs = require('fs');
const WavDecoder = require('wav').Reader;

class SpeechOnsetDetector {
    constructor() {
        this.sampleRate = 44100; // Will be updated based on actual file
        this.windowSize = 0.02; // 20ms windows
        this.hopSize = 0.01; // 10ms hop
        this.searchStartOffset = 0.05; // 50ms after stimulus onset
        this.searchDuration = 3.0; // 3 seconds search window
        this.baselineDuration = 0.1; // 100ms baseline
        this.thresholdMultiplier = 3.0; // 3×SD threshold
        this.minConsecutiveWindows = 3; // Require 3 consecutive windows
        this.backoffWindows = 2; // Back off by 2 windows
    }

    async analyzeWavFile(filePath, stimulusOffset) {
        try {
            const audioData = await this.loadWavFile(filePath);
            const filteredAudio = this.highPassFilter(audioData.samples, audioData.sampleRate);
            
            this.sampleRate = audioData.sampleRate;
            
            // Calculate search window in samples
            const searchStartSample = Math.floor((stimulusOffset + this.searchStartOffset) * this.sampleRate);
            const searchEndSample = Math.floor((stimulusOffset + this.searchStartOffset + this.searchDuration) * this.sampleRate);
            
            // Extract search region
            const searchRegion = filteredAudio.slice(searchStartSample, Math.min(searchEndSample, filteredAudio.length));
            
            if (searchRegion.length === 0) {
                throw new Error('Search region is empty');
            }
            
            // Compute energy in overlapping windows
            const energyProfile = this.computeEnergyProfile(searchRegion);
            
            // Calculate baseline from first portion
            const baselineLength = Math.min(
                Math.floor(this.baselineDuration / this.hopSize),
                Math.floor(energyProfile.length / 4)
            );
            
            const baseline = energyProfile.slice(0, baselineLength);
            const baselineMean = baseline.reduce((a, b) => a + b, 0) / baseline.length;
            const baselineSD = Math.sqrt(
                baseline.reduce((sum, val) => sum + Math.pow(val - baselineMean, 2), 0) / baseline.length
            );
            
            // Find onset
            const threshold = baselineMean + this.thresholdMultiplier * baselineSD;
            const onsetWindowIndex = this.findOnset(energyProfile, threshold);
            
            if (onsetWindowIndex === -1) {
                return {
                    speechOnsetTime: null,
                    rtSeconds: null,
                    rtConfidence: 0,
                    baseline: { mean: baselineMean, sd: baselineSD },
                    threshold: threshold,
                    success: false
                };
            }
            
            // Convert window index to time
            const onsetTimeInSearch = Math.max(0, (onsetWindowIndex - this.backoffWindows) * this.hopSize);
            const speechOnsetTimeInAudio = stimulusOffset + this.searchStartOffset + onsetTimeInSearch;
            
            // Calculate RT
            const rtSeconds = speechOnsetTimeInAudio - stimulusOffset;
            
            // Calculate confidence
            const onsetEnergy = energyProfile[onsetWindowIndex];
            const rtConfidence = Math.min(1.0, (onsetEnergy - baselineMean) / (4 * baselineSD));
            
            return {
                speechOnsetTime: speechOnsetTimeInAudio,
                rtSeconds: rtSeconds,
                rtConfidence: rtConfidence,
                baseline: { mean: baselineMean, sd: baselineSD },
                threshold: threshold,
                success: true
            };
            
        } catch (error) {
            console.error('Error analyzing WAV file:', error);
            return {
                speechOnsetTime: null,
                rtSeconds: null,
                rtConfidence: 0,
                baseline: { mean: 0, sd: 0 },
                threshold: 0,
                success: false,
                error: error.message
            };
        }
    }

    async loadWavFile(filePath) {
        return new Promise((resolve, reject) => {
            const samples = [];
            let sampleRate = 44100;
            
            const wavReader = new WavDecoder();
            
            wavReader.on('format', (format) => {
                sampleRate = format.sampleRate;
                console.log(`WAV format: ${format.sampleRate}Hz, ${format.channels} channels, ${format.bitDepth}-bit`);
            });
            
            wavReader.on('data', (chunk) => {
                // Convert to float samples [-1, 1]
                for (let i = 0; i < chunk.length; i += 2) {
                    const sample = chunk.readInt16LE(i) / 32768.0;
                    samples.push(sample);
                }
            });
            
            wavReader.on('end', () => {
                resolve({ samples: samples, sampleRate: sampleRate });
            });
            
            wavReader.on('error', reject);
            
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(wavReader);
        });
    }

    highPassFilter(samples, sampleRate, cutoffFreq = 80) {
        // Simple IIR high-pass filter implementation
        const RC = 1.0 / (2 * Math.PI * cutoffFreq);
        const dt = 1.0 / sampleRate;
        const alpha = RC / (RC + dt);
        
        const filtered = new Array(samples.length);
        filtered[0] = samples[0];
        
        for (let i = 1; i < samples.length; i++) {
            filtered[i] = alpha * (filtered[i-1] + samples[i] - samples[i-1]);
        }
        
        return filtered;
    }

    computeEnergyProfile(samples) {
        const windowSamples = Math.floor(this.windowSize * this.sampleRate);
        const hopSamples = Math.floor(this.hopSize * this.sampleRate);
        const numWindows = Math.floor((samples.length - windowSamples) / hopSamples) + 1;
        
        const energyProfile = [];
        
        for (let i = 0; i < numWindows; i++) {
            const startSample = i * hopSamples;
            const endSample = Math.min(startSample + windowSamples, samples.length);
            
            let energy = 0;
            for (let j = startSample; j < endSample; j++) {
                energy += samples[j] * samples[j];
            }
            energy /= (endSample - startSample); // RMS energy
            
            energyProfile.push(energy);
        }
        
        // Smooth the energy profile (simple moving average)
        const smoothed = this.smoothEnergyProfile(energyProfile, 3);
        return smoothed;
    }

    smoothEnergyProfile(profile, windowSize) {
        const smoothed = [];
        const halfWindow = Math.floor(windowSize / 2);
        
        for (let i = 0; i < profile.length; i++) {
            const start = Math.max(0, i - halfWindow);
            const end = Math.min(profile.length, i + halfWindow + 1);
            
            let sum = 0;
            for (let j = start; j < end; j++) {
                sum += profile[j];
            }
            smoothed.push(sum / (end - start));
        }
        
        return smoothed;
    }

    findOnset(energyProfile, threshold) {
        let consecutiveCount = 0;
        let onsetIndex = -1;
        
        for (let i = 0; i < energyProfile.length; i++) {
            if (energyProfile[i] > threshold) {
                consecutiveCount++;
                if (consecutiveCount >= this.minConsecutiveWindows && onsetIndex === -1) {
                    onsetIndex = i - this.minConsecutiveWindows + 1;
                }
            } else {
                consecutiveCount = 0;
            }
        }
        
        return onsetIndex;
    }
}

module.exports = SpeechOnsetDetector;