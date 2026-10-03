import { AddToLibraryMenu } from '../components/AddToLibraryMenu';
import React, { useState, useEffect } from 'react';
import { Play, ListMusic, Trash2, Clock } from 'lucide-react';
import type { Playlist, NavigationTarget } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { TrackRow } from '../components/TrackRow';
import { bridge } from '../services/bridge';

interface PlaylistDetailPageProps {
  playlist: Playlist;
  onNavigate: (target: NavigationTarget) => void;
}

export const PlaylistDetailPage: React.FC<PlaylistDetailPageProps> = ({ playlist: initialPlaylist, onNavigate }) => {
  const [playlist, setPlaylist] = useState<Playlist>(initialPlaylist);
  const { playTrack } = usePlayer();

  const refreshPlaylist = async () => {
    try {
      const allPlaylists = await bridge.getPlaylists();
      const updated = allPlaylists.find((p) => p.id === initialPlaylist.id);
      if (updated) {
        setPlaylist(updated);
      }
    } catch (err) {
      console.error('Failed to refresh playlist details:', err);
    }
  };

  useEffect(() => {
    setPlaylist(initialPlaylist);
    refreshPlaylist();
    const unsub = bridge.onLibraryChange(() => {
      refreshPlaylist();
    });
    return () => unsub();
  }, [initialPlaylist.id]);

  const handlePlayPlaylist = () => {
    if (playlist.tracks && playlist.tracks.length > 0) {
      playTrack(playlist.tracks[0], playlist.tracks);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Delete playlist "${playlist.name}"?`)) {
      await bridge.deletePlaylist(playlist.id);
      onNavigate({ tab: 'library' });
    }
  };

  const handleRemoveTrack = async (trackId: string) => {
    try {
      await bridge.removeFromPlaylist(playlist.id, trackId);
      setPlaylist((prev) => ({
        ...prev,
        tracks: (prev.tracks || []).filter((t) => t.id !== trackId)
      }));
    } catch (err) {
      console.error('Failed to remove track:', err);
    }
  };

  const totalDurationSeconds = playlist.tracks?.reduce((acc, t) => acc + (t.duration || 0), 0) || 0;

  const formatTotalDuration = (totalSecs: number) => {
    if (totalSecs <= 0) return '';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs} hr ${mins > 0 ? `${mins} min` : ''}`.trim();
    }
    if (mins > 0) {
      return `${mins} min ${secs > 0 ? `${secs} sec` : ''}`.trim();
    }
    return `${secs} sec`;
  };

  const coverUrl = playlist.coverUrl || (playlist.tracks && playlist.tracks.length > 0 ? playlist.tracks[0].thumbnailUrl : null);
  const trackCount = playlist.tracks?.length || 0;
  const durationText = formatTotalDuration(totalDurationSeconds);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Hero Banner */}
      <div className="detail-hero">
        <div style={{
          width: '220px',
          height: '220px',
          borderRadius: '8px',
          background: '#282828',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7)'
        }}>
          {coverUrl ? (
            <img 
              src={coverUrl} 
              alt={playlist.name} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <ListMusic size={64} color="#b3b3b3" />
          )}
        </div>

        <div className="detail-meta">
          <span className="detail-type">Playlist</span>
          <h1 className="detail-title">{playlist.name}</h1>
          <div className="detail-desc">
            {playlist.description || 'Custom user playlist'} • {trackCount} {trackCount === 1 ? 'song' : 'songs'}{durationText ? `, ${durationText}` : ''}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '8px 0' }}>
        <button
          onClick={handlePlayPlaylist}
          disabled={!playlist.tracks || playlist.tracks.length === 0}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: !playlist.tracks || playlist.tracks.length === 0 ? '#333' : 'var(--primary)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: !playlist.tracks || playlist.tracks.length === 0 ? 'not-allowed' : 'pointer',
            boxShadow: '0 8px 24px var(--primary-glow)',
            transition: 'transform 0.15s ease'
          }}
          onMouseEnter={(e) => { if (playlist.tracks && playlist.tracks.length > 0) e.currentTarget.style.transform = 'scale(1.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          title="Play playlist"
        >
          <Play size={24} fill="#000" color="#000" style={{ transform: 'translateX(2px)' }} />
        </button>

        {playlist.tracks && playlist.tracks.length > 0 && (
          <AddToLibraryMenu 
            tracks={playlist.tracks} 
            iconSize={18} 
            label="Add to Playlist"
            align="left"
            className="control-btn"
            buttonStyle={{
              padding: '10px 18px',
              borderRadius: '500px',
              fontSize: '13px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          />
        )}

        <button
          className="control-btn"
          onClick={handleDelete}
          title="Delete Playlist"
        >
          <Trash2 size={22} />
        </button>
      </div>

      {/* Tracklist Table */}
      <div className="track-table">
        <div className="track-table-header">
          <span>#</span>
          <span>Title</span>
          <span>Album</span>
          <span style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
            <Clock size={14} style={{ display: 'inline', flexShrink: 0 }} />
            {durationText && (
              <span style={{ fontSize: '11px', textTransform: 'none', fontWeight: 600, color: 'var(--text-subdued)', letterSpacing: 'normal' }}>
                {durationText}
              </span>
            )}
          </span>
          <span></span>
        </div>

        {playlist.tracks && playlist.tracks.map((track, idx) => (
          <TrackRow
            key={`${track.id}_${idx}`}
            track={track}
            index={idx}
            trackList={playlist.tracks}
            onRemove={() => handleRemoveTrack(track.id)}
          />
        ))}

        {(!playlist.tracks || playlist.tracks.length === 0) && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-subdued)' }}>
            <p style={{ fontSize: '16px', fontWeight: 600 }}>This playlist is empty</p>
            <p style={{ fontSize: '13px', marginTop: '6px' }}>Click the "+" button on any track row to add songs here.</p>
          </div>
        )}
      </div>
    </div>
  );
};
