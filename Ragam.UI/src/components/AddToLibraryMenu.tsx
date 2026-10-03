import React, { useState, useEffect, useRef } from 'react';
import { Plus, Heart, ListMusic, Check } from 'lucide-react';
import type { Track, Playlist } from '../types';
import { bridge } from '../services/bridge';

interface AddToLibraryMenuProps {
  track?: Track;
  tracks?: Track[];
  iconSize?: number;
  className?: string;
  buttonStyle?: React.CSSProperties;
  label?: string;
  align?: 'left' | 'right';
}

export const AddToLibraryMenu: React.FC<AddToLibraryMenuProps> = ({
  track,
  tracks,
  iconSize = 16,
  className = "control-btn",
  buttonStyle,
  label,
  align = 'right'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const targetTracks: Track[] = tracks || (track ? [track] : []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleOpenMenu = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      try {
        const [pls, favs] = await Promise.all([
          bridge.getPlaylists(),
          bridge.getFavorites()
        ]);
        setPlaylists(pls);
        if (track) {
          setIsFavorite(favs.some((f) => f.id === track.id));
        } else if (targetTracks.length > 0) {
          setIsFavorite(targetTracks.every((t) => favs.some((f) => f.id === t.id)));
        }
      } catch (err) {
        console.error('Failed to load library data:', err);
      }
    }
    setIsOpen(!isOpen);
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (track) {
        const res = await bridge.toggleFavorite(track);
        setIsFavorite(res.isFavorite);
        showFeedback(res.isFavorite ? 'Added to Liked Songs' : 'Removed from Liked Songs');
      } else if (targetTracks.length > 0) {
        for (const t of targetTracks) {
          await bridge.toggleFavorite(t);
        }
        setIsFavorite(!isFavorite);
        showFeedback(`Updated ${targetTracks.length} songs in Liked Songs`);
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleTogglePlaylist = async (e: React.MouseEvent, pl: Playlist) => {
    e.stopPropagation();
    try {
      if (targetTracks.length === 1) {
        const singleTrack = targetTracks[0];
        const isInPlaylist = pl.tracks?.some((t) => t.id === singleTrack.id) || false;
        if (isInPlaylist) {
          await bridge.removeFromPlaylist(pl.id, singleTrack.id);
          setPlaylists((prev) =>
            prev.map((p) =>
              p.id === pl.id
                ? { ...p, tracks: (p.tracks || []).filter((t) => t.id !== singleTrack.id) }
                : p
            )
          );
          showFeedback(`Removed from ${pl.name}`);
        } else {
          await bridge.addTrackToPlaylist(pl.id, singleTrack);
          setPlaylists((prev) =>
            prev.map((p) =>
              p.id === pl.id
                ? { ...p, tracks: [...(p.tracks || []), singleTrack] }
                : p
            )
          );
          showFeedback(`Added to ${pl.name}`);
        }
      } else if (targetTracks.length > 1) {
        // Batch add all tracks
        let addedCount = 0;
        const currentTrackIds = new Set((pl.tracks || []).map((t) => t.id));
        for (const t of targetTracks) {
          if (!currentTrackIds.has(t.id)) {
            await bridge.addTrackToPlaylist(pl.id, t);
            addedCount++;
          }
        }
        showFeedback(addedCount > 0 ? `Added ${addedCount} songs to ${pl.name}` : `All songs already in ${pl.name}`);
      }
    } catch (err) {
      console.error('Failed to update playlist:', err);
    }
  };

  const showFeedback = (msg: string) => {
    setAddedMessage(msg);
    setTimeout(() => {
      setAddedMessage(null);
      setIsOpen(false);
    }, 1500);
  };

  if (targetTracks.length === 0) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} ref={menuRef}>
      <button
        type="button"
        className={className}
        onClick={handleOpenMenu}
        title={targetTracks.length > 1 ? "Add all to Playlist" : "Add to library or playlist"}
        style={buttonStyle}
      >
        <Plus size={iconSize} />
        {label && <span style={{ marginLeft: '6px' }}>{label}</span>}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            ...(align === 'right' ? { right: 0 } : { left: 0 }),
            top: 'calc(100% + 8px)',
            background: '#242424',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '6px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.85)',
            zIndex: 9999,
            minWidth: '230px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {addedMessage ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 14px',
              color: 'var(--primary)',
              fontSize: '13px',
              fontWeight: 700
            }}>
              <Check size={16} />
              <span>{addedMessage}</span>
            </div>
          ) : (
            <>
              {/* Option 1: Liked Songs */}
              <div
                onClick={handleToggleFavorite}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  color: isFavorite ? 'var(--primary)' : '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Heart size={16} fill={isFavorite ? 'var(--primary)' : 'none'} color={isFavorite ? 'var(--primary)' : '#fff'} />
                  <span>{targetTracks.length > 1 ? 'Save All to Liked Songs' : (isFavorite ? 'In Liked Songs' : 'Add to Liked Songs')}</span>
                </div>
                {isFavorite && <Check size={14} color="var(--primary)" />}
              </div>

              <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />

              {/* Playlists Header */}
              <div style={{ fontSize: '11px', fontWeight: 700, padding: '4px 12px', color: 'var(--text-subdued)', letterSpacing: '0.05em' }}>
                {targetTracks.length > 1 ? `ADD ${targetTracks.length} SONGS TO PLAYLIST` : 'ADD TO PLAYLIST'}
              </div>

              {playlists.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-subdued)', padding: '6px 12px' }}>
                  No custom playlists yet
                </div>
              ) : (
                playlists.map((pl) => {
                  const isInPlaylist = targetTracks.length === 1 
                    ? (pl.tracks?.some((t) => t.id === targetTracks[0].id) || false)
                    : (targetTracks.every((t) => (pl.tracks || []).some((pt) => pt.id === t.id)));
                  return (
                    <div
                      key={pl.id}
                      onClick={(e) => handleTogglePlaylist(e, pl)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        color: isInPlaylist ? 'var(--primary)' : '#fff',
                        fontSize: '13px',
                        fontWeight: isInPlaylist ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                        <ListMusic size={15} color={isInPlaylist ? 'var(--primary)' : 'var(--text-subdued)'} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {pl.name}
                        </span>
                      </div>
                      {isInPlaylist && <Check size={14} color="var(--primary)" />}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
