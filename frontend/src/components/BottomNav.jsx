import React from 'react';
import { Shield, History, Settings } from 'lucide-react';

export default function BottomNav({ activeTab, onTabChange, unreadAlertsCount = 0 }) {
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: Shield },
    { id: 'history', label: 'History', icon: History, badge: unreadAlertsCount },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav style={{
      position: 'fixed',
      bottom: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: '480px',
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      borderRadius: '24px',
      padding: '8px 12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      boxShadow: '0 12px 35px rgba(0, 0, 0, 0.6), 0 0 20px rgba(6, 182, 212, 0.15)',
      zIndex: 9999
    }}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              background: isActive ? 'rgba(6, 182, 212, 0.16)' : 'transparent',
              color: isActive ? '#38bdf8' : 'var(--text-secondary)',
              border: isActive ? '1px solid rgba(6, 182, 212, 0.35)' : '1px solid transparent',
              borderRadius: '16px',
              padding: '8px 6px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              position: 'relative'
            }}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            <span style={{
              fontSize: '0.72rem',
              fontWeight: isActive ? '800' : '600',
              letterSpacing: '0.02em'
            }}>
              {tab.label}
            </span>

            {/* Badge for history / alerts */}
            {tab.badge > 0 && (
              <span style={{
                position: 'absolute',
                top: '4px',
                right: '18%',
                background: '#ef4444',
                color: '#ffffff',
                fontSize: '0.62rem',
                fontWeight: '900',
                padding: '1px 5px',
                borderRadius: '10px',
                lineHeight: 1.2
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
