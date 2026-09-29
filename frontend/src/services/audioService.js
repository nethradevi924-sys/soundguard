/**
 * SoundGuard - Real-time Audio Capture & Web Audio API Engine
 * Captures microphone stream, produces FFT & waveform data for the visualizer,
 * sends 1-second audio frames to backend, and provides realistic on-device audio synthesis.
 */

class AudioService {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.analyserNode = null;
    this.processorNode = null;
    this.isListening = false;

    this.sampleRate = 16000;
    this.bufferSize = 4096;
    this.accumulatedSamples = [];
    this.samplesRequired = 16000; // 1 second at 16kHz

    this.onAudioFrame = null;
    this.currentDb = -60;
    this.selectedDeviceId = null;
  }

  async getAudioDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'audioinput');
    } catch (e) {
      console.warn('Could not enumerate audio devices:', e);
      return [];
    }
  }

  async startListening(onAudioFrameCallback, deviceId = null) {
    if (this.isListening) return;
    this.onAudioFrame = onAudioFrameCallback;
    this.selectedDeviceId = deviceId;

    // 1. Safe AudioContext Initialization (Android Hardware Support)
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      throw new Error('Web Audio API is not supported on this browser/device.');
    }

    try {
      this.audioContext = new AudioCtx({ sampleRate: 16000 });
    } catch (e) {
      // Fallback for Android devices that mandate 44.1kHz or 48kHz hardware rate
      this.audioContext = new AudioCtx();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const actualSampleRate = this.audioContext.sampleRate || 16000;
    this.samplesRequired = actualSampleRate; // Exactly 1 second of audio at active sample rate

    // 2. Safe getUserMedia with cascading Android fallback
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone access requires a secure connection (HTTPS or localhost). Please open via HTTPS or relaunch Chrome with the insecure origins flag enabled.');
    }

    let stream = null;
    try {
      // First attempt: Optimal uncompressed environmental audio
      const optimalConstraints = {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      };
      if (deviceId && deviceId !== 'default' && deviceId !== '') {
        optimalConstraints.deviceId = { ideal: deviceId };
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: optimalConstraints });
    } catch (err1) {
      console.warn('Advanced mic constraints not accepted by Android, using universal audio fallback:', err1);
      try {
        // Second attempt: Universal audio constraint (supported on 100% of Android devices)
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err2) {
        console.error('All getUserMedia attempts failed:', err2);
        this.stopListening();
        throw err2;
      }
    }

    try {
      this.mediaStream = stream;
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Fast Analyser for Visualizer
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 1024;
      this.analyserNode.smoothingTimeConstant = 0.8;
      this.sourceNode.connect(this.analyserNode);

      // Audio Processor for Frame Extraction
      this.processorNode = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);
      this.processorNode.onaudioprocess = (e) => {
        if (!this.isListening) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const outputData = e.outputBuffer.getChannelData(0);
        // Mute speaker output so mic is NOT echoed back into user's headphones
        outputData.fill(0);

        const gain = this.gainMultiplier || 1.0;

        // Calculate Decibels with gain multiplier
        let sumSquares = 0;
        for (let i = 0; i < inputData.length; i++) {
          const s = inputData[i] * gain;
          sumSquares += s * s;
        }
        const rms = Math.sqrt(sumSquares / inputData.length);
        const db = rms > 1e-4 ? Math.round(20 * Math.log10(rms) + 90) : 30;
        this.currentDb = Math.max(30, Math.min(110, db));

        // Accumulate 1-second window
        for (let i = 0; i < inputData.length; i++) {
          const sample = inputData[i] * gain;
          // Soft clamp to prevent digital clipping
          this.accumulatedSamples.push(Math.max(-1.0, Math.min(1.0, sample)));
        }

        // When 1 second accumulated, dispatch
        if (this.accumulatedSamples.length >= this.samplesRequired) {
          const frameToSend = new Float32Array(this.accumulatedSamples.slice(0, this.samplesRequired));
          // Slide with 50% overlap
          this.accumulatedSamples = this.accumulatedSamples.slice(Math.floor(this.samplesRequired / 2));

          if (this.onAudioFrame) {
            // Optimized chunked base64 conversion (avoids mobile GC throttling)
            const u8 = new Uint8Array(frameToSend.buffer);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < u8.length; i += chunkSize) {
              const chunk = u8.subarray(i, i + chunkSize);
              binary += String.fromCharCode.apply(null, chunk);
            }
            const base64 = btoa(binary);
            this.onAudioFrame(base64, actualSampleRate);
          }
        }
      };

      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      this.isListening = true;
      return true;
    } catch (err) {
      console.error('Failed to access microphone:', err);
      this.stopListening();
      throw err;
    }
  }

  setGainMultiplier(multiplier) {
    this.gainMultiplier = Math.max(0.5, Math.min(5.0, Number(multiplier) || 1.0));
  }

  stopListening() {
    this.isListening = false;
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.accumulatedSamples = [];
  }

  getWaveformData() {
    if (!this.analyserNode) return new Uint8Array(128);
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  getFrequencyData() {
    if (!this.analyserNode) return new Uint8Array(128);
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(dataArray);
    return dataArray;
  }

  getCurrentDb() {
    return this.currentDb;
  }

  async playSynthesizedSound(soundId, durationSec = 1.0) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const now = ctx.currentTime;

    if (soundId === 'fire_alarm') {
      [0, 0.3, 0.6].forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(3200, now + offset);
        gain.gain.setValueAtTime(0.4, now + offset);
        gain.gain.setValueAtTime(0, now + offset + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.22);
      });
    } else if (soundId === 'car_horn') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.frequency.setValueAtTime(420, now);
      osc2.frequency.setValueAtTime(505, now);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.linearRampToValueAtTime(0, now + durationSec);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + durationSec);
      osc2.stop(now + durationSec);
    } else if (soundId === 'glass_breaking') {
      const bufferSize = ctx.sampleRate * 0.8;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.12));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(4000, now);
      noise.connect(filter);
      filter.connect(ctx.destination);
      noise.start(now);
    } else if (soundId === 'doorbell') {
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(660, now);
      gain1.gain.setValueAtTime(0.5, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(520, now + 0.4);
      gain2.gain.setValueAtTime(0.5, now + 0.4);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.4);
      osc2.stop(now + 1.0);
    } else if (soundId === 'siren') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(1400, now + 0.5);
      osc.frequency.linearRampToValueAtTime(800, now + 1.0);
      gain.gain.setValueAtTime(0.35, now);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.0);
    } else if (soundId === 'baby_crying') {
      [0, 0.45].forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450, now + offset);
        osc.frequency.linearRampToValueAtTime(580, now + offset + 0.18);
        osc.frequency.linearRampToValueAtTime(430, now + offset + 0.4);
        gain.gain.setValueAtTime(0.01, now + offset);
        gain.gain.linearRampToValueAtTime(0.4, now + offset + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.42);
      });
    } else if (soundId === 'dog_barking') {
      [0, 0.35].forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(450, now + offset);
        osc.frequency.exponentialRampToValueAtTime(160, now + offset + 0.22);
        gain.gain.setValueAtTime(0.5, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.25);
      });
    } else if (soundId === 'door_knocking') {
      [0, 0.22, 0.45].forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now + offset);
        osc.frequency.exponentialRampToValueAtTime(70, now + offset + 0.12);
        gain.gain.setValueAtTime(0.7, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.13);
      });
    }
    } catch (e) {
      console.warn('Audio synthesis error:', e);
    }
  }
}

export const audioService = new AudioService();
