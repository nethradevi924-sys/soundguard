import React, { useState } from 'react';
import { 
  Play, 
  Volume2, 
  Flame, 
  Car, 
  Bell, 
  Baby, 
  Dog, 
  DoorClosed, 
  ShieldAlert, 
  Sparkles,
  Zap,
  Mic
} from 'lucide-react';
import { audioService } from '../services/audioService';
import { nativeService } from '../services/nativeService';

const DEMO_SCENARIOS = [
  {
    id: 'fire_alarm',
    num: 'Demo 1',
    name: 'Fire Alarm',
    category: 'Emergency',
    priority: 'high',
    icon: '🔥',
    badge: 'High Priority Emergency',
    color: '#ef4444',
    description: 'T-3 repeating alarm pulses at 3.2 kHz. Triggers red modal, strobe screen flash, and high-urgency voice.',
    expectedVoice: 'Fire alarm detected.'
  },
  {
    id: 'car_horn',
    num: 'Demo 2',
    name: 'Car Horn',
    category: 'Environmental',
    priority: 'medium',
    icon: '🚗',
    badge: 'Medium Priority Environmental',
    color: '#f59e0b',
    description: 'Dual automotive blast (415 Hz + 495 Hz). Triggers amber visual alert and localized speech.',
    expectedVoice: 'Car horn detected nearby.'
  },
  {
    id: 'glass_breaking',
    num: 'Demo 3',
    name: 'Glass Breaking',
    category: 'Household',
    priority: 'high',
    icon: '🪟',
    badge: 'High Priority Household',
    color: '#ef4444',
    description: 'High-frequency shatter impact with resonant ringing. Critical for hearing-impaired home security.',
    expectedVoice: 'Glass breaking detected.'
  },
  {
    id: 'doorbell',
    num: 'Demo 4',
    name: 'Doorbell',
    category: 'Household',
    priority: 'medium',
    icon: '🔔',
    badge: 'Medium Priority Household',
    color: '#f59e0b',
    description: 'Traditional Ding-Dong chime (660 Hz -> 520 Hz). Visual notification for visitor arrival.',
    expectedVoice: 'Doorbell ringing.'
  },
  {
    id: 'siren',
    num: 'Demo Extra',
    name: 'Emergency Siren',
    category: 'Emergency',
    priority: 'high',
    icon: '🚨',
    badge: 'High Priority Emergency',
    color: '#ef4444',
    description: 'Frequency-modulated ambulance / police wail (800 Hz to 1400 Hz).',
    expectedVoice: 'Emergency siren detected.'
  },
  {
    id: 'baby_crying',
    num: 'Demo Extra',
    name: 'Baby Crying',
    category: 'Household',
    priority: 'medium',
    icon: '👶',
    badge: 'Medium Priority Household',
    color: '#f59e0b',
    description: 'Infant wailing acoustic profile with periodic pitch flutter and vocal formants.',
    expectedVoice: 'Baby crying detected.'
  },
  {
    id: 'dog_barking',
    num: 'Demo Extra',
    name: 'Dog Barking',
    category: 'Environmental',
    priority: 'low',
    icon: '🐕',
    badge: 'Low Priority Environmental',
    color: '#eab308',
    description: 'Short down-chirp barking bursts.',
    expectedVoice: 'Dog barking detected.'
  },
  {
    id: 'door_knocking',
    num: 'Demo Extra',
    name: 'Door Knocking',
    category: 'Household',
    priority: 'low',
    icon: '🚪',
    badge: 'Low Priority Household',
    color: '#eab308',
    description: 'Low-frequency wood impulse taps (180 Hz).',
    expectedVoice: 'Door knocking detected.'
  }
];

