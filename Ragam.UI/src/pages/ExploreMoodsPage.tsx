import React, { useEffect, useState } from 'react';
import { ArrowLeft, Search, Sparkles } from 'lucide-react';
import type { MoodAndGenreItem, NavigationTarget } from '../types';
import { bridge } from '../services/bridge';

interface ExploreMoodsPageProps {
  onNavigate: (target: NavigationTarget) => void;
}

export const ExploreMoodsPage: React.FC<ExploreMoodsPageProps> = ({ onNavigate }) => {
  const [moods, setMoods] = useState<MoodAndGenreItem[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bridge.getExploreMoods()
      .then((items) => {
        if (items && items.length > 0) {
          setMoods(items);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load explore moods:', err);
        setLoading(false);
      });
  }, []);

  const filteredMoods = moods.filter((m) =>
    m.title.toLowerCase().includes(searchFilter.toLowerCase().trim())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          padding: '24px 28px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => onNavigate({ tab: 'home' })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: '500px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
          >
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--primary)',
              background: 'rgba(255, 84, 0, 0.1)',
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 84, 0, 0.3)'
            }}
          >
            <Sparkles size={13} />
            <span>Explore All</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
              Moods & Genres
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-subdued)' }}>
              Explore curated playlists and music collections across diverse vibes and languages
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '500px',
              padding: '8px 16px',
              width: '280px'
            }}
          >
            <Search size={16} color="var(--text-subdued)" />
            <input
              type="text"
              placeholder="Filter moods & genres..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: '13px',
                width: '100%'
              }}
            />
          </div>
        </div>
      </div>

      {/* Grid of Mood Buttons */}
      {loading ? (
        <div className="mood-grid">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '48px', borderRadius: '8px' }} />
          ))}
        </div>
      ) : (
        <div className="mood-grid">
          {filteredMoods.map((mood, idx) => (
            <div
              key={`${mood.title}_${idx}`}
              className="mood-btn"
              onClick={() => onNavigate({ tab: 'mood', mood })}
            >
              <div
                className="mood-stripe"
                style={{ backgroundColor: mood.stripeColor || '#FF5400' }}
              />
              <span className="mood-title">{mood.title}</span>
            </div>
          ))}

          {filteredMoods.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-subdued)' }}>
              No categories match "{searchFilter}".
            </div>
          )}
        </div>
      )}
    </div>
  );
};
