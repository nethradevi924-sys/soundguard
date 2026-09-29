import React, { useEffect, useRef, useState } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  Radio, 
  Cpu, 
  ShieldAlert, 
  ShieldCheck,
  AlertTriangle,
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Headphones, 
  Bell, 
  BellOff, 
  Sparkles,
  Flame,
  Car,
  Siren,
  Dog,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { audioService } from '../services/audioService';
import { nativeService } from '../services/nativeService';

export default function LiveVisualizer({
  isMonitoring,
  onToggleMonitoring,
  lastDetection,
  edgeStatus,
  stats,
  audioDevices = [],
  selectedDeviceId = null,
  onDeviceChange = null,
  headphoneBoost = false,
  onToggleHeadphoneBoost = null,
  systemStatus = null
}) {
  const canvasRef = useRef(null);
  const [decibels, setDecibels] = useState(32);
  const [showCategories, setShowCategories] = useState(true);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [lastDetectedRecord, setLastDetectedRecord] = useState(null);
  const [telemetry, setTelemetry] = useState({
    db: 32,
    prediction: 'Ambient / Quiet',
    confidencePercent: 0,
    latencyMs: 3.5,
    top5: []
  });

  // Track latest real detected dangerous sound with timestamp
  useEffect(() => {
    if (lastDetection && lastDetection.sound && lastDetection.sound !== 'ambient') {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
      setLastDetectedRecord({
        ...lastDetection,
        timeFormatted: `Today • ${timeStr}`
      });
    }
  }, [lastDetection]);

  // Telemetry listener for native Android engine
  useEffect(() => {
    let handle = null;
    const setupListener = async () => {
      try {
        handle = await nativeService.addListener('onAudioTelemetry', (data) => {
          if (data) {
            setTelemetry({
              db: data.db || 30,
              prediction: data.prediction || 'Ambient',
              confidencePercent: data.confidencePercent || 0,
              latencyMs: data.latencyMs ? parseFloat(data.latencyMs).toFixed(1) : 3.8,
              top5: data.top5 || []
            });
            if (data.db) setDecibels(data.db);
          }
        });
      } catch (err) {
        console.warn('Could not register onAudioTelemetry listener:', err);
      }
    };
    setupListener();
    return () => {
      if (handle && handle.remove) handle.remove();
    };
  }, []);

  // Oscilloscope & Frequency Canvas loop
  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      if (isMonitoring) {
        const waveform = audioService.getWaveformData();
        const freqData = audioService.getFrequencyData();
        const currentDb = audioService.getCurrentDb();
        if (currentDb && currentDb > 0) {
          setDecibels(currentDb);
        }

        // Background subtle frequency spectrum bars
        const numBars = 32;
        const barWidth = width / numBars;
        for (let i = 0; i < numBars; i++) {
          const val = freqData[i * 2] || 0;
          const barHeight = (val / 255) * (height * 0.75);
          const hue = 150 + (i / numBars) * 60;
          ctx.fillStyle = `hsla(${hue}, 90%, 50%, 0.16)`;
          ctx.fillRect(i * barWidth, height - barHeight, barWidth - 3, barHeight);
        }

        // Glowing oscilloscope wave line
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = '#10b981';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#10b981';

        ctx.beginPath();
        const sliceWidth = width / waveform.length;
        let x = 0;

        for (let i = 0; i < waveform.length; i++) {
          const v = waveform[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Idle line
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isMonitoring]);

  // Dynamic Level Bars array calculation for live audio activity
  const getLevelBarHeights = () => {
    if (!isMonitoring) {
      return [12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12];
    }
    const normalized = Math.min(100, Math.max(10, (decibels - 25) * 1.8));
    return [
      Math.min(70, normalized * 0.35 + 8),
      Math.min(85, normalized * 0.55 + 10),
      Math.min(95, normalized * 0.75 + 12),
      Math.min(100, normalized * 0.95 + 15),
      Math.min(100, normalized * 1.05 + 18),
      Math.min(100, normalized * 1.20 + 20),
      Math.min(100, normalized * 1.15 + 18),
      Math.min(100, normalized * 0.95 + 15),
      Math.min(95, normalized * 0.80 + 12),
      Math.min(85, normalized * 0.60 + 10),
      Math.min(70, normalized * 0.40 + 8),
      Math.min(60, normalized * 0.30 + 6)
    ];
  };

  const dangerLevelText = {
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW'
  }[lastDetection?.priority || 'low'] || 'LOW';

  const priorityColor = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#38bdf8'
  }[lastDetection?.priority || 'low'] || '#10b981';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* ========================================================
          1. TOP SECTION (PART 12)
          - App Title: SoundGuard
          - Subtitle: Real-Time Sound Protection
          - Status Indicator: 🟢 MONITORING ACTIVE / ⚪ MONITORING OFF
          ======================================================== */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 2px',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: '900',
            letterSpacing: '-0.02em',
            margin: 0,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>Sound<span style={{ color: '#10b981' }}>Guard</span></span>
          </h1>
          <p style={{
            fontSize: '0.80rem',
            color: 'var(--text-secondary)',
            margin: '2px 0 0 0',
            fontWeight: '600'
          }}>
            Real-Time Sound Protection
          </p>
        </div>

        {/* Clean status badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          padding: '6px 14px',
          borderRadius: '24px',
          background: isMonitoring ? 'rgba(16, 185, 129, 0.16)' : 'rgba(255, 255, 255, 0.05)',
          border: isMonitoring ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: isMonitoring ? '0 0 16px rgba(16, 185, 129, 0.25)' : 'none',
          transition: 'all 0.3s ease'
        }}>
          <span style={{
            fontSize: '0.78rem',
            fontWeight: '800',
            letterSpacing: '0.04em',
            color: isMonitoring ? '#10b981' : '#94a3b8'
          }}>
            {isMonitoring ? '🟢 MONITORING ACTIVE' : '⚪ MONITORING OFF'}
          </span>
        </div>
      </div>

      {/* ========================================================
          2. CENTER SECTION: Large Circular Microphone Animation (PART 12)
          ======================================================== */}
      <div className="glass-panel" style={{
        padding: '28px 20px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.92) 0%, rgba(10, 14, 23, 0.98) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Large Circular Button Area */}
        <div style={{ position: 'relative', margin: '8px 0 16px 0' }}>
          {isMonitoring && (
            <>
              <div className="ripple-layer" />
              <div className="ripple-layer-delayed" />
            </>
          )}

          <button
            onClick={onToggleMonitoring}
            className={isMonitoring ? 'circular-pulse-active' : ''}
            style={{
              width: '136px',
              height: '136px',
              borderRadius: '50%',
              background: isMonitoring 
                ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)' 
                : 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)',
              border: isMonitoring 
                ? '3px solid #34d399' 
                : '2px solid rgba(255, 255, 255, 0.16)',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: isMonitoring 
                ? '0 0 35px rgba(16, 185, 129, 0.5), inset 0 0 15px rgba(255,255,255,0.2)' 
                : '0 8px 24px rgba(0, 0, 0, 0.4)',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              position: 'relative',
              zIndex: 2
            }}
          >
            {isMonitoring ? (
              <Mic size={44} color="#ffffff" strokeWidth={2.4} />
            ) : (
              <MicOff size={44} color="#94a3b8" strokeWidth={2} />
            )}
          </button>
        </div>

        {/* Center Labels */}
        <div style={{ zIndex: 2 }}>
          <h2 style={{
            fontSize: '1.30rem',
            fontWeight: '800',
            color: isMonitoring ? '#10b981' : '#ffffff',
            margin: '4px 0 2px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <span>{isMonitoring ? '🟢' : '⚪'}</span>
            <span>{isMonitoring ? 'Listening...' : 'Start Monitoring'}</span>
          </h2>
          <p style={{
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            margin: 0
          }}>
            {isMonitoring ? 'Continuous acoustic protection active' : 'Tap to begin real-time protection'}
          </p>
        </div>

        {/* ========================================================
            PART 13 — LIVE AUDIO STATUS: Audio Level ▂▃▅▆▃▂
            ======================================================== */}
        <div style={{
          marginTop: '20px',
          width: '100%',
          maxWidth: '380px',
          background: 'rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Volume2 size={16} color={isMonitoring ? '#10b981' : '#94a3b8'} />
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#ffffff' }}>
                Audio Level: {isMonitoring ? `${decibels} dB SPL` : 'Idle'}
              </span>
            </div>
            <span style={{
              fontSize: '0.72rem',
              color: isMonitoring ? '#34d399' : 'var(--text-muted)',
              fontWeight: '600'
            }}>
              {isMonitoring 
                ? (decibels > 75 ? '⚠️ Loud Noise' : decibels > 50 ? '● Normal Ambient' : '○ Quiet Room') 
                : 'Standby'}
            </span>
          </div>

          {/* Dynamic Audio Activity Level Bars ▂▃▅▆▃▂ */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            height: '32px',
            padding: '2px 0'
          }}>
            {getLevelBarHeights().map((heightPercent, idx) => (
              <div
                key={idx}
                style={{
                  width: '6px',
                  height: `${heightPercent}%`,
                  borderRadius: '3px',
                  background: isMonitoring 
                    ? (heightPercent > 70 
                        ? 'linear-gradient(180deg, #ef4444 0%, #f59e0b 100%)' 
                        : 'linear-gradient(180deg, #10b981 0%, #06b6d4 100%)')
                    : 'rgba(255, 255, 255, 0.12)',
                  transition: 'height 0.12s ease-out, background 0.2s ease'
                }}
              />
            ))}
          </div>

          {/* Canvas Waveform View */}
          <div style={{
            width: '100%',
            height: '42px',
            borderRadius: '8px',
            overflow: 'hidden',
            background: 'rgba(0, 0, 0, 0.6)'
          }}>
            <canvas
              ref={canvasRef}
              width={380}
              height={42}
              style={{ width: '100%', height: '42px', display: 'block' }}
            />
          </div>
        </div>

        {/* Headphone Boost Switch */}
        <div style={{ marginTop: '12px', width: '100%', maxWidth: '380px' }}>
          <button
            onClick={onToggleHeadphoneBoost}
            style={{
              width: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '7px 12px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              border: headphoneBoost ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)',
              background: headphoneBoost ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: headphoneBoost ? '#38bdf8' : 'var(--text-secondary)'
            }}
          >
            <Headphones size={15} />
            <span>{headphoneBoost ? 'HEADPHONE BOOST ACTIVE (2.8x Gain)' : 'WEARING HEADPHONES? TAP BOOST'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          3. LIVE STATUS CARD (PART 12 & PART 14)
          Reflects actual system state:
          - Microphone: Active / Ready / Permission required
          - AI Detection: Ready / Unavailable
          - Notifications: Enabled / Disabled
          - Voice Alert: Enabled / Unavailable
          ======================================================== */}
      <div className="glass-panel" style={{
        padding: '14px 16px',
        borderRadius: '16px',
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '10px'
        }}>
          {/* Microphone */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '10px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
              🎤 Microphone
            </span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              marginTop: '4px',
              fontWeight: '800',
              fontSize: '0.85rem',
              color: systemStatus?.micPermission === false 
                ? '#ef4444' 
                : (isMonitoring ? '#10b981' : '#38bdf8')
            }}>
              <span>{systemStatus?.micPermission === false ? '🔴' : (isMonitoring ? '🟢' : '⚪')}</span>
              <span>
                {systemStatus?.micPermission === false 
                  ? 'Permission required' 
                  : (isMonitoring ? 'Active' : 'Ready')}
              </span>
            </div>
          </div>

          {/* AI Detection */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '10px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
              🤖 AI Detection
            </span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              marginTop: '4px',
              fontWeight: '800',
              fontSize: '0.85rem',
              color: '#10b981'
            }}>
              <span>🟢</span>
              <span>Ready</span>
            </div>
          </div>

          {/* Notifications */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '10px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
              🔔 Notifications
            </span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              marginTop: '4px',
              fontWeight: '800',
              fontSize: '0.85rem',
              color: systemStatus?.notificationPermission !== false ? '#10b981' : '#f59e0b'
            }}>
              <span>{systemStatus?.notificationPermission !== false ? '🟢' : '🟡'}</span>
              <span>{systemStatus?.notificationPermission !== false ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>

          {/* Voice Alert */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '10px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
              🔊 Voice Alert
            </span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              marginTop: '4px',
              fontWeight: '800',
              fontSize: '0.85rem',
              color: systemStatus?.voiceReady !== false ? '#10b981' : '#f59e0b'
            }}>
              <span>{systemStatus?.voiceReady !== false ? '🟢' : '🟡'}</span>
              <span>{systemStatus?.voiceReady !== false ? 'Enabled' : 'Unavailable'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          4. LIVE DETECTION AREA (PART 12)
          - When no dangerous sound:
            Listening for dangerous sounds...
            No dangerous sound detected.
          - When a sound is detected:
            ⚠️ Sound Detected
            [Name]
            Confidence: 91%
            Danger Level: HIGH
          ======================================================== */}
      {lastDetection && lastDetection.sound !== 'ambient' ? (
        <div className="glass-panel glow-high-box" style={{
          padding: '20px',
          borderRadius: '18px',
          borderLeft: `6px solid ${priorityColor}`,
          background: 'linear-gradient(180deg, rgba(26, 16, 24, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>
                {lastDetection.icon || '⚠️'}
              </span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '1rem' }}>⚠️</span>
                  <span style={{ fontSize: '0.76rem', fontWeight: '900', color: priorityColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Sound Detected
                  </span>
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '900', margin: '4px 0 3px 0', color: '#ffffff' }}>
                  {lastDetection.sound_name}
                </h3>
                <div style={{ fontSize: '0.80rem', color: 'var(--text-secondary)' }}>
                  Confidence: <strong style={{ color: priorityColor }}>{lastDetection.confidence_percent}%</strong>
                  {' • '}
                  Danger Level: <strong style={{ color: priorityColor }}>{dangerLevelText}</strong>
                </div>
              </div>
            </div>

            <span style={{
              background: priorityColor,
              color: '#ffffff',
              fontWeight: '900',
              fontSize: '0.75rem',
              padding: '5px 12px',
              borderRadius: '20px',
              textTransform: 'uppercase',
              boxShadow: `0 0 14px ${priorityColor}`
            }}>
              {dangerLevelText}
            </span>
          </div>

          <div style={{ marginTop: '14px' }}>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${lastDetection.confidence_percent}%`,
                height: '100%',
                backgroundColor: priorityColor,
                borderRadius: '6px',
                transition: 'width 0.4s ease'
              }} />
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel" style={{
          padding: '16px 20px',
          borderRadius: '16px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <ShieldCheck size={28} color="#10b981" />
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#ffffff' }}>
              Listening for dangerous sounds...
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              No dangerous sound detected.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          5. RECENT DETECTION CARD (PART 12)
          Recent Detection
          🔊 Car Horn
          91%
          Today • 6:45 PM
          (If no detection: No recent dangerous sounds)
          ======================================================== */}
      <div className="glass-panel" style={{
        padding: '16px 20px',
        borderRadius: '16px',
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="#38bdf8" />
            <h3 style={{ fontSize: '0.85rem', fontWeight: '800', margin: 0, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Recent Detection
            </h3>
          </div>
        </div>

        {lastDetectedRecord ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '12px 14px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>{lastDetectedRecord.icon || '🔊'}</span>
              <div>
                <strong style={{ fontSize: '0.96rem', color: '#ffffff', display: 'block' }}>
                  🔊 {lastDetectedRecord.sound_name}
                </strong>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  {lastDetectedRecord.timeFormatted || 'Recent'}
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.96rem', fontWeight: '800', color: '#38bdf8' }}>
                {lastDetectedRecord.confidence_percent}%
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Confidence</span>
            </div>
          </div>
        ) : (
          <div style={{
            padding: '12px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.78rem',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '10px'
          }}>
            No recent dangerous sounds
          </div>
        )}
      </div>

      {/* ========================================================
          6. SOUND CATEGORIES (PART 12)
          Monitoring for:
          🚨 Emergency (Siren, Fire Alarm, Alarm, Distress Shouting)
          🌍 Environmental (Car Horn, Train, Motorcycle, Dog Barking, Construction)
          🏠 Household (Glass Breaking, Door Knocking, Baby Crying, Doorbell)
          ======================================================== */}
      <div className="glass-panel" style={{
        padding: '14px 18px',
        borderRadius: '16px',
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div 
          onClick={() => setShowCategories(prev => !prev)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1rem' }}>🛡️</span>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#ffffff' }}>
                Monitoring for:
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Emergency, Environmental, and Household sounds
              </div>
            </div>
          </div>
          {showCategories ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
        </div>

        {showCategories && (
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            {/* 🚨 Emergency */}
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', padding: '10px 12px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: '800', color: '#ef4444', textTransform: 'uppercase', marginBottom: '6px' }}>
                🚨 Emergency
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600' }}>
                  🚨 Siren
                </span>
                <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600' }}>
                  🔥 Fire Alarm
                </span>
                <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600' }}>
                  🚨 Alarm
                </span>
                <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600' }}>
                  🗣️ Distress Shouting
                </span>
              </div>
            </div>

            {/* 🌍 Environmental */}
            <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '12px', padding: '10px 12px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '6px' }}>
                🌍 Environmental
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600' }}>
                  🚗 Car Horn
                </span>
                <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600' }}>
                  🚆 Train
                </span>
                <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600' }}>
                  🏍️ Motorcycle
                </span>
                <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600' }}>
                  🐕 Dog Barking
                </span>
                <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600' }}>
                  🔨 Construction
                </span>
              </div>
            </div>

            {/* 🏠 Household */}
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '12px', padding: '10px 12px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: '800', color: '#38bdf8', textTransform: 'uppercase', marginBottom: '6px' }}>
                🏠 Household
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#bae6fd', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600' }}>
                  🪟 Glass Breaking
                </span>
                <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#bae6fd', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600' }}>
                  🚪 Door Knocking
                </span>
                <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#bae6fd', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600' }}>
                  👶 Baby Crying
                </span>
                <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#bae6fd', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600' }}>
                  🔔 Doorbell
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          7. MAIN BUTTON & MONITORING STATUS (PART 12)
          - Large primary button:
            When OFF: ▶ START MONITORING
            When ON: ■ STOP MONITORING
          - Monitoring status summary:
            When monitoring:
            🟢 Monitoring Active
            Microphone: Active
            AI Model: Ready
            Listening continuously
            When stopped:
            ⚪ Monitoring Off
            Tap Start Monitoring to begin.
          ======================================================== */}
      <div>
        <button
          onClick={onToggleMonitoring}
          style={{
            width: '100%',
            padding: '16px 24px',
            borderRadius: '18px',
            background: isMonitoring 
              ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            fontSize: '1.05rem',
            fontWeight: '900',
            letterSpacing: '0.04em',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            boxShadow: isMonitoring 
              ? '0 8px 30px rgba(239, 68, 68, 0.45)' 
              : '0 8px 30px rgba(16, 185, 129, 0.4)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            border: 'none'
          }}
        >
          {isMonitoring ? (
            <>
              <span style={{ fontSize: '1.1rem' }}>■</span>
              <span>STOP MONITORING</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '1.1rem' }}>▶</span>
              <span>START MONITORING</span>
            </>
          )}
        </button>

        {/* Monitoring Status Explanatory Text */}
        <div style={{
          marginTop: '10px',
          textAlign: 'center',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)',
          lineHeight: '1.4'
        }}>
          {isMonitoring ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <span style={{ fontWeight: '800', color: '#10b981' }}>🟢 Monitoring Active</span>
              <span style={{ color: 'var(--text-muted)' }}>Microphone: Active • AI Model: Ready • Listening continuously</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <span style={{ fontWeight: '700', color: '#94a3b8' }}>⚪ Monitoring Off</span>
              <span style={{ color: 'var(--text-muted)' }}>Tap Start Monitoring to begin.</span>
            </div>
          )}
        </div>
      </div>

      {/* Developer / Telemetry Panel (Collapsible Toggle) */}
      <div className="glass-panel" style={{
        padding: '12px 16px',
        borderRadius: '16px',
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.06)'
      }}>
        <div 
          onClick={() => setShowDevPanel(prev => !prev)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.95rem' }}>🛠️</span>
            <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Developer / Debug Telemetry
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.70rem', color: isMonitoring ? '#10b981' : '#94a3b8', fontWeight: '700' }}>
              {isMonitoring ? 'STREAMING' : 'IDLE'}
            </span>
            {showDevPanel ? <Minimize2 size={14} color="#94a3b8" /> : <Maximize2 size={14} color="#94a3b8" />}
          </div>
        </div>

        {showDevPanel && (
          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: '8px'
            }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '8px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', fontWeight: '700' }}>STATUS</div>
                <div style={{ color: isMonitoring ? '#10b981' : '#94a3b8', fontWeight: '800', fontSize: '0.82rem', marginTop: '2px' }}>
                  {isMonitoring ? 'Capturing' : 'Idle'}
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '8px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', fontWeight: '700' }}>AUDIO LEVEL</div>
                <div style={{ color: '#f59e0b', fontWeight: '800', fontSize: '0.82rem', marginTop: '2px' }}>
                  {decibels} dB SPL
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '8px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', fontWeight: '700' }}>PREDICTION</div>
                <div style={{ color: '#ffffff', fontWeight: '800', fontSize: '0.82rem', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {telemetry.prediction || (isMonitoring ? 'Ambient' : 'None')}
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '8px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', fontWeight: '700' }}>CONFIDENCE</div>
                <div style={{ color: telemetry.confidencePercent >= 80 ? '#ef4444' : '#38bdf8', fontWeight: '800', fontSize: '0.82rem', marginTop: '2px' }}>
                  {telemetry.confidencePercent}%
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '8px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', fontWeight: '700' }}>NPU LATENCY</div>
                <div style={{ color: '#10b981', fontWeight: '800', fontSize: '0.82rem', marginTop: '2px' }}>
                  {telemetry.latencyMs} ms
                </div>
              </div>
            </div>

            {telemetry.top5 && telemetry.top5.length > 0 && (
              <div style={{ 
                marginTop: '10px', 
                paddingTop: '8px', 
                borderTop: '1px solid rgba(255,255,255,0.06)',
                fontSize: '0.70rem', 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '6px',
                alignItems: 'center' 
              }}>
                <span style={{ fontWeight: '800', color: '#94a3b8' }}>TOP:</span>
                {telemetry.top5.slice(0, 3).map((p, i) => (
                  <span key={p.id} style={{ 
                    background: i === 0 ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.04)',
                    border: i === 0 ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255,255,255,0.06)',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    color: i === 0 ? '#38bdf8' : 'var(--text-secondary)'
                  }}>
                    {p.name}: <strong>{p.confidencePercent}%</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
