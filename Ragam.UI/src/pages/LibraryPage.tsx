import React, { useState, useEffect } from 'react';
import { Heart, History, Play, Clock, ListMusic } from 'lucide-react';
import type { Track, Playlist, NavigationTarget } from '../types';
import { bridge } from '../services/bridge';
import { TrackRow } from '../components/TrackRow';
import { usePlayer } from '../context/PlayerContext';

interface LibraryPageProps {
  initialTab?: 'favorites' | 'history' | 'all';
  onNavigate: (target: NavigationTarget) => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({ initialTab = 'all', onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'favorites' | 'history' | 'playlists'>(
    initialTab === 'history' ? 'history' : 'favorites'
  );
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const { playTrack } = usePlayer();

  const loadData = () => {
    Promise.all([bridge.getFavorites(), bridge.getHistory(), bridge.getPlaylists()])
      .then(([favs, hist, pls]) => {
        setFavorites(favs);
        setHistory(hist);
        setPlaylists(pls);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading library:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
    const unsub = bridge.onLibraryChange(() => {
      loadData();
    });
    return () => unsub();
  }, []);

  const currentTracks = activeTab === 'favorites' ? favorites : history;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('favorites')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '500px',
              border: 'none',
              background: activeTab === 'favorites' ? '#ffffff' : 'rgba(255,255,255,0.1)',
              color: activeTab === 'favorites' ? '#000000' : '#ffffff',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Heart size={14} fill={activeTab === 'favorites' ? '#000' : 'none'} color={activeTab === 'favorites' ? '#000' : '#fff'} />
            <span>Liked Songs ({favorites.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '500px',
              border: 'none',
              background: activeTab === 'history' ? '#ffffff' : 'rgba(255,255,255,0.1)',
              color: activeTab === 'history' ? '#000000' : '#ffffff',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <History size={14} />
            <span>History ({history.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('playlists')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '500px',
              border: 'none',
              background: activeTab === 'playlists' ? '#ffffff' : 'rgba(255,255,255,0.1)',
              color: activeTab === 'playlists' ? '#000000' : '#ffffff',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <ListMusic size={14} />
            <span>Playlists ({playlists.length})</span>
          </button>
        </div>

        {activeTab !== 'playlists' && currentTracks.length > 0 && (
          <button
            onClick={() => playTrack(currentTracks[0], currentTracks)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--primary)',
              border: 'none',
              borderRadius: '500px',
              padding: '8px 20px',
              color: '#000',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            <Play size={14} fill="#000" />
            <span>Play All</span>
          </button>
        )}
      </div>

      {/* Playlists Grid */}
      {activeTab === 'playlists' ? (
        <div className="cards-grid">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              className="spotify-card"
              onClick={() => onNavigate({ tab: 'playlist', playlist: pl })}
            >
              <div className="card-img-wrap" style={{ background: '#282828', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ListMusic size={44} color="#b3b3b3" />
              </div>
              <div className="card-info">
                <div className="card-main-title">{pl.name}</div>
                <div className="card-sub-title">{pl.tracks?.length || 0} songs</div>
              </div>
            </div>
          ))}
          {playlists.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-subdued)', gridColumn: '1 / -1' }}>
              No custom playlists yet. Use the "+" in the sidebar to create one!
            </div>
          )}
        </div>
      ) : (
        /* Tracks Table */
        <div className="track-table">
          <div className="track-table-header">
            <span>#</span>
            <span>Title</span>
            <span>Album</span>
            <span style={{ textAlign: 'right' }}><Clock size={14} style={{ display: 'inline' }} /></span>
            <span></span>
          </div>

          {currentTracks.map((track, idx) => (
            <TrackRow
              key={`${track.id}_${idx}`}
              track={track}
              index={idx}
              trackList={currentTracks}
            />
          ))}

          {currentTracks.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-subdued)' }}>
              No tracks found in {activeTab === 'favorites' ? 'Liked Songs' : 'History'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
