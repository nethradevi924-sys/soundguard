import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Trash2, 
  Download, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Lock,
  RefreshCw
} from 'lucide-react';

export default function HistoryList({
  history,
  onRefresh,
  onAcknowledge,
  onDelete,
  onClearAll,
  stats
}) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Client-side filtering
  const filteredHistory = history.filter(item => {
    const matchCat = categoryFilter === 'all' || item.category === categoryFilter;
    const matchPrio = priorityFilter === 'all' || item.priority === priorityFilter;
    const matchSearch = !searchTerm || 
      item.sound_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sound_id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchPrio && matchSearch;
  });

  const getPriorityBadge = (prio) => {
    const color = {
      high: '#ef4444',
      medium: '#f59e0b',
      low: '#eab308'
    }[prio] || '#64748b';

    return (
      <span style={{
        fontSize: '0.72rem',
        fontWeight: '800',
        padding: '3px 8px',
        borderRadius: '12px',
        background: `${color}25`,
        color: color,
        border: `1px solid ${color}50`,
        textTransform: 'uppercase'
      }}>
        {prio}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Header Card with Stats & Actions */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0 }}>
              Detection History & Logs
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '0.8rem', color: '#10b981' }}>
              <Lock size={13} />
              <span>Privacy Verified: No raw audio is stored. Only detection metadata is kept locally.</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <a
              href="/api/history/export?format=csv"
              download="soundguard_detections.csv"
              style={{
                textDecoration: 'none',
                background: 'rgba(6, 182, 212, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                padding: '9px 16px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Download size={15} />
              <span>Export CSV</span>
            </a>

            <button
              onClick={onClearAll}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '9px 16px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Trash2 size={15} />
              <span>Clear History</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-subtle)'
        }}>
          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            <input
              type="text"
              placeholder="Search sound name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '10px 12px 10px 36px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem'
              }}
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '10px 14px',
              color: 'var(--text-primary)',
              fontSize: '0.85rem'
            }}
          >
            <option value="all">All Categories</option>
            <option value="emergency">🚨 Emergency Only</option>
            <option value="environmental">🌍 Environmental Only</option>
            <option value="household">🏠 Household Only</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '10px 14px',
              color: 'var(--text-primary)',
              fontSize: '0.85rem'
            }}
          >
            <option value="all">All Priorities</option>
            <option value="high">🔴 High Priority</option>
            <option value="medium">🟠 Medium Priority</option>
            <option value="low">🟡 Low Priority</option>
          </select>

          <button
            onClick={onRefresh}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '10px 16px',
              fontSize: '0.85rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* History Items List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredHistory.length > 0 ? (
          filteredHistory.map(item => (
            <div
              key={item.id}
              className="glass-panel"
              style={{
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '14px',
                borderLeft: `5px solid ${item.priority === 'high' ? '#ef4444' : item.priority === 'medium' ? '#f59e0b' : '#eab308'}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '2rem' }}>{item.icon || '🔊'}</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h4 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0 }}>
                      {item.sound_name}
                    </h4>
                    {getPriorityBadge(item.priority)}
                    <span style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      textTransform: 'capitalize'
                    }}>
                      • {item.category}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={13} /> {item.time_str}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} /> {item.date_str}
                    </span>
                    <span>
                      Confidence: <strong style={{ color: '#38bdf8' }}>{item.confidence_percent}%</strong>
                    </span>
                    <span>
                      Danger Level: <strong style={{ 
                        color: item.priority === 'high' ? '#ef4444' : item.priority === 'medium' ? '#f59e0b' : '#eab308',
                        textTransform: 'uppercase'
                      }}>{item.danger_level || item.priority}</strong>
                    </span>
                    <span>
                      Source: <strong style={{ color: '#a78bfa' }}>{item.source || 'Microphone'}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions: Acknowledge & Delete */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {item.acknowledged ? (
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.8rem',
                    color: '#10b981',
                    background: 'rgba(16, 185, 129, 0.1)',
                    padding: '4px 10px',
                    borderRadius: '8px'
                  }}>
                    <CheckCircle2 size={14} /> Acknowledged
                  </span>
                ) : (
                  <button
                    onClick={() => onAcknowledge(item.id)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: '600'
                    }}
                  >
                    Acknowledge
                  </button>
                )}

                <button
                  onClick={() => onDelete(item.id)}
                  title="Delete record"
                  style={{
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    border: 'none',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '1rem', marginBottom: '8px' }}>No detection events found matching your criteria.</p>
            <p style={{ fontSize: '0.85rem' }}>Start monitoring or run a sound in the Demo Simulator to generate events.</p>
          </div>
        )}
      </div>
    </div>
  );
}
