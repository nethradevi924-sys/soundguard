import React from 'react';
import { AlertOctagon, Check, Eye, X, Volume2 } from 'lucide-react';

export default function AlertBanner({
  alert,
  onOpenModal,
  onAcknowledge
}) {
  if (!alert) return null;

  const soundName = alert.sound_name || 'Dangerous Sound Detected';
  const confidencePercent = alert.confidence_percent || (alert.confidence ? Math.round(alert.confidence * 100) : 92);
  const priority = alert.priority || alert.danger_level || 'high';
  const timeStr = alert.time_str || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isHighPriority = priority.toLowerCase() === 'high';
  const bgColor = isHighPriority ? '#dc2626' : priority.toLowerCase() === 'medium' ? '#d97706' : '#ca8a04';
  const borderColor = isHighPriority ? '#ef4444' : priority.toLowerCase() === 'medium' ? '#f59e0b' : '#eab308';

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 40px)',
        maxWidth: '750px',
        backgroundColor: '#0f172a',
        borderRadius: '16px',
        border: `3px solid ${borderColor}`,
        boxShadow: `0 12px 40px rgba(0, 0, 0, 0.7), 0 0 25px ${borderColor}60`,
        zIndex: 99999,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        animation: 'modalPopIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          fontSize: '2.4rem',
          lineHeight: 1,
          filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))'
        }}>
          {alert.icon || '🚨'}
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: bgColor,
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: '900',
              padding: '2px 8px',
              borderRadius: '6px',
              textTransform: 'uppercase'
            }}>
              {priority} PRIORITY
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {timeStr}
            </span>
          </div>

          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: '900',
            color: '#ffffff',
            margin: '2px 0 0 0',
            textTransform: 'uppercase'
          }}>
            {soundName} DETECTED ({confidencePercent}%)
          </h3>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => onOpenModal(alert)}
          style={{
            background: 'rgba(255, 255, 255, 0.12)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            padding: '9px 14px',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer'
          }}
        >
          <Eye size={15} />
          <span>View</span>
        </button>

        <button
          onClick={() => onAcknowledge(alert)}
          style={{
            background: bgColor,
            color: '#ffffff',
            border: 'none',
            padding: '9px 18px',
            borderRadius: '10px',
            fontSize: '0.88rem',
            fontWeight: '800',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            boxShadow: `0 4px 15px ${borderColor}50`
          }}
        >
          <Check size={16} strokeWidth={3} />
          <span>Acknowledge</span>
        </button>
      </div>
    </div>
  );
}
