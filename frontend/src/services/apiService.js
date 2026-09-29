/**
 * SoundGuard - API Service
 * Handles all REST communication with the local Edge AI backend.
 */

const isCapacitorNative = typeof window !== 'undefined' && (
  (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
  window.location.protocol === 'capacitor:' ||
  window.location.protocol === 'ionic:'
);
const API_ORIGIN = isCapacitorNative ? 'http://10.168.206.132:5000' : '';
const BASE_URL = `${API_ORIGIN}/api`;

async function apiFetch(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Bypass-Tunnel-Reminder': 'true',
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return await res.json();
}

export const apiService = {
  async getStatus() {
    return await apiFetch('/status');
  },

  async getSounds() {
    return await apiFetch('/sounds');
  },

  async detectAudio(audioBase64, sampleRate = 16000) {
    return await apiFetch('/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio_base64: audioBase64,
        sample_rate: sampleRate,
        dtype: 'float32'
      })
    });
  },

  async simulateSound(soundId) {
    return await apiFetch(`/simulate-sound/${soundId}`, {
      method: 'POST'
    });
  },

  async getHistory(params = {}) {
    const query = new URLSearchParams();
    if (params.category && params.category !== 'all') query.append('category', params.category);
    if (params.priority && params.priority !== 'all') query.append('priority', params.priority);
    if (params.search) query.append('search', params.search);
    if (params.limit) query.append('limit', params.limit);
    if (params.offset) query.append('offset', params.offset);

    return await apiFetch(`/history?${query.toString()}`);
  },

  async getStats() {
    return await apiFetch('/history/stats');
  },

  async getLatestAlert() {
    return await apiFetch('/history/latest');
  },

  async acknowledgeDetection(recordId) {
    return await apiFetch(`/history/${recordId}/acknowledge`, {
      method: 'POST'
    });
  },

  async deleteDetection(recordId) {
    return await apiFetch(`/history/${recordId}`, {
      method: 'DELETE'
    });
  },

  async clearHistory() {
    return await apiFetch('/history/clear', {
      method: 'POST'
    });
  },

  async getSettings() {
    return await apiFetch('/settings');
  },

  async updateSettings(settings) {
    return await apiFetch('/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
  },

  async getEdgeInfo() {
    return await apiFetch('/edge-info');
  }
};
