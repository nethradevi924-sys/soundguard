import React, { useState } from 'react';
import { 
  Sliders, 
  Volume2, 
  Eye, 
  Smartphone, 
  Zap, 
  ShieldAlert, 
  Cpu, 
  Check, 
  Save, 
  RotateCcw,
  Bell,
  Lock
} from 'lucide-react';

export default function SettingsPanel({
  settings,
  onSaveSettings,
  edgeStatus
}) {
  const [formData, setFormData] = useState({ ...settings });
  const [savedNotice, setSavedNotice] = useState(false);

  const handleToggle = (key) => {
    setFormData(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSoundToggle = (soundId) => {
    setFormData(prev => ({
      ...prev,
      enabled_sounds: {
        ...prev.enabled_sounds,
        [soundId]: !prev.enabled_sounds?.[soundId]
      }
    }));
  };

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  // Grouped sounds for the checklist
  const soundGroups = [
    {
      category: 'Emergency Sounds 🚨 (High Priority)',
      sounds: [
        { id: 'fire_alarm', name: 'Fire Alarm', icon: '🔥' },
        { id: 'siren', name: 'Emergency Siren', icon: '🚨' },
        { id: 'security_alarm', name: 'Security Alarm', icon: '🚪' },
        { id: 'distress_shouting', name: 'Distress Shouting / Screams', icon: '🆘' },
      ]
    },
    {
      category: 'Household Sounds 🏠',
      sounds: [
        { id: 'glass_breaking', name: 'Glass Breaking (High Priority)', icon: '🪟' },
        { id: 'doorbell', name: 'Doorbell Chime', icon: '🔔' },
        { id: 'baby_crying', name: 'Baby Crying', icon: '👶' },
        { id: 'door_knocking', name: 'Door Knocking', icon: '🚪' },
      ]
    },
    {
      category: 'Environmental Sounds 🌍',
      sounds: [
        { id: 'car_horn', name: 'Car Horn', icon: '🚗' },
        { id: 'train', name: 'Train / Railway', icon: '🚆' },
        { id: 'motorcycle', name: 'Motorcycle Passing', icon: '🏍️' },
        { id: 'dog_barking', name: 'Dog Barking', icon: '🐕' },
        { id: 'construction_noise', name: 'Construction Noise', icon: '🔨' },
      ]
    }
  ];

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Save Bar */}
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0 }}>
            Assistant Configuration & Accessibility Settings
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Customize alerts, sensitivity thresholds, monitored sound classes, and emergency contact details.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {savedNotice && (
            <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={16} /> Settings Saved Locally!
            </span>
          )}
          <button
            type="submit"
            style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)',
              color: '#ffffff',
              padding: '10px 22px',
              borderRadius: '10px',
              fontSize: '0.9rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 15px rgba(6, 182, 212, 0.4)'
            }}
          >
            <Save size={16} />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Section 1: Alert Feedback Modes */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} color="#06b6d4" />
            <span>Dual Alert System Settings</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Voice Alert Toggle */}
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <strong style={{ fontSize: '0.92rem', display: 'block' }}>🔊 Voice Alerts (Text-to-Speech)</strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Speaks the detected sound name aloud</span>
              </div>
              <input
                type="checkbox"
                checked={formData.voice_enabled}
                onChange={() => handleToggle('voice_enabled')}
                style={{ width: '20px', height: '20px', accentColor: '#06b6d4' }}
              />
            </label>

            {/* Visual Pop-up Toggle */}
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <strong style={{ fontSize: '0.92rem', display: 'block' }}>📱 Visual Pop-up Notifications</strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Displays large high-contrast alert card</span>
              </div>
              <input
                type="checkbox"
                checked={formData.visual_enabled}
                onChange={() => handleToggle('visual_enabled')}
                style={{ width: '20px', height: '20px', accentColor: '#06b6d4' }}
              />
            </label>

            {/* Vibration Toggle */}
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <strong style={{ fontSize: '0.92rem', display: 'block' }}>📳 Haptic Vibration Alert</strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Vibrates device when sounds are detected</span>
              </div>
              <input
                type="checkbox"
                checked={formData.vibration_enabled}
                onChange={() => handleToggle('vibration_enabled')}
                style={{ width: '20px', height: '20px', accentColor: '#06b6d4' }}
              />
            </label>

            {/* Screen Flash Toggle */}
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <strong style={{ fontSize: '0.92rem', display: 'block' }}>⚡ Emergency Screen Flash</strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Flashes display red for High Priority emergencies</span>
              </div>
              <input
                type="checkbox"
                checked={formData.screen_flash_enabled}
                onChange={() => handleToggle('screen_flash_enabled')}
                style={{ width: '20px', height: '20px', accentColor: '#ef4444' }}
              />
            </label>

            {/* Speech Rate Slider */}
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Speech Speed</span>
                <strong>{formData.voice_rate}x</strong>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.4"
                step="0.1"
                value={formData.voice_rate}
                onChange={(e) => handleChange('voice_rate', parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#06b6d4' }}
              />
            </div>
          </div>
        </div>

        {/* Section 2: AI Detection & Cooldown Settings */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={18} color="#06b6d4" />
            <span>AI Sensitivity & Cooldown</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Confidence Threshold */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '4px' }}>
                <div>
                  <strong style={{ display: 'block' }}>Confidence Threshold</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Minimum certainty to trigger notification</span>
                </div>
                <strong style={{ color: '#38bdf8', fontSize: '1.1rem' }}>
                  {Math.round(formData.confidence_threshold * 100)}%
                </strong>
              </div>
              <input
                type="range"
                min="0.50"
                max="0.95"
                step="0.05"
                value={formData.confidence_threshold}
                onChange={(e) => handleChange('confidence_threshold', parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#06b6d4' }}
              />
            </div>

            {/* Debounce Cooldown */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '4px' }}>
                <div>
                  <strong style={{ display: 'block' }}>Duplicate Alert Cooldown</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Suppresses alert spam for continuous sounds</span>
                </div>
                <strong style={{ color: '#f59e0b', fontSize: '1.1rem' }}>
                  {formData.cooldown_seconds}s
                </strong>
              </div>
              <input
                type="range"
                min="3"
                max="25"
                step="1"
                value={formData.cooldown_seconds}
                onChange={(e) => handleChange('cooldown_seconds', parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#f59e0b' }}
              />
            </div>

            {/* Edge AI Engine Selection */}
            <div>
              <strong style={{ fontSize: '0.88rem', display: 'block', marginBottom: '6px' }}>
                Edge AI Runtime Target
              </strong>
              <select
                value={formData.runtime_engine}
                onChange={(e) => handleChange('runtime_engine', e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              >
                <option value="Snapdragon_QNN_NPU">Qualcomm Snapdragon NPU / QNN (Recommended)</option>
                <option value="ONNX_Runtime_Edge">ONNX Runtime Edge (CPU / DirectML)</option>
                <option value="Native_DSP_Neural">Native NumPy DSP & Acoustic Classifier</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Emergency Escalation Settings */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} color="#ef4444" />
            <span>Emergency Escalation (Safety Protocol)</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <strong style={{ fontSize: '0.92rem', display: 'block' }}>Emergency Countdown Confirmation</strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Requires user to confirm safety on High Priority alerts</span>
              </div>
              <input
                type="checkbox"
                checked={formData.escalation_enabled}
                onChange={() => handleToggle('escalation_enabled')}
                style={{ width: '20px', height: '20px', accentColor: '#ef4444' }}
              />
            </label>

            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Emergency Contact Name
              </label>
              <input
                type="text"
                value={formData.emergency_contact_name}
                onChange={(e) => handleChange('emergency_contact_name', e.target.value)}
                placeholder="e.g. Caregiver / Family Member"
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#ffffff',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Emergency Contact Phone
              </label>
              <input
                type="text"
                value={formData.emergency_contact_phone}
                onChange={(e) => handleChange('emergency_contact_phone', e.target.value)}
                placeholder="e.g. +1 555-0199"
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#ffffff',
                  fontSize: '0.85rem'
                }}
              />
            </div>
          </div>
        </div>

        {/* Section 4: Monitored Sound Checklist */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '16px' }}>
            Monitored Sounds Checklist (13 Classes)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {soundGroups.map((group, gIdx) => (
              <div key={gIdx}>
                <h4 style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  {group.category}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                  {group.sounds.map(snd => {
                    const isEnabled = formData.enabled_sounds?.[snd.id] !== false;
                    return (
                      <label
                        key={snd.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: isEnabled ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.2)',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: isEnabled ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                          cursor: 'pointer',
                          fontSize: '0.82rem'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => handleSoundToggle(snd.id)}
                          style={{ accentColor: '#06b6d4' }}
                        />
                        <span>{snd.icon} {snd.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </form>
  );
}
