import React, { useEffect, useRef } from 'react';
import { X, Mic } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export const SyncedLyricsView: React.FC = () => {
  const { currentTrack, lyrics, currentTime, isLyricsOpen, setIsLyricsOpen, seek } = usePlayer();
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  const currentMs = currentTime * 1000;

  // Find active line index
  let activeIndex = -1;
  if (lyrics?.isSynced && lyrics.lines.length > 0) {
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (currentMs >= lyrics.lines[i].timeMs) {
        activeIndex = i;
      } else {
        break;
      }
    }
  }

  // Smooth scroll active line into center
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeIndex]);

  if (!isLyricsOpen || !currentTrack) return null;

  return (
    <div className="lyrics-fullscreen">
      <button 
        className="lyrics-close-btn" 
        onClick={() => setIsLyricsOpen(false)}
        title="Close Lyrics"
      >
        <X size={20} />
      </button>

      {/* Floating Track Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <img 
          src={currentTrack.thumbnailUrl} 
          alt={currentTrack.title} 
          style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
        />
        <div style={{ textAlign: 'left' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{currentTrack.title}</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{currentTrack.artist}</p>
        </div>
      </div>

      <div className="lyrics-container">
        {!lyrics || (lyrics.lines.length === 0 && !lyrics.plainLyrics) ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--text-dim)', padding: '60px 0' }}>
            <Mic size={40} />
            <p style={{ fontSize: '18px', fontWeight: 600 }}>Looking up synchronized lyrics...</p>
          </div>
        ) : lyrics.isSynced ? (
          lyrics.lines.map((line, idx) => {
            const isActive = idx === activeIndex;
            return (
              <div
                key={idx}
                ref={isActive ? activeLineRef : null}
                className={`lyric-line ${isActive ? 'active' : ''}`}
                onClick={() => seek(line.timeMs / 1000)}
              >
                {line.text}
              </div>
            );
          })
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '20px', lineHeight: '2', color: 'var(--text-muted)' }}>
            {lyrics.plainLyrics}
          </div>
        )}
      </div>
    </div>
  );
};
