/**
 * SoundGuard - Vibration & Haptic Service
 * Controls tactile alerts via the HTML5 Vibration API (navigator.vibrate).
 */

class VibrationService {
  constructor() {
    this.isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  }

  vibrate(pattern) {
    if (!this.isSupported) return false;
    try {
      if (Array.isArray(pattern)) {
        return navigator.vibrate(pattern);
      } else if (typeof pattern === 'number') {
        return navigator.vibrate(pattern);
      }
      return navigator.vibrate([200, 100, 200]);
    } catch (e) {
      console.warn('Vibration not permitted or failed:', e);
      return false;
    }
  }

  stop() {
    if (this.isSupported) {
      try {
        navigator.vibrate(0);
      } catch (e) {}
    }
  }
}

export const vibrationService = new VibrationService();
