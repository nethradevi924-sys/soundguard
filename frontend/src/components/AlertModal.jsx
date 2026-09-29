import React, { useEffect, useState } from 'react';
import { 
  Check, 
  AlertOctagon, 
  Volume2, 
  Clock, 
  ShieldAlert, 
  Flame, 
  PhoneCall, 
  CheckCircle,
  X
} from 'lucide-react';
import { ttsService } from '../services/ttsService';
import { vibrationService } from '../services/vibrationService';

export default function AlertModal({
  alert,
  onAcknowledge,
  settings
}) {
  const [countdown, setCountdown] = useState(settings?.escalation_countdown_sec || 30);
  const [escalated, setEscalated] = useState(false);
  const [confirmedSafety, setConfirmedSafety] = useState(false);

  if (!alert) return null;

  const soundName = alert.sound_name || 'Dangerous Sound Detected';
  const confidencePercent = alert.confidence_percent || (alert.confidence ? Math.round(alert.confidence * 100) : 92);
  const dangerLevel = (alert.danger_level || alert.priority || 'HIGH').toUpperCase();
  const timeStr = alert.time_str || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const actionText = alert.action || 'Please check your surroundings.';

  const isHighPriority = alert.priority === 'high' || dangerLevel === 'HIGH';
  const theme = alert.theme || {
    badge_text: '🚨 ALERT',
    bg_color: isHighPriority ? '#dc2626' : '#d97706',
    border_color: isHighPriority ? '#ef4444' : '#f59e0b',
    glow_color: isHighPriority ? 'rgba(239, 68, 68, 0.7)' : 'rgba(245, 158, 11, 0.6)',
    flash_screen: isHighPriority
  };

  // Trigger TTS voice & vibration on alert appearance
  useEffect(() => {
    const isVoiceEnabled = settings ? settings.voice_enabled !== false : true;
    if (isVoiceEnabled && alert.voice_phrase) {
      ttsService.speak(alert.voice_phrase, {
        priority: alert.priority,
        rate: settings?.voice_rate || 1.0,
        pitch: settings?.voice_pitch || 1.0
      });
    }

    const isVibrationEnabled = settings ? settings.vibration_enabled !== false : true;
    if (isVibrationEnabled) {
      vibrationService.vibrate(
        isHighPriority ? [500, 150, 500, 150, 800] : [300, 120, 300]
      );
    }

    // Reset escalation countdown
    setCountdown(settings?.escalation_countdown_sec || 30);
    setEscalated(false);
    setConfirmedSafety(false);
  }, [alert.id]);

  // Escalation Countdown Timer for High Priority sounds
  useEffect(() => {
    if (!isHighPriority || !settings?.escalation_enabled || confirmedSafety) return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown reached 0 without acknowledgment -> Show Emergency Escalation Card
      setEscalated(true);
    }
  }, [countdown, isHighPriority, settings?.escalation_enabled, confirmedSafety]);

  // Keyboard accessibility: Escape or Enter to acknowledge
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleDismiss = () => {
    ttsService.stop();
    vibrationService.stop();
    setConfirmedSafety(true);
    if (onAcknowledge) onAcknowledge(alert);
  };

  return (
    <>
      {/* Optional Full Screen Flash for High Priority */}
      {isHighPriority && settings?.screen_flash_enabled && (
        <div className="screen-flash-emergency" />
      )}

      {/* Modal Overlay Backdrop */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '16px'
      }}>
        <div 
          className="modal-pop"
          style={{
            width: '100%',
            maxWidth: '620px',
            backgroundColor: '#0f172a',
            borderRadius: '24px',
            border: `4px solid ${theme.border_color}`,
            boxShadow: `0 0 50px ${theme.glow_color}, 0 25px 50px rgba(0, 0, 0, 0.8)`,
            overflow: 'hidden',
            color: '#ffffff'
          }}
        >
          {/* Header Banner */}
          <div style={{
            backgroundColor: theme.bg_color,
            padding: '18px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertOctagon size={26} color="#ffffff" />
              <span style={{
                fontSize: '1.15rem',
                fontWeight: '900',
                letterSpacing: '0.06em',
                textTransform: 'uppercase'
              }}>
                {theme.badge_text}
              </span>
            </div>

            <span style={{
              background: 'rgba(0, 0, 0, 0.35)',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: '700',
              textTransform: 'uppercase'
            }}>
              {alert.priority} Priority
            </span>
          </div>

          {/* Body Content */}
          <div style={{ padding: '32px 28px', textAlign: 'center' }}>
            
            {/* Massive Icon */}
            <div style={{
              fontSize: '5rem',
              lineHeight: 1,
              marginBottom: '16px',
              filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.5))'
            }}>
              {alert.icon || '🚨'}
            </div>

            {/* Headline */}
            <h2 style={{
              fontSize: '2.4rem',
              fontWeight: '900',
              letterSpacing: '-0.02em',
              marginBottom: '8px',
              textTransform: 'uppercase',
              color: '#ffffff'
            }}>
              {alert.headline || `${alert.sound_name} DETECTED`}
            </h2>

            {/* Spoken text / description */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '8px 16px',
              borderRadius: '20px',
              marginBottom: '24px',
              fontSize: '1rem',
              color: '#38bdf8'
            }}>
              <Volume2 size={18} />
              <span>"{alert.voice_phrase}"</span>
            </div>

            {/* Metadata Card: Time, Confidence, Category */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>CONFIDENCE</span>
                <strong style={{ fontSize: '1.4rem', color: theme.border_color }}>
                  {alert.confidence_percent}%
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>TIME</span>
                <strong style={{ fontSize: '1.1rem', color: '#ffffff' }}>
                  {alert.time_str}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>CATEGORY</span>
                <strong style={{ fontSize: '1rem', color: '#ffffff', textTransform: 'capitalize' }}>
                  {alert.category}
                </strong>
              </div>
            </div>

            {/* Highly Visible Danger Card (Requirement 4) */}
            <div style={{
              background: isHighPriority ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
              border: `2px solid ${isHighPriority ? '#ef4444' : '#f59e0b'}`,
              borderRadius: '16px',
              padding: '16px 20px',
              marginBottom: '20px',
              textAlign: 'left'
            }}>
              <div style={{ fontSize: '1.05rem', fontWeight: '900', color: isHighPriority ? '#fca5a5' : '#fde68a', marginBottom: '8px' }}>
                ⚠️ DANGEROUS SOUND DETECTED
              </div>
              <div style={{ fontSize: '0.92rem', color: '#ffffff', marginBottom: '4px' }}>
                <strong style={{ color: 'var(--text-muted)' }}>🔊 Sound:</strong> {soundName}
              </div>
              <div style={{ fontSize: '0.92rem', color: '#ffffff', marginBottom: '4px' }}>
                <strong style={{ color: 'var(--text-muted)' }}>📊 Confidence:</strong> {confidencePercent}%
              </div>
              <div style={{ fontSize: '0.92rem', color: '#ffffff', marginBottom: '4px' }}>
                <strong style={{ color: 'var(--text-muted)' }}>🚨 Danger Level:</strong> {dangerLevel}
              </div>
              <div style={{ fontSize: '0.92rem', color: '#ffffff', marginBottom: '4px' }}>
                <strong style={{ color: 'var(--text-muted)' }}>🕐 Time:</strong> {timeStr}
              </div>
              <div style={{ fontSize: '0.92rem', color: '#ffffff', marginTop: '6px' }}>
                <strong style={{ color: 'var(--text-muted)' }}>Action:</strong> {actionText}
              </div>
            </div>

            {/* Emergency Escalation Section if High Priority */}
            {isHighPriority && settings?.escalation_enabled && !escalated && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '14px',
                padding: '12px 18px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fca5a5' }}>
                  <ShieldAlert size={18} />
                  <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                    Confirm safety within countdown:
                  </span>
                </div>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: '800',
                  color: '#ffffff',
                  background: '#dc2626',
                  padding: '3px 12px',
                  borderRadius: '10px'
                }}>
                  {countdown}s
                </div>
              </div>
            )}

            {/* Escalated Emergency Contact Card */}
            {escalated && (
              <div style={{
                background: 'rgba(220, 38, 38, 0.25)',
                border: '2px dashed #ef4444',
                borderRadius: '16px',
                padding: '18px',
                marginBottom: '24px',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fca5a5', marginBottom: '8px' }}>
                  <PhoneCall size={20} color="#ef4444" />
                  <strong style={{ fontSize: '1rem' }}>Emergency Escalation Triggered</strong>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '14px' }}>
                  No acknowledgment received. You can send an immediate notification to your configured emergency contact:
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <a
                    href={`tel:${settings?.emergency_contact_phone || '911'}`}
                    style={{
                      flex: 1,
                      textDecoration: 'none',
                      background: '#ef4444',
                      color: '#ffffff',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      textAlign: 'center',
                      fontWeight: '700',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <PhoneCall size={16} />
                    <span>Call {settings?.emergency_contact_name || 'Emergency Contact'}</span>
                  </a>
                  <button
                    onClick={() => {
                      alert(`Safety alert SMS prepared for ${settings?.emergency_contact_name || 'Contact'}: "${alert.sound_name} detected at ${alert.time_str}"`);
                    }}
                    style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      fontWeight: '700',
                      fontSize: '0.9rem'
                    }}
                  >
                    Send Quick SMS
                  </button>
                </div>
              </div>
            )}

            {/* Massive Acknowledge Button */}
            <button
              onClick={handleDismiss}
              style={{
                width: '100%',
                padding: '18px 28px',
                fontSize: '1.35rem',
                fontWeight: '900',
                letterSpacing: '0.04em',
                borderRadius: '16px',
                backgroundColor: theme.bg_color,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                boxShadow: `0 8px 25px ${theme.glow_color}`,
                cursor: 'pointer'
              }}
            >
              <Check size={28} strokeWidth={3} />
              <span>[ ACKNOWLEDGE & DISMISS ]</span>
            </button>

            <span style={{
              display: 'block',
              marginTop: '12px',
              fontSize: '0.78rem',
              color: 'var(--text-muted)'
            }}>
              Press <strong>ENTER</strong>, <strong>SPACE</strong>, or click above to dismiss
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
