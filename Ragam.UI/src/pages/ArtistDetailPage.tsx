import React, { useState, useEffect } from 'react';
import { Play, CheckCircle2, Clock } from 'lucide-react';
import type { Artist, Track } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { TrackRow } from '../components/TrackRow';
import { bridge } from '../services/bridge';

interface ArtistDetailPageProps {
  artist: Artist;
}

export const ArtistDetailPage: React.FC<ArtistDetailPageProps> = ({ artist }) => {
  const { playTrack } = usePlayer();
  const [tracks, setTracks] = useState<Track[]>(artist.topTracks || []);
  const [loading, setLoading] = useState<boolean>(!artist.topTracks || artist.topTracks.length === 0);

  useEffect(() => {
    if (!artist.topTracks || artist.topTracks.length === 0) {
      setLoading(true);
      bridge.getArtistDetails(artist.name, artist.thumbnailUrl, artist.id)
        .then((res) => {
          if (res && res.topTracks) {
            setTracks(res.topTracks);
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load artist tracks:', err);
          setLoading(false);
        });
    } else {
      setTracks(artist.topTracks);
      setLoading(false);
    }
  }, [artist]);

  const handlePlayArtist = () => {
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Hero Banner */}
      <div className="detail-hero">
        <img src={artist.thumbnailUrl} alt={artist.name} className="detail-cover artist" />
        <div className="detail-meta">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3d91f4', fontSize: '13px', fontWeight: 600 }}>
            <CheckCircle2 size={16} />
            <span style={{ color: '#fff' }}>Verified Artist</span>
          </div>
          <h1 className="detail-title">{artist.name}</h1>
          <div className="detail-desc">
            {loading ? 'Loading popular tracks...' : `${tracks.length} popular tracks available`}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '8px 0' }}>
        <button
          onClick={handlePlayArtist}
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
            cursor: loading || tracks.length === 0 ? 'default' : 'pointer',
            boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
            transition: 'transform 0.15s ease',
            opacity: loading || tracks.length === 0 ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!loading && tracks.length > 0) e.currentTarget.style.transform = 'scale(1.06)';
          }}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          title={`Play ${artist.name}`}
        >
          <Play size={24} fill="#000" color="#000" style={{ transform: 'translateX(1px)' }} />
        </button>

        <button
          onClick={() => {
            if (tracks && tracks.length > 0) {
              const shuffled = [...tracks].sort(() => Math.random() - 0.5);
              playTrack(shuffled[0], shuffled);
            }
          }}
          disabled={loading || tracks.length === 0}
          className="control-btn"
          style={{
            height: '44px',
            padding: '0 20px',
            borderRadius: '500px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '13px',
            cursor: loading || tracks.length === 0 ? 'not-allowed' : 'pointer'
          }}
          title="Shuffle Play"
        >
          <span style={{ display: 'inline-flex', transform: 'scale(0.9)' }}>🔀</span>
          <span>Shuffle</span>
        </button>
      </div>

      {/* Popular Tracks Table */}
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Popular</h2>
        <div className="track-table">
          <div className="track-table-header">
            <span>#</span>
            <span>Title</span>
            <span>Album</span>
            <span style={{ textAlign: 'right' }}><Clock size={14} style={{ display: 'inline' }} /></span>
            <span></span>
          </div>

          {loading ? (
            Array.from({ length: 8 }).map((_, idx) => (
              <div 
                key={`skeleton_artist_${idx}`} 
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
              No tracks found for this artist.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
