import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Heart, ListMusic, Check, Loader2 } from 'lucide-react';
import type { Track, Playlist, Album, Artist } from '../types';
import { bridge } from '../services/bridge';

export const isSameTrack = (t1?: Track, t2?: Track): boolean => {
  if (!t1 || !t2) return false;
  if (t1.id && t2.id && t1.id === t2.id) return true;

  const cleanDecoration = (str: string) => {
    return (str || '')
      .toLowerCase()
      .replace(/\s*[([{\-]\s*(official\s*(music\s*)?video|official\s*audio|visualizer|lyric\s*video|lyrics|4k|hd|hq|audio|video|full\s*song)\s*[)\]}]/gi, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const title1 = cleanDecoration(t1.title);
  const title2 = cleanDecoration(t2.title);

  if (title1 && title2 && title1 === title2) {
    const artist1 = cleanDecoration(t1.artist || '');
    const artist2 = cleanDecoration(t2.artist || '');
    if (!artist1 || !artist2 || artist1 === artist2 || artist1.includes(artist2) || artist2.includes(artist1)) {
      return true;
    }
  }

  return false;
};

interface AddToLibraryMenuProps {
  track?: Track;
  tracks?: Track[];
  album?: Album;
  artist?: Artist;
  iconSize?: number;
  className?: string;
  buttonStyle?: React.CSSProperties;
  label?: string;
  align?: 'left' | 'right' | 'center';
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
  align = 'center'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [resolvedTracks, setResolvedTracks] = useState<Track[]>(tracks || (track ? [track] : []));
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const buttonRef = useRef<HTMLButtonElement>(null);
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
      const target = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      if (isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const updatePosition = () => {
    if (buttonRef.current) {
      const btnRect = buttonRef.current.getBoundingClientRect();
      const menuEl = menuRef.current;
      const menuWidth = menuEl ? menuEl.offsetWidth : 240;
      const menuHeight = menuEl ? menuEl.offsetHeight : 150;

      let left: number;
      if (align === 'center') {
        left = btnRect.left + (btnRect.width / 2) - (menuWidth / 2);
      } else if (align === 'left') {
        left = btnRect.left;
      } else {
        left = btnRect.right - menuWidth;
      }

      // Clamp horizontally
      if (left < 16) {
        left = 16;
      }
      if (left + menuWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - menuWidth - 16);
      }

      // Vertical positioning
      const playerBarMargin = 96;
      let top = btnRect.bottom + 6;

      if (top + menuHeight > window.innerHeight - playerBarMargin) {
        top = Math.max(16, btnRect.top - menuHeight - 6);
      }

      setCoords({ top, left });
    }
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, playlists, addedMessage]);

  const handleOpenMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    // 1. OPEN IMMEDIATELY without waiting for async requests
    setIsOpen(true);
    setLoadingData(true);

    // 2. Fetch data concurrently in the background
    (async () => {
      try {
        let currentTargetTracks = resolvedTracks;

        // Fetch album tracks if missing
        const albumPromise = (async () => {
          if (album && (!currentTargetTracks || currentTargetTracks.length === 0)) {
            if (album.tracks && album.tracks.length > 0) {
              currentTargetTracks = album.tracks;
              setResolvedTracks(album.tracks);
            } else if (album.id) {
              setLoadingTracks(true);
              const detail = await bridge.getAlbumOrPlaylist(album.title, album.artist, album.thumbnailUrl, album.id);
              if (detail && detail.tracks) {
                currentTargetTracks = detail.tracks;
                setResolvedTracks(detail.tracks);
              }
              setLoadingTracks(false);
            }
          }
        })();

        // Fetch playlists and favorites in parallel
        const [pls, favs] = await Promise.all([
          bridge.getPlaylists(),
          bridge.getFavorites(),
          albumPromise
        ]);

        setPlaylists(pls || []);

        if (track) {
          setIsFavorite((favs || []).some((f: Track) => isSameTrack(f, track)));
        } else if (currentTargetTracks && currentTargetTracks.length > 0) {
          const allFav = currentTargetTracks.every((t) => (favs || []).some((f: Track) => isSameTrack(f, t)));
          setIsFavorite(allFav);
        }
      } catch (err) {
        console.error('Failed to load menu data:', err);
      } finally {
        setLoadingData(false);
        setLoadingTracks(false);
      }
    })();
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
        const isInPlaylist = pl.tracks?.some((t) => isSameTrack(t, singleTrack)) || false;
        if (isInPlaylist) {
          await bridge.removeFromPlaylist(pl.id, singleTrack.id);
          setPlaylists((prev) =>
            prev.map((p) =>
              p.id === pl.id
                ? { ...p, tracks: (p.tracks || []).filter((t) => !isSameTrack(t, singleTrack)) }
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
        const existingTracks = pl.tracks || [];
        for (const t of resolvedTracks) {
          if (!existingTracks.some((et) => isSameTrack(et, t))) {
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
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className}
        onClick={handleOpenMenu}
        title={resolvedTracks.length > 1 || album || artist ? "Add all to custom playlist" : "Add to library or playlist"}
        style={buttonStyle}
      >
        {loadingTracks ? <Loader2 size={iconSize} className="animate-spin" /> : <Plus size={iconSize} />}
        {label && <span style={{ marginLeft: '6px' }}>{label}</span>}
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            background: '#242424',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '6px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.6)',
            zIndex: 9999999,
            minWidth: '240px',
            maxWidth: '280px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            animation: 'fadeIn 0.12s ease'
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
                  <span>{resolvedTracks.length > 1 ? `Save All (${resolvedTracks.length}) to Liked Songs` : (isFavorite ? 'In Liked Songs' : 'Add to Liked Songs')}</span>
                </div>
                {isFavorite && <Check size={14} color="var(--primary)" />}
              </div>

              <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />

              {/* Playlists Header */}
              <div style={{ fontSize: '11px', fontWeight: 700, padding: '4px 12px', color: 'var(--text-subdued)', letterSpacing: '0.05em' }}>
                {resolvedTracks.length > 1 ? `ADD ${resolvedTracks.length} SONGS TO PLAYLIST` : 'ADD TO PLAYLIST'}
              </div>

              {loadingData && playlists.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '12px', color: 'var(--text-subdued)' }}>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Loading playlists...</span>
                </div>
              ) : playlists.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-subdued)', padding: '6px 12px' }}>
                  No custom playlists yet
                </div>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {playlists.map((pl) => {
                    const isInPlaylist = resolvedTracks.length === 1 
                      ? (pl.tracks?.some((t) => isSameTrack(t, resolvedTracks[0])) || false)
                      : (resolvedTracks.length > 0 && resolvedTracks.every((t) => (pl.tracks || []).some((pt) => isSameTrack(pt, t))));
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
                  })}
                </div>
              )}
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
};
