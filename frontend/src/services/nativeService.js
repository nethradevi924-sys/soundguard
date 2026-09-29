import { Capacitor, registerPlugin } from '@capacitor/core';

// Registers the native SoundGuard Capacitor plugin
const SoundGuardNative = registerPlugin('SoundGuard');

export const nativeService = {
  isNative: Capacitor.isNativePlatform(),

  async startMonitoring() {
    if (this.isNative) {
      return await SoundGuardNative.startMonitoring();
    }
    return null;
  },

  async stopMonitoring() {
    if (this.isNative) {
      return await SoundGuardNative.stopMonitoring();
    }
    return null;
  },

  async testPopup() {
    if (this.isNative) {
      return await SoundGuardNative.testPopup();
    }
    return null;
  },

  async quickTest(soundId) {
    if (this.isNative) {
      return await SoundGuardNative.quickTest({ soundId: soundId || 'fire_alarm' });
    }
    return null;
  },

  async recordAndTestRealWorld() {
    if (this.isNative) {
      return await SoundGuardNative.recordAndTestRealWorld();
    }
    return null;
  },

  async getHistory(limit = 100) {
    if (this.isNative) {
      return await SoundGuardNative.getHistory({ limit });
    }
    return null;
  },

  async clearHistory() {
    if (this.isNative) {
      return await SoundGuardNative.clearHistory();
    }
    return null;
  },

  async checkStatus() {
    if (this.isNative) {
      return await SoundGuardNative.checkStatus();
    }
    return null;
  },

  async requestPermissions() {
    if (this.isNative) {
      return await SoundGuardNative.requestAllPermissions();
    }
    return null;
  },

  addListener(eventName, callback) {
    if (this.isNative) {
      return SoundGuardNative.addListener(eventName, callback);
    }
    return Promise.resolve({ remove: () => {} });
  }
};
