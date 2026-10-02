import React, { useState, useEffect } from 'react';
import { Home, Search, Library, Plus, Heart, History, ListMusic } from 'lucide-react';
import type { NavigationTarget, Playlist } from '../types';
import { bridge } from '../services/bridge';

interface SidebarProps {
  currentTarget: NavigationTarget;
  onNavigate: (target: NavigationTarget) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTarget, onNavigate }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const loadPlaylists = () => {
    bridge.getPlaylists().then(setPlaylists).catch(console.error);
  };

  useEffect(() => {
    loadPlaylists();
    const unsub = bridge.onLibraryChange(() => {
      loadPlaylists();
    });
    return () => unsub();
  }, []);

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    try {
      const pl = await bridge.createPlaylist(newPlaylistName.trim());
      setIsCreating(false);
      setNewPlaylistName('');
      loadPlaylists();
      onNavigate({ tab: 'playlist', playlist: pl });
    } catch (err) {
      console.error('Failed to create playlist:', err);
    }
  };

  const isCurrent = (tabName: string) => currentTarget.tab === tabName;

  return (
    <aside className="sidebar">
      <div style={{ padding: "12px 16px 16px 16px", display: "flex", alignItems: "center", cursor: "pointer" }} onClick={() => onNavigate({ tab: "home" })}>
        <img src="/wordmark.svg" alt="RAGAM" style={{ height: "24px", objectFit: "contain" }} />
      </div>
      {/* Top Nav */}
      <div className="sidebar-nav">
        <div
          className={`sidebar-item ${isCurrent('home') ? 'active' : ''}`}
          onClick={() => onNavigate({ tab: 'home' })}
        >
          <Home size={22} />
          <span>Home</span>
        </div>

        <div
          className={`sidebar-item ${isCurrent('search') ? 'active' : ''}`}
          onClick={() => onNavigate({ tab: 'search' })}
        >
          <Search size={22} />
          <span>Search</span>
        </div>
      </div>

      {/* Library Section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="sidebar-library-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => onNavigate({ tab: 'library' })}>
            <Library size={22} />
            <span>Your Library</span>
          </div>

          <button
            className="control-btn"
            onClick={() => setIsCreating(true)}
            title="Create Playlist"
            style={{ color: '#fff', background: '#242424', borderRadius: '50%', width: '28px', height: '28px' }}
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Create playlist input form */}
        {isCreating && (
          <form onSubmit={handleCreatePlaylist} style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              type="text"
              placeholder="Playlist name..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              autoFocus
              style={{
                background: '#242424',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '6px 10px',
                color: '#fff',
                fontSize: '13px',
                outline: 'none'
              }}
            />
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-subdued)', fontSize: '12px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ background: 'var(--primary)', border: 'none', color: '#000', borderRadius: '4px', padding: '2px 10px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
              >
                Save
              </button>
            </div>
          </form>
        )}

        {/* Playlists & Liked Songs list */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px' }}>
          <div
            className={`sidebar-item ${isCurrent('favorites') ? 'active' : ''}`}
            onClick={() => onNavigate({ tab: 'favorites' })}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Heart size={16} fill="#000" color="#000" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Liked Songs</div>
              <div style={{ fontSize: '11px', color: 'var(--text-subdued)' }}>Playlist • Auto</div>
            </div>
          </div>

          <div
            className={`sidebar-item ${isCurrent('history') ? 'active' : ''}`}
            onClick={() => onNavigate({ tab: 'history' })}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: '#282828', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <History size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Listening History</div>
              <div style={{ fontSize: '11px', color: 'var(--text-subdued)' }}>Recently played</div>
            </div>
          </div>

          {playlists.map((pl) => (
            <div
              key={pl.id}
              className={`sidebar-item ${currentTarget.tab === 'playlist' && (currentTarget as any).playlist.id === pl.id ? 'active' : ''}`}
              onClick={() => onNavigate({ tab: 'playlist', playlist: pl })}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: '#242424', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ListMusic size={16} color="#b3b3b3" />
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pl.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-subdued)' }}>
                  Playlist • {pl.tracks?.length || 0} songs
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
