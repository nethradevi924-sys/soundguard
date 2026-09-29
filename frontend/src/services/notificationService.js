/**
 * SoundGuard - System & Browser Notification Service
 * Manages OS-level desktop/mobile popups via Web Notifications API
 * and synthesizes alert chimes for maximum accessibility.
 */

class NotificationService {
  constructor() {
    this.hasPermission = typeof window !== 'undefined' && 'Notification' in window 
      ? Notification.permission === 'granted' 
      : false;
  }

  async requestPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    try {
      const perm = await Notification.requestPermission();
      this.hasPermission = perm === 'granted';
      return this.hasPermission;
    } catch (e) {
      console.warn('Error requesting notification permission:', e);
      return false;
    }
  }

  isPermissionGranted() {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  }

  async showSystemNotification(alertData) {
    if (!this.isPermissionGranted() || !alertData) return;

    const title = `${alertData.icon || '🚨'} SOUNDGUARD: ${alertData.sound_name?.toUpperCase()} DETECTED`;
    const body = `${alertData.voice_phrase || `${alertData.sound_name} detected.`} • Confidence: ${alertData.confidence_percent || 95}% • Priority: ${alertData.priority?.toUpperCase()}`;
    const options = {
      body: body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `soundguard_${alertData.sound_id || Date.now()}`,
      requireInteraction: alertData.priority === 'high',
      silent: false
    };

    // 1. Try ServiceWorkerRegistration (Works on Android Chrome and PWAs)
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, options);
          return;
        }
      } catch (e) {
        // Continue to desktop constructor
      }
    }

    // 2. Standard desktop browser Notification fallback
    try {
      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (e) {
      console.warn('System notification not supported in this context:', e);
    }
  }

  playAlertChime(priority = 'high') {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (priority === 'high') {
        // High urgency 2-tone chime
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1200, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } else {
        // Gentle chime
        osc.frequency.setValueAtTime(587, now);
        osc.frequency.setValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      // AudioContext might be blocked until user gesture
    }
  }
}

export const notificationService = new NotificationService();
