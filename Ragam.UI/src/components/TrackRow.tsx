import React from 'react';
import { Play, Loader2, Trash2 } from 'lucide-react';
import type { Track } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { AddToLibraryMenu } from './AddToLibraryMenu';

interface TrackRowProps {
  track: Track;
  index: number;
  trackList?: Track[];
  onRemove?: () => void;
}

export const TrackRow: React.FC<TrackRowProps> = ({ track, index, trackList, onRemove }) => {
  const { playTrack, currentTrack, isPlaying, isLoading } = usePlayer();
  const isCurrent = currentTrack?.id === track.id;

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      className={`track-row ${isCurrent ? 'active' : ''}`}
      onClick={() => playTrack(track, trackList || [track])}
      style={{ position: 'relative' }}
    >
      {/* Index / Play indicator */}
      <span style={{ fontSize: '13px', color: isCurrent ? 'var(--primary)' : 'var(--text-subdued)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isCurrent && isLoading ? (
          <Loader2 size={14} className="animate-spin" color="var(--primary)" />
        ) : isCurrent && isPlaying ? (
          <div className="sound-meter playing" style={{ height: '14px', gap: '2px' }} title="Playing">
            <span className="sound-bar" style={{ width: '2px' }} />
            <span className="sound-bar" style={{ width: '2px' }} />
            <span className="sound-bar" style={{ width: '2px' }} />
          </div>
        ) : isCurrent ? (
          <Play size={14} fill="var(--primary)" color="var(--primary)" />
        ) : (
          index + 1
        )}
      </span>

      {/* Title & Artist */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
        <img
          src={track.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop'}
          alt={track.title}
          style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover', background: '#282828' }}
          onError={(e) => {
            e.currentTarget.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop';
          }}
          loading="lazy"
        />
        <div style={{ overflow: 'hidden' }}>
          <div className="track-row-title" title={track.title}>
            {track.title}
          </div>
          <div className="track-row-artist" title={track.artist}>
            {track.artist}
          </div>
        </div>
      </div>

      {/* Album */}
      <div style={{ fontSize: '13px', color: 'var(--text-subdued)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {track.album || track.title}
      </div>

      {/* Duration */}
      <div style={{ fontSize: '13px', color: 'var(--text-subdued)', textAlign: 'right' }}>
        {formatDuration(track.duration)}
      </div>

      {/* Actions (Delete if in playlist, else Add to Library Menu) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        {onRemove ? (
          <button
            type="button"
            className="control-btn"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Remove from playlist"
            style={{ color: 'var(--text-subdued)', padding: '6px', borderRadius: '4px' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ff4d4d';
              e.currentTarget.style.backgroundColor = 'rgba(255, 77, 77, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-subdued)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Trash2 size={16} />
          </button>
        ) : (
          <AddToLibraryMenu track={track} iconSize={16} />
        )}
      </div>
    </div>
  );
};
