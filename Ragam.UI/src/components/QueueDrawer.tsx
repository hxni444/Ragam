import React from 'react';
import { X, Play, Pause, ListMusic, Loader2, Radio } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { AddToLibraryMenu } from './AddToLibraryMenu';

export const QueueDrawer: React.FC = () => {
  const { 
    queue, 
    queueIndex, 
    currentTrack, 
    isPlaying, 
    isLoading, 
    isQueueOpen, 
    setIsQueueOpen, 
    playTrack, 
    togglePlay,
    isSmartRadioActive,
    isSmartRadioLoading,
    startSmartRadio
  } = usePlayer();

  if (!isQueueOpen) return null;

  const nextTracks = queue.slice(queueIndex + 1);

  return (
    <div style={{
      position: 'fixed',
      top: 'calc(var(--titlebar-height) + 12px)',
      right: '16px',
      bottom: '112px',
      width: '380px',
      background: 'rgba(32, 32, 38, 0.95)',
      backdropFilter: 'blur(24px)',
      border: '1px solid rgba(255, 255, 255, 0.16)',
      borderRadius: '16px',
      zIndex: 90,
      display: 'flex',
      flexDirection: 'column',
      padding: '20px',
      boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.6)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ListMusic size={22} color="var(--primary)" />
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>Play Queue</h3>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-subdued)', background: '#242424', padding: '2px 8px', borderRadius: '500px' }}>
            {queue.length} songs
          </span>
        </div>

        <button 
          className="control-btn" 
          onClick={() => setIsQueueOpen(false)}
          title="Close Queue"
          style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#242424' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Radio Mix Banner - Only shown when Radio is active */}
      {isSmartRadioActive && currentTrack && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          marginBottom: '16px',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          transition: 'all 0.2s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              {isSmartRadioLoading ? <Loader2 size={16} className="animate-spin" /> : <Radio size={16} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                Radio Mix
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-subdued)' }}>
                Queue similar tracks based on this song
              </span>
            </div>
          </div>

          <button
            onClick={() => startSmartRadio()}
            disabled={isSmartRadioLoading}
            style={{
              background: 'var(--primary)',
              border: 'none',
              color: '#000',
              fontSize: '12px',
              fontWeight: 700,
              padding: '6px 14px',
              borderRadius: '20px',
              cursor: isSmartRadioLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isSmartRadioLoading ? 0.7 : 1,
              transition: 'transform 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            title="Mix similar songs into queue"
          >
            {isSmartRadioLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Mixing...</span>
              </>
            ) : (
              <span>Mix Now</span>
            )}
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Section 1: Now Playing */}
        {currentTrack && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subdued)', marginBottom: '10px' }}>
              Now Playing
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px',
              borderRadius: '8px',
              background: '#181818',
              border: '1px solid var(--border-subtle)',
              position: 'relative'
            }}>
              <div style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
                <img 
                  src={currentTrack.thumbnailUrl} 
                  alt={currentTrack.title} 
                  style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover' }}
                />
                <button
                  onClick={togglePlay}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    border: 'none',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    opacity: 0,
                    transition: 'opacity 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                >
                  {isPlaying ? <Pause size={18} fill="#fff" color="#fff" /> : <Play size={18} fill="#fff" color="#fff" />}
                </button>
              </div>

              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentTrack.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-subdued)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                  {currentTrack.artist}
                </div>
              </div>

              {/* Actions: Add to Library + Sound Meter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AddToLibraryMenu track={currentTrack} iconSize={16} />

                {isLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }} title="Loading song...">
                    <Loader2 size={20} className="animate-spin" color="var(--primary)" />
                  </div>
                ) : (
                  <div className={`sound-meter ${isPlaying ? 'playing' : ''}`} title={isPlaying ? "Playing" : "Paused"}>
                    <span className="sound-bar" />
                    <span className="sound-bar" />
                    <span className="sound-bar" />
                    <span className="sound-bar" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Next in Queue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subdued)', marginBottom: '4px' }}>
            Next in Queue {nextTracks.length > 0 && `(${nextTracks.length})`}
          </div>

          {nextTracks.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-subdued)', padding: '32px 0', fontSize: '13px' }}>
              No more tracks in queue
            </div>
          ) : (
            nextTracks.map((track, idx) => {
              const actualIdx = queueIndex + 1 + idx;
              return (
                <div
                  key={`${track.id}_${actualIdx}`}
                  onClick={() => playTrack(track, queue)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: '#181818',
                    border: '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#242424';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#181818';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-subdued)', width: '18px', textAlign: 'center' }}>
                    {idx + 1}
                  </span>

                  <img 
                    src={track.thumbnailUrl} 
                    alt={track.title} 
                    style={{ width: '38px', height: '38px', borderRadius: '4px', objectFit: 'cover' }}
                  />

                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {track.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-subdued)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                      {track.artist}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => startSmartRadio(track)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-subdued)',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      title={`Start Smart Radio from ${track.title}`}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subdued)')}
                    >
                      <Radio size={15} />
                    </button>
                    <AddToLibraryMenu track={track} iconSize={15} />
                    <button
                      onClick={() => playTrack(track, queue)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-subdued)',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      title={`Play ${track.title}`}
                    >
                      <Play size={15} fill="currentColor" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
