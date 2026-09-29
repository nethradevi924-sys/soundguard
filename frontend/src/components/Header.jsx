import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Cpu, 
  Lock, 
  Eye, 
  Type, 
  Bell, 
  BellRing,
  Sparkles,
  Radio
} from 'lucide-react';
import { notificationService } from '../services/notificationService';

export default function Header({
  isMonitoring,
  highContrast,
  onToggleHighContrast,
  largeText,
  onToggleLargeText,
  edgeStatus,
  onTriggerTestPopup
}) {
  const [hasNotificationPermission, setHasNotificationPermission] = useState(
    notificationService.isPermissionGranted()
  );

  const handleRequestNotifications = async () => {
    const granted = await notificationService.requestPermission();
    setHasNotificationPermission(granted);
    if (granted) {
      notificationService.showSystemNotification({
        sound_name: 'Alerts Active',
        sound_id: 'test',
        icon: '🔔',
        voice_phrase: 'SoundGuard pop-up alerts enabled.',
        priority: 'high',
        confidence_percent: 100
      });
    }
  };

  return (
    <header style={{
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px',
      padding: '4px 0'
    }}>
      {/* Brand & Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, #ef4444 0%, #06b6d4 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 18px rgba(6, 182, 212, 0.45)',
          flexShrink: 0
        }}>
          <ShieldAlert size={24} color="#ffffff" />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ 
              fontSize: '1.35rem', 
              fontWeight: '900', 
              letterSpacing: '-0.02em', 
              margin: 0,
              color: '#ffffff'
            }}>
              Sound<span style={{ color: '#10b981' }}>Guard</span>
            </h1>
            <span style={{
              fontSize: '0.62rem',
              fontWeight: '800',
              textTransform: 'uppercase',
              background: 'rgba(16, 185, 129, 0.16)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              padding: '2px 6px',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px'
            }}>
              <Cpu size={10} /> Snapdragon NPU
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
            <span style={{
              fontSize: '0.74rem',
              fontWeight: '600',
              color: 'var(--text-secondary)'
            }}>
              Real-Time Sound Protection
            </span>

            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>•</span>

            <span style={{
              fontSize: '0.72rem',
              fontWeight: '800',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: isMonitoring ? '#10b981' : '#94a3b8'
            }}>
              {isMonitoring ? '🟢 MONITORING ACTIVE' : '⚪ MONITORING OFF'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        
        {/* Test Pop-up Trigger */}
        <button
          onClick={onTriggerTestPopup}
          title="Test Pop-up Alert"
          style={{
            background: 'rgba(6, 182, 212, 0.15)',
            border: '1px solid rgba(6, 182, 212, 0.35)',
            color: '#38bdf8',
            padding: '7px 12px',
            borderRadius: '10px',
            fontSize: '0.76rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer'
          }}
        >
          <Sparkles size={13} />
          <span>Test Pop-up</span>
        </button>

        {/* Browser Notifications Permission Toggle */}
        <button
          onClick={handleRequestNotifications}
          title={hasNotificationPermission ? "Push alerts enabled" : "Enable push alerts"}
          style={{
            background: hasNotificationPermission ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
            border: hasNotificationPermission ? '1px solid #10b981' : '1px solid var(--border-subtle)',
            color: hasNotificationPermission ? '#10b981' : 'var(--text-secondary)',
            padding: '7px 10px',
            borderRadius: '10px',
            fontSize: '0.76rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer'
          }}
        >
          {hasNotificationPermission ? <BellRing size={14} /> : <Bell size={14} />}
        </button>

        {/* High Contrast Mode Switch */}
        <button
          onClick={onToggleHighContrast}
          title="Toggle High Contrast"
          style={{
            background: highContrast ? '#ffff00' : 'rgba(255, 255, 255, 0.08)',
            color: highContrast ? '#000000' : 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            padding: '7px 10px',
            borderRadius: '10px',
            fontSize: '0.76rem',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          <Eye size={14} />
        </button>

        {/* Large Text Mode Switch */}
        <button
          onClick={onToggleLargeText}
          title="Toggle Large Text"
          style={{
            background: largeText ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)',
            color: largeText ? '#000000' : 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            padding: '7px 10px',
            borderRadius: '10px',
            fontSize: '0.76rem',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          <Type size={14} />
        </button>
      </div>
    </header>
  );
}
