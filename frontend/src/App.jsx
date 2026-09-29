import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import LiveVisualizer from './components/LiveVisualizer';
import AlertModal from './components/AlertModal';
import AlertBanner from './components/AlertBanner';
import DemoSimulator from './components/DemoSimulator';
import HistoryList from './components/HistoryList';
import SettingsPanel from './components/SettingsPanel';

import { apiService } from './services/apiService';
import { audioService } from './services/audioService';
import { notificationService } from './services/notificationService';
import { ttsService } from './services/ttsService';
import { nativeService } from './services/nativeService';

import './styles/index.css';
import './styles/animations.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [activeAlert, setActiveAlert] = useState(null);
  const [bannerAlert, setBannerAlert] = useState(null);
  const [lastDetection, setLastDetection] = useState(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [edgeStatus, setEdgeStatus] = useState(null);
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [micError, setMicError] = useState(null);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [lastSeenAlertId, setLastSeenAlertId] = useState(null);
  const [systemStatus, setSystemStatus] = useState({
    micPermission: true,
    notificationPermission: true,
    voiceReady: true,
    modelReady: true,
    isMonitoring: false
  });

  // Load initial settings, history, stats, telemetry, audio devices, and native listener
  useEffect(() => {
    loadSettings();
    loadHistory();
    loadStats();
    loadEdgeInfo();
    loadAudioDevices();

    // Check Native Android System Status & Listen for onAlertTriggered events
    let alertSub = null;
    if (nativeService.isNative) {
      nativeService.checkStatus().then(st => {
        if (st) {
          setSystemStatus(st);
          if (st.isMonitoring !== undefined) setIsMonitoring(st.isMonitoring);
        }
      });

      nativeService.addListener('onAlertTriggered', (alert) => {
        console.log('Native onAlertTriggered event received:', alert);
        triggerDualAlert(alert);
      }).then(sub => { alertSub = sub; });
    }

    return () => {
      if (alertSub && alertSub.remove) alertSub.remove();
    };
  }, []);

  const loadAudioDevices = async () => {
    try {
      const devices = await audioService.getAudioDevices();
      setAudioDevices(devices);
      if (devices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(devices[0].deviceId);
      }
    } catch (e) {
      console.warn('Could not enumerate audio devices:', e);
    }
  };

  const loadSettings = async () => {
    try {
      const s = await apiService.getSettings();
      setSettings(s);
    } catch (e) {
      console.warn('Using default settings:', e);
    }
  };

  const loadHistory = async () => {
    try {
      if (nativeService.isNative) {
        const res = await nativeService.getHistory(100);
        setHistory(res?.history || []);
      } else {
        const data = await apiService.getHistory({ limit: 50 });
        setHistory(data.history || []);
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  };

  const loadStats = async () => {
    if (nativeService.isNative) return;
    try {
      const s = await apiService.getStats();
      setStats(s);
    } catch (e) {
      console.warn('Failed to load stats:', e);
    }
  };

  const loadEdgeInfo = async () => {
    if (nativeService.isNative) {
      setEdgeStatus({ device: 'On-Device Snapdragon NPU', status: 'optimal', latency_ms: 10 });
      return;
    }
    try {
      const info = await apiService.getEdgeInfo();
      setEdgeStatus(info);
    } catch (e) {
      console.warn('Failed to load edge info:', e);
    }
  };

  // Dispatches Dual Alert: Pop-up Modal + Banner + System Notification + Sound Chime + TTS
  const triggerDualAlert = useCallback((alertPayload) => {
    if (!alertPayload) return;

    // 1. In-App Modal Pop-up & Banner
    setActiveAlert(alertPayload);
    setBannerAlert(alertPayload);

    // If running in browser mode (not native Android), use web fallbacks
    if (!nativeService.isNative) {
      // 2. Play Audio Chime
      notificationService.playAlertChime(alertPayload.priority);

      // 3. System OS Pop-up Notification (Desktop / Mobile)
      notificationService.showSystemNotification(alertPayload);

      // 4. Instant AI TTS Voice Announcement
      if (alertPayload.voice_phrase) {
        ttsService.speak(alertPayload.voice_phrase, {
          priority: alertPayload.priority,
          rate: settings?.voice_rate || 1.0,
          pitch: settings?.voice_pitch || 1.0
        });
      }
    }

    // 5. Update History and Stats immediately
    loadHistory();
    loadStats();
  }, [settings]);

  // Live Alert Poller: Used only for browser mode when connected to Python server
  useEffect(() => {
    if (nativeService.isNative) return;

    const pollInterval = setInterval(async () => {
      try {
        const data = await apiService.getLatestAlert();
        if (data && data.latest_alert) {
          const alert = data.latest_alert;
          if (alert.id !== lastSeenAlertId && (!activeAlert || activeAlert.id !== alert.id)) {
            setLastSeenAlertId(alert.id);
            triggerDualAlert(alert);
          }
        }
      } catch (e) {
        // Background poll
      }
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [lastSeenAlertId, activeAlert, triggerDualAlert]);

  // Process incoming audio frames from microphone
  const handleAudioFrame = useCallback(async (base64Audio, sampleRate) => {
    try {
      const res = await apiService.detectAudio(base64Audio, sampleRate);
      if (res && res.detection) {
        setLastDetection(res.detection);

        // Check if a valid alert was triggered (not ambient)
        if (res.alert && res.detection.should_alert) {
          triggerDualAlert(res.alert);
        }
      }
    } catch (e) {
      console.error('Error during audio detection:', e);
    }
  }, [triggerDualAlert]);

  const [headphoneBoost, setHeadphoneBoost] = useState(false);

  // Toggle Live Monitoring with chosen device
  const toggleMonitoring = async () => {
    setMicError(null);
    if (!isMonitoring) {
      try {
        if (nativeService.isNative) {
          await nativeService.requestPermissions();
          const res = await nativeService.startMonitoring();
          if (res && res.success) {
            setIsMonitoring(true);
            const st = await nativeService.checkStatus();
            if (st) setSystemStatus(st);
          }
        } else {
          await audioService.startListening(handleAudioFrame, selectedDeviceId);
          setIsMonitoring(true);
          // Re-enumerate audio devices now that mic permission is active so real labels are shown
          await loadAudioDevices();
          // Request notifications permission in advance
          notificationService.requestPermission();
        }
      } catch (err) {
        console.error('Microphone access failed:', err);
        let msg = 'Could not access microphone.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          msg = 'Microphone permission blocked. In Android Settings > Apps > SoundGuard > Permissions, allow Microphone access, then tap Start again.';
        } else if (err.message && err.message.includes('secure connection')) {
          msg = err.message;
        } else if (err.name === 'NotFoundError') {
          msg = 'No physical microphone hardware detected.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          msg = 'Microphone is currently in use by another app (call or voice recorder). Close other audio apps and try again.';
        } else {
          msg = `Microphone error: ${err.message || 'Initialization failed'}`;
        }
        setMicError(msg);
        setIsMonitoring(false);
      }
    } else {
      if (nativeService.isNative) {
        await nativeService.stopMonitoring();
        const st = await nativeService.checkStatus();
        if (st) setSystemStatus(st);
      } else {
        audioService.stopListening();
      }
      setIsMonitoring(false);
    }
  };

  const handleToggleHeadphoneBoost = () => {
    setHeadphoneBoost(prev => {
      const next = !prev;
      audioService.setGainMultiplier(next ? 2.8 : 1.0);
      return next;
    });
  };

  const handleDeviceChange = async (newDeviceId) => {
    setSelectedDeviceId(newDeviceId);
    if (isMonitoring) {
      audioService.stopListening();
      try {
        await audioService.startListening(handleAudioFrame, newDeviceId);
      } catch (e) {
        console.warn('Failed to switch audio input device:', e);
      }
    }
  };

  // Trigger Demo Scenario simulation (Unified Alert Pipeline)
  const handleTriggerSimulation = async (soundId) => {
    try {
      if (nativeService.isNative) {
        const res = await nativeService.quickTest(soundId);
        if (res && res.alert) {
          triggerDualAlert(res.alert);
        }
      } else {
        const res = await apiService.simulateSound(soundId);
        if (res && res.detection) {
          setLastDetection(res.detection);
          if (res.alert) {
            triggerDualAlert(res.alert);
          }
        }
      }
    } catch (e) {
      console.error('Simulation trigger failed:', e);
    }
  };

  // Instant Pop-up Test Button handler - triggers Fire Alarm alert pipeline
  const handleTriggerTestPopup = async () => {
    try {
      if (nativeService.isNative) {
        const res = await nativeService.testPopup();
        if (res && res.alert) {
          triggerDualAlert(res.alert);
        }
      } else {
        await handleTriggerSimulation('fire_alarm');
      }
    } catch (e) {
      console.error('Test popup failed:', e);
    }
  };

  // Acknowledge Detection Modal
  const handleAcknowledgeAlert = async (alert) => {
    if (alert && alert.db_record_id) {
      await apiService.acknowledgeDetection(alert.db_record_id);
      loadHistory();
    }
    setActiveAlert(null);
    setBannerAlert(null);
  };

  // Delete / Clear History Handlers
  const handleDeleteHistory = async (recordId) => {
    await apiService.deleteDetection(recordId);
    loadHistory();
    loadStats();
  };

  const handleClearAllHistory = async () => {
    if (window.confirm('Are you sure you want to clear all detection history?')) {
      if (nativeService.isNative) {
        await nativeService.clearHistory();
      } else {
        await apiService.clearHistory();
      }
      loadHistory();
      loadStats();
    }
  };

  const handleSaveSettings = async (updated) => {
    setSettings(updated);
    await apiService.updateSettings(updated);
  };

  // Accessibility classes
  useEffect(() => {
    if (highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
  }, [highContrast]);

  useEffect(() => {
    if (largeText) {
      document.body.classList.add('large-text');
    } else {
      document.body.classList.remove('large-text');
    }
  }, [largeText]);

  // Unread high priority count for bottom nav badge
  const unreadCount = history.filter(h => h.priority === 'high' && !h.acknowledged).length;

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '16px 14px 20px 14px' }}>
      
      {/* Floating Pop-up Banner on active alert */}
      <AlertBanner
        alert={bannerAlert}
        onOpenModal={(alert) => setActiveAlert(alert)}
        onAcknowledge={handleAcknowledgeAlert}
      />

      {/* Sleek App Header */}
      <Header
        isMonitoring={isMonitoring}
        highContrast={highContrast}
        onToggleHighContrast={() => setHighContrast(prev => !prev)}
        largeText={largeText}
        onToggleLargeText={() => setLargeText(prev => !prev)}
        edgeStatus={edgeStatus}
        onTriggerTestPopup={handleTriggerTestPopup}
      />

      {/* Microphone Permission Error Notice */}
      {micError && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid #ef4444',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '16px',
          color: '#fca5a5',
          fontSize: '0.85rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>⚠️ {micError}</span>
          <button 
            onClick={() => setMicError(null)} 
            style={{ background: 'transparent', color: '#ffffff', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Views */}
      <main>
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Live Visualizer & Big Central Control */}
            <LiveVisualizer
              isMonitoring={isMonitoring}
              onToggleMonitoring={toggleMonitoring}
              lastDetection={lastDetection}
              edgeStatus={edgeStatus}
              stats={stats}
              audioDevices={audioDevices}
              selectedDeviceId={selectedDeviceId}
              onDeviceChange={handleDeviceChange}
              headphoneBoost={headphoneBoost}
              onToggleHeadphoneBoost={handleToggleHeadphoneBoost}
              systemStatus={systemStatus}
            />

            {/* Quick Demo Section on Dashboard */}
            <DemoSimulator onTriggerSimulation={handleTriggerSimulation} />
          </div>
        )}

        {activeTab === 'demo' && (
          <DemoSimulator onTriggerSimulation={handleTriggerSimulation} />
        )}

        {activeTab === 'history' && (
          <HistoryList
            history={history}
            onRefresh={loadHistory}
            onAcknowledge={async (id) => {
              await apiService.acknowledgeDetection(id);
              loadHistory();
            }}
            onDelete={handleDeleteHistory}
            onClearAll={handleClearAllHistory}
            stats={stats}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPanel
            settings={settings || {}}
            onSaveSettings={handleSaveSettings}
            edgeStatus={edgeStatus}
          />
        )}
      </main>

      {/* Dual Alert Pop-up Modal */}
      <AlertModal
        alert={activeAlert}
        onAcknowledge={handleAcknowledgeAlert}
        settings={settings}
      />

      {/* Native Mobile App Dock Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        unreadAlertsCount={unreadCount}
      />
    </div>
  );
}
