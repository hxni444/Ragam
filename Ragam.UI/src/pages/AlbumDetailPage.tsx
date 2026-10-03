import { AddToLibraryMenu } from '../components/AddToLibraryMenu';
import React, { useState, useEffect } from 'react';
import { Play, Clock } from 'lucide-react';
import type { Album, Track } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { TrackRow } from '../components/TrackRow';
import { bridge } from '../services/bridge';

interface AlbumDetailPageProps {
  album: Album;
}

export const AlbumDetailPage: React.FC<AlbumDetailPageProps> = ({ album }) => {
  const { playTrack } = usePlayer();
  const [tracks, setTracks] = useState<Track[]>(album.tracks || []);
  const [loading, setLoading] = useState<boolean>(!album.tracks || album.tracks.length === 0);

  useEffect(() => {
    if (!album.tracks || album.tracks.length === 0) {
      setLoading(true);
      bridge.getAlbumOrPlaylist(album.title, album.artist, album.thumbnailUrl, album.id)
        .then((res) => {
          if (res && res.tracks) {
            setTracks(res.tracks);
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load album tracks:', err);
          setLoading(false);
        });
    } else {
      setTracks(album.tracks);
      setLoading(false);
    }
  }, [album]);

  const handlePlayAlbum = () => {
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
  };

  const totalDurationSeconds = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);

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

  const durationText = formatTotalDuration(totalDurationSeconds);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Hero Banner */}
      <div className="detail-hero">
        <img src={album.thumbnailUrl} alt={album.title} className="detail-cover" />
        <div className="detail-meta">
          <span className="detail-type">Album</span>
          <h1 className="detail-title">{album.title}</h1>
          <div className="detail-desc">
            <span style={{ color: '#fff', fontWeight: 700 }}>{album.artist}</span> • {album.year || '2026'} • {loading ? 'Loading...' : `${tracks.length} songs`}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '8px 0' }}>
        <button
          onClick={handlePlayAlbum}
          disabled={loading || tracks.length === 0}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: loading || tracks.length === 0 ? '#333' : 'var(--primary)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: loading || tracks.length === 0 ? 'not-allowed' : 'pointer',
            boxShadow: '0 8px 24px var(--primary-glow)',
            transition: 'transform 0.15s ease'
          }}
          onMouseEnter={(e) => { if (!loading && tracks.length > 0) e.currentTarget.style.transform = 'scale(1.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          title="Play album"
        >
          <Play size={24} fill="#000" color="#000" style={{ transform: 'translateX(2px)' }} />
        </button>

        <AddToLibraryMenu 
          tracks={tracks} 
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
      </div>

      {/* Tracklist Table */}
      <div className="track-table">
        <div className="track-table-header">
          <span>#</span>
          <span>Title</span>
          <span>Album</span>
          <span style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
            <Clock size={14} style={{ display: 'inline', flexShrink: 0 }} />
            {!loading && durationText && (
              <span style={{ fontSize: '11px', textTransform: 'none', fontWeight: 600, color: 'var(--text-subdued)', letterSpacing: 'normal' }}>
                {durationText}
              </span>
            )}
          </span>
          <span></span>
        </div>

        {loading ? (
          // Skeleton Rows while loading
          Array.from({ length: 8 }).map((_, idx) => (
            <div 
              key={`skeleton_${idx}`} 
              style={{
                display: 'grid',
                gridTemplateColumns: '16px 4fr 2fr minmax(120px, 1fr) 60px',
                alignItems: 'center',
                gap: '16px',
                padding: '10px 16px',
                borderRadius: '6px'
              }}
            >
              <div className="skeleton-box" style={{ width: '12px', height: '14px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="skeleton-box" style={{ width: '40px', height: '40px', borderRadius: '4px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <div className="skeleton-box" style={{ width: `${60 + (idx % 4) * 10}%`, height: '14px' }} />
                  <div className="skeleton-box" style={{ width: '40%', height: '10px' }} />
                </div>
              </div>
              <div className="skeleton-box" style={{ width: '60%', height: '12px' }} />
              <div className="skeleton-box" style={{ width: '35px', height: '12px', marginLeft: 'auto' }} />
              <div className="skeleton-box" style={{ width: '24px', height: '24px', borderRadius: '50%', marginLeft: 'auto' }} />
            </div>
          ))
        ) : (
          tracks.map((track, idx) => (
            <TrackRow 
              key={track.id} 
              track={track} 
              index={idx} 
              trackList={tracks} 
            />
          ))
        )}

        {!loading && tracks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-subdued)' }}>
            No tracks found for this album.
          </div>
        )}
      </div>
    </div>
  );
};
