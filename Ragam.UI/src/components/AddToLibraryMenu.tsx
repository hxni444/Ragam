import React, { useState, useEffect, useRef } from 'react';
import { Plus, Heart, ListMusic, Check, Loader2 } from 'lucide-react';
import type { Track, Playlist, Album, Artist } from '../types';
import { bridge } from '../services/bridge';

interface AddToLibraryMenuProps {
  track?: Track;
  tracks?: Track[];
  album?: Album;
  artist?: Artist;
  iconSize?: number;
  className?: string;
  buttonStyle?: React.CSSProperties;
  label?: string;
  align?: 'left' | 'right';
}

export const AddToLibraryMenu: React.FC<AddToLibraryMenuProps> = ({
  track,
  tracks,
  album,
  artist,
  iconSize = 16,
  className = "control-btn",
  buttonStyle,
  label,
  align = 'right'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [resolvedTracks, setResolvedTracks] = useState<Track[]>(tracks || (track ? [track] : []));
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tracks) {
      setResolvedTracks(tracks);
    } else if (track) {
      setResolvedTracks([track]);
    }
  }, [track, tracks]);

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
        let currentTargetTracks = resolvedTracks;

        // If album is passed and tracks not yet loaded, fetch them
        if (album && (!currentTargetTracks || currentTargetTracks.length === 0)) {
          if (album.tracks && album.tracks.length > 0) {
            currentTargetTracks = album.tracks;
            setResolvedTracks(album.tracks);
          } else {
            setLoadingTracks(true);
            const res = await bridge.getAlbumOrPlaylist(album.title, album.artist, album.thumbnailUrl, album.id);
            if (res && res.tracks && res.tracks.length > 0) {
              album.tracks = res.tracks;
              currentTargetTracks = res.tracks;
              setResolvedTracks(res.tracks);
            }
            setLoadingTracks(false);
          }
        }

        // If artist is passed and top tracks not yet loaded, fetch them
        if (artist && (!currentTargetTracks || currentTargetTracks.length === 0)) {
          if (artist.topTracks && artist.topTracks.length > 0) {
            currentTargetTracks = artist.topTracks;
            setResolvedTracks(artist.topTracks);
          } else {
            setLoadingTracks(true);
            const res = await bridge.getArtistDetails(artist.name, artist.thumbnailUrl, artist.id);
            if (res && res.topTracks && res.topTracks.length > 0) {
              artist.topTracks = res.topTracks;
              currentTargetTracks = res.topTracks;
              setResolvedTracks(res.topTracks);
            }
            setLoadingTracks(false);
          }
        }

        const [pls, favs] = await Promise.all([
          bridge.getPlaylists(),
          bridge.getFavorites()
        ]);
        setPlaylists(pls);

        if (track) {
          setIsFavorite(favs.some((f) => f.id === track.id));
        } else if (currentTargetTracks.length > 0) {
          setIsFavorite(currentTargetTracks.every((t) => favs.some((f) => f.id === t.id)));
        }
      } catch (err) {
        console.error('Failed to load library data:', err);
        setLoadingTracks(false);
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
      } else if (resolvedTracks.length > 0) {
        for (const t of resolvedTracks) {
          await bridge.toggleFavorite(t);
        }
        setIsFavorite(!isFavorite);
        showFeedback(`Updated ${resolvedTracks.length} songs in Liked Songs`);
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleTogglePlaylist = async (e: React.MouseEvent, pl: Playlist) => {
    e.stopPropagation();
    try {
      if (resolvedTracks.length === 1) {
        const singleTrack = resolvedTracks[0];
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
      } else if (resolvedTracks.length > 1) {
        let addedCount = 0;
        const currentTrackIds = new Set((pl.tracks || []).map((t) => t.id));
        for (const t of resolvedTracks) {
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

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} ref={menuRef}>
      <button
        type="button"
        className={className}
        onClick={handleOpenMenu}
        title={resolvedTracks.length > 1 || album || artist ? "Add all to custom playlist" : "Add to library or playlist"}
        style={buttonStyle}
      >
        {loadingTracks ? <Loader2 size={iconSize} className="animate-spin" /> : <Plus size={iconSize} />}
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
                  <span>{resolvedTracks.length > 1 ? 'Save All to Liked Songs' : (isFavorite ? 'In Liked Songs' : 'Add to Liked Songs')}</span>
                </div>
                {isFavorite && <Check size={14} color="var(--primary)" />}
              </div>

              <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />

              {/* Playlists Header */}
              <div style={{ fontSize: '11px', fontWeight: 700, padding: '4px 12px', color: 'var(--text-subdued)', letterSpacing: '0.05em' }}>
                {resolvedTracks.length > 1 ? `ADD ${resolvedTracks.length} SONGS TO PLAYLIST` : 'ADD TO PLAYLIST'}
              </div>

              {playlists.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-subdued)', padding: '6px 12px' }}>
                  No custom playlists yet
                </div>
              ) : (
                playlists.map((pl) => {
                  const isInPlaylist = resolvedTracks.length === 1 
                    ? (pl.tracks?.some((t) => t.id === resolvedTracks[0].id) || false)
                    : (resolvedTracks.length > 0 && resolvedTracks.every((t) => (pl.tracks || []).some((pt) => pt.id === t.id)));
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
