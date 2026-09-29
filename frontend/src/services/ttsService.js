/**
 * SoundGuard - Text-To-Speech (TTS) Service
 * Utilizes native on-device Web Speech Synthesis API for instant zero-latency speech.
 */

class TTSService {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voices = [];
    this.selectedVoice = null;
    this.isSupported = Boolean(this.synth);

    if (this.isSupported) {
      this.loadVoices();
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
    // Select clear English voice if available
    this.selectedVoice = 
      this.voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Siri'))) ||
      this.voices.find(v => v.lang.startsWith('en')) ||
      this.voices[0];
  }

  speak(text, options = {}) {
    if (!this.isSupported || !text) return;

    try {
      if (this.synth.speaking || this.synth.pending) {
        this.synth.cancel();
      }
      if (this.synth.paused) {
        this.synth.resume();
      }

      if (!this.voices || this.voices.length === 0) {
        this.loadVoices();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = options.rate || (options.priority === 'high' ? 1.05 : 1.0);
      utterance.pitch = options.pitch || (options.priority === 'high' ? 1.1 : 1.0);
      utterance.volume = options.volume !== undefined ? options.volume : 1.0;

      this.synth.speak(utterance);
    } catch (e) {
      console.warn('TTS speak error:', e);
    }
  }

  stop() {
    if (this.isSupported && this.synth) {
      this.synth.cancel();
    }
  }
}

export const ttsService = new TTSService();