export default function DemoSimulator({ onTriggerSimulation }) {
  const [activeTestingId, setActiveTestingId] = useState(null);
  const [isRecordingReal, setIsRecordingReal] = useState(false);
  const [realTestResult, setRealTestResult] = useState(null);
  const [recordCountdown, setRecordCountdown] = useState(3);

  const handleRecordAndTest = async () => {
    if (isRecordingReal) return;
    setIsRecordingReal(true);
    setRealTestResult(null);
    setRecordCountdown(3);

    const timer = setInterval(() => {
      setRecordCountdown((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);

    try {
      const res = await nativeService.recordAndTestRealWorld();
      clearInterval(timer);
      if (res && res.success) {
        setRealTestResult(res);
      } else {
        setRealTestResult({ error: 'No audio captured or test failed' });
      }
    } catch (err) {
      clearInterval(timer);
      console.error('Record and test error:', err);
      setRealTestResult({ error: err?.message || 'Failed to record real audio' });
    } finally {
      setIsRecordingReal(false);
    }
  };

  const handleTestSound = async (scenario, playSpeakerSound = true) => {
    setActiveTestingId(scenario.id);

    try {
      if (playSpeakerSound) {
        // Play acoustic wave through speakers
        try {
          await audioService.playSynthesizedSound(scenario.id, 1.0);
        } catch (audioErr) {
          console.warn('Speaker sound synthesis non-fatal error:', audioErr);
        }
      }

      // Trigger AI Detection on backend and persist to SQLite
      if (onTriggerSimulation) {
        await onTriggerSimulation(scenario.id);
      }
    } catch (e) {
      console.error('Demo simulation error:', e);
    } finally {
      setTimeout(() => setActiveTestingId(null), 1000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Intro Banner */}
      <div className="glass-panel" style={{ padding: '24px', borderLeft: '6px solid #06b6d4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Sparkles size={24} color="#06b6d4" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0 }}>
            Interactive Demo Scenarios & Test Suite
          </h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '850px' }}>
          Test the full <strong>Hear → Understand → Alert → Show + Speak</strong> pipeline instantly.
          Click <strong>"🔊 Play Sound & Run AI"</strong> to synthesize authentic sound via your speakers and trigger the dual alert, or <strong>"⚡ Quick Test"</strong> for silent evaluation.
        </p>
      </div>

      {/* Real-World Microphone Record & Test Suite (Prompt Part 18) */}
      <div className="glass-panel" style={{
        padding: '24px',
        border: '1px solid rgba(16, 185, 129, 0.35)',
        background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.95) 100%)',
        borderRadius: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.4rem' }}>🎙️</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: '#ffffff' }}>
                Real-World Acoustic Test (3s Mic Analysis)
              </h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: '4px 0 0 0', maxWidth: '650px' }}>
              Clap, knock on a wooden door, clink a glass, or play a horn nearby. This records 3 seconds of real microphone audio, processes it through the 14-class ML engine, and reveals the top 5 predictions.
            </p>
          </div>

          <button
            onClick={handleRecordAndTest}
            disabled={isRecordingReal}
            style={{
              padding: '14px 22px',
              borderRadius: '14px',
              background: isRecordingReal 
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontSize: '0.95rem',
              fontWeight: '800',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              border: 'none',
              cursor: isRecordingReal ? 'default' : 'pointer',
              boxShadow: isRecordingReal 
                ? '0 0 20px rgba(239, 68, 68, 0.5)' 
                : '0 4px 18px rgba(16, 185, 129, 0.4)'
            }}
          >
            <Mic size={18} />
            <span>
              {isRecordingReal 
                ? `Recording Audio (${recordCountdown}s)...` 
                : 'Record 3s & Test AI'}
            </span>
          </button>
        </div>

        {/* Results breakdown */}
        {realTestResult && (
          <div style={{
            marginTop: '18px',
            padding: '16px',
            background: 'rgba(0,0,0,0.4)',
            borderRadius: '12px',
            border: realTestResult.isDanger ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)'
          }}>
            {realTestResult.error ? (
              <div style={{ color: '#ef4444', fontSize: '0.88rem' }}>⚠️ {realTestResult.error}</div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)' }}>PRIMARY PREDICTION</span>
                    <h4 style={{ margin: '2px 0 0 0', fontSize: '1.2rem', color: realTestResult.isDanger ? '#ef4444' : '#38bdf8' }}>
                      {realTestResult.soundName} ({realTestResult.confidencePercent}%)
                    </h4>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>AUDIO LEVEL</span>
                    <div style={{ fontWeight: '800', color: '#f59e0b' }}>{realTestResult.db} dB SPL</div>
                  </div>
                </div>

                {realTestResult.top5 && realTestResult.top5.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Top 5 Predictions & Confidence Distribution:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {realTestResult.top5.map((p, idx) => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem' }}>
                          <span style={{ width: '20px', color: 'var(--text-muted)' }}>#{idx + 1}</span>
                          <span style={{ width: '140px', fontWeight: '600', color: idx === 0 ? '#ffffff' : 'var(--text-secondary)' }}>
                            {p.name}
                          </span>
                          <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${p.confidencePercent}%`,
                              height: '100%',
                              background: idx === 0 ? (p.index === 13 ? '#94a3b8' : '#10b981') : 'rgba(56, 189, 248, 0.4)',
                              borderRadius: '4px'
                            }} />
                          </div>
                          <span style={{ width: '45px', textAlign: 'right', fontWeight: '700', color: idx === 0 ? '#10b981' : 'var(--text-muted)' }}>
                            {p.confidencePercent}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid of Scenarios */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px'
      }}>
        {DEMO_SCENARIOS.map(item => {
          const isTesting = activeTestingId === item.id;
          return (
            <div
              key={item.id}
              className="glass-panel"
              style={{
                padding: '22px',
                border: isTesting ? `2px solid ${item.color}` : '1px solid var(--border-subtle)',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '2.4rem' }}>{item.icon}</span>
                  <div>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      color: item.color,
                      letterSpacing: '0.05em'
                    }}>
                      {item.num}
                    </span>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '2px 0 0 0' }}>
                      {item.name}
                    </h3>
                  </div>
                </div>

                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  padding: '3px 9px',
                  borderRadius: '12px',
                  background: `${item.color}25`,
                  color: item.color,
                  border: `1px solid ${item.color}50`
                }}>
                  {item.priority.toUpperCase()}
                </span>
              </div>

              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '16px', minHeight: '40px' }}>
                {item.description}
              </p>

              <div style={{
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '8px',
                padding: '8px 12px',
                marginBottom: '16px',
                fontSize: '0.8rem',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Volume2 size={15} />
                <span>Voice: "{item.expectedVoice}"</span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleTestSound(item, true)}
                  disabled={isTesting}
                  style={{
                    flex: 2,
                    background: item.priority === 'high' 
                      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                      : 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)',
                    color: '#ffffff',
                    padding: '11px 14px',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: `0 4px 15px ${item.color}40`
                  }}
                >
                  <Play size={16} fill="#ffffff" />
                  <span>{isTesting ? 'Playing & Detecting...' : '🔊 Play Sound & Run AI'}</span>
                </button>

                <button
                  onClick={() => handleTestSound(item, false)}
                  disabled={isTesting}
                  title="Instant detection pipeline without speaker playback"
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    padding: '11px 10px',
                    borderRadius: '10px',
                    fontSize: '0.82rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <Zap size={14} color="#f59e0b" />
                  <span>Quick Test</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
