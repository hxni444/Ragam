import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { Track, Lyrics, RepeatMode } from '../types';
import { bridge } from '../services/bridge';

const STORAGE_KEY_PLAYER_STATE = 'ragam_saved_player_state_v1';

interface SavedPlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
}

const loadSavedPlayerState = (): SavedPlayerState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PLAYER_STATE);
    if (saved) {
      const parsed: SavedPlayerState = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return {
          currentTrack: parsed.currentTrack || null,
          queue: Array.isArray(parsed.queue) ? parsed.queue : (parsed.currentTrack ? [parsed.currentTrack] : []),
          queueIndex: typeof parsed.queueIndex === 'number' ? parsed.queueIndex : 0,
          currentTime: typeof parsed.currentTime === 'number' ? parsed.currentTime : 0,
          duration: typeof parsed.duration === 'number' ? parsed.duration : (parsed.currentTrack?.duration || 0),
          volume: typeof parsed.volume === 'number' ? parsed.volume : 0.8,
          isMuted: !!parsed.isMuted,
          isShuffle: !!parsed.isShuffle,
          repeatMode: parsed.repeatMode || 'off'
        };
      }
    }
  } catch (e) {
    console.warn('Failed to load saved player state:', e);
  }
  return {
    currentTrack: null,
    queue: [],
    queueIndex: 0,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isMuted: false,
    isShuffle: false,
    repeatMode: 'off'
  };
};

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  queue: Track[];
  queueIndex: number;
  lyrics: Lyrics | null;
  isLyricsOpen: boolean;
  isQueueOpen: boolean;
  isExpanded: boolean;
  isFavorite: boolean;
  playTrack: (track: Track, newQueue?: Track[]) => Promise<void>;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  setVolume: (val: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  toggleFavorite: () => Promise<void>;
  setIsLyricsOpen: (val: boolean) => void;
  setIsQueueOpen: (val: boolean) => void;
  setIsExpanded: (val: boolean) => void;
  toggleExpanded: () => void;
  addToQueue: (track: Track) => void;
  closePlayer: () => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = useRef<SavedPlayerState>(loadSavedPlayerState()).current;

  const [currentTrack, setCurrentTrack] = useState<Track | null>(initial.currentTrack);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(initial.currentTime);
  const [duration, setDuration] = useState(initial.duration);
  const [volume, setVolumeState] = useState(initial.volume);
  const [isMuted, setIsMuted] = useState(initial.isMuted);
  const [isShuffle, setIsShuffle] = useState(initial.isShuffle);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(initial.repeatMode);
  const [queue, setQueue] = useState<Track[]>(initial.queue);
  const [queueIndex, setQueueIndex] = useState(initial.queueIndex);
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const queueRef = useRef<Track[]>(initial.queue);
  const queueIndexRef = useRef<number>(initial.queueIndex);
  const repeatModeRef = useRef<RepeatMode>(initial.repeatMode);
  const isShuffleRef = useRef<boolean>(initial.isShuffle);
  const currentTrackRef = useRef<Track | null>(initial.currentTrack);
  const currentTimeRef = useRef<number>(initial.currentTime);

  // Keep refs in sync
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { isShuffleRef.current = isShuffle; }, [isShuffle]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  // Save player state to localStorage whenever it changes
  const savePlayerState = () => {
    try {
      const realAudioTime = audioRef.current && !isNaN(audioRef.current.currentTime) && audioRef.current.currentTime > 0
        ? audioRef.current.currentTime
        : currentTimeRef.current;

      const stateToSave: SavedPlayerState = {
        currentTrack: currentTrackRef.current,
        queue: queueRef.current,
        queueIndex: queueIndexRef.current,
        currentTime: realAudioTime,
        duration: duration,
        volume: volume,
        isMuted: isMuted,
        isShuffle: isShuffleRef.current,
        repeatMode: repeatModeRef.current
      };
      localStorage.setItem(STORAGE_KEY_PLAYER_STATE, JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('Failed to save player state:', e);
    }
  };

  useEffect(() => {
    savePlayerState();
  }, [currentTrack, queue, queueIndex, duration, volume, isMuted, isShuffle, repeatMode]);

  // Debounced save for currentTime updates
  useEffect(() => {
    const timer = setTimeout(() => {
      savePlayerState();
    }, 1000);
    return () => clearTimeout(timer);
  }, [currentTime]);

  // Save on window close / unload / hide
  useEffect(() => {
    const handleUnload = () => {
      savePlayerState();
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, []);

  // Check favorite status for initial restored track
  useEffect(() => {
    if (initial.currentTrack) {
      bridge.getFavorites().then((favs) => {
        setIsFavorite((favs || []).some((f) => f.id === initial.currentTrack?.id));
      }).catch(() => {});
    }
  }, []);

  // Prefetch upcoming tracks for instant skipping
  const prefetchUpcoming = (activeQueue: Track[], activeIndex: number) => {
    if (!activeQueue || activeQueue.length <= 1) return;

    const nextTracks: Track[] = [];
    for (let i = 1; i <= 2; i++) {
      const idx = (activeIndex + i) % activeQueue.length;
      if (activeQueue[idx] && activeQueue[idx].id !== activeQueue[activeIndex].id) {
        nextTracks.push(activeQueue[idx]);
      }
    }

    if (nextTracks.length === 0) return;

    bridge.prefetchStreams(nextTracks.map((t) => t.id)).catch(() => {});

    const immediateNext = nextTracks[0];
    if (immediateNext && !urlCacheRef.current.has(immediateNext.id)) {
      bridge.getStreamUrl(immediateNext.id).then((res) => {
        if (res.url) {
          urlCacheRef.current.set(immediateNext.id, res.url);
          if (preloadAudioRef.current) {
            preloadAudioRef.current.src = res.url;
            preloadAudioRef.current.preload = 'auto';
            preloadAudioRef.current.load();
          }
        }
      }).catch(() => {});
    }
  };

  const playTrackInternal = async (track: Track, newQueue?: Track[], targetIndex?: number, startFromSeconds = 0) => {
    try {
      setCurrentTrack(track);
      currentTrackRef.current = track;
      setCurrentTime(startFromSeconds);
      setDuration(track.duration || 0);
      setIsLoading(true);

      let activeQueue = queueRef.current;
      let activeIndex = queueIndexRef.current;

      if (newQueue && newQueue.length > 0) {
        activeQueue = newQueue;
        activeIndex = targetIndex !== undefined 
          ? targetIndex 
          : newQueue.findIndex((t) => t.id === track.id);
        if (activeIndex === -1) activeIndex = 0;

        setQueue(newQueue);
        queueRef.current = newQueue;
        setQueueIndex(activeIndex);
        queueIndexRef.current = activeIndex;
      } else if (targetIndex !== undefined) {
        activeIndex = targetIndex;
        setQueueIndex(targetIndex);
        queueIndexRef.current = targetIndex;
      } else {
        const foundIdx = activeQueue.findIndex((t) => t.id === track.id);
        if (foundIdx !== -1) {
          activeIndex = foundIdx;
          setQueueIndex(foundIdx);
          queueIndexRef.current = foundIdx;
        } else {
          activeQueue = [track];
          activeIndex = 0;
          setQueue(activeQueue);
          queueRef.current = activeQueue;
          setQueueIndex(0);
          queueIndexRef.current = 0;
        }
      }

      bridge.getFavorites().then((favs) => {
        setIsFavorite((favs || []).some((f) => f.id === track.id));
      }).catch(console.error);

      bridge.addHistory(track).catch(console.error);

      // Fetch lyrics in background
      bridge.getLyrics(track).then((l) => setLyrics(l)).catch(() => setLyrics(null));

      // Resolve stream URL
      let url: string | undefined = urlCacheRef.current.get(track.id) ?? undefined;
      if (!url) {
        const res = await bridge.getStreamUrl(track.id);
        url = res?.url ?? undefined;
        if (url) {
          urlCacheRef.current.set(track.id, url);
        }
      }

      if (audioRef.current && url) {
        audioRef.current.src = url;
        audioRef.current.volume = isMuted ? 0 : volume;
        if (startFromSeconds > 0) {
          audioRef.current.currentTime = startFromSeconds;
        }
        await audioRef.current.play();
        setIsPlaying(true);
      }

      prefetchUpcoming(activeQueue, activeIndex);
    } catch (err) {
      console.error('Failed to play track:', err);
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  const playTrack = async (track: Track, newQueue?: Track[]) => {
    return playTrackInternal(track, newQueue);
  };

  const nextTrackInternal = () => {
    const q = queueRef.current;
    if (q.length === 0) return;

    if (isShuffleRef.current) {
      const nextIdx = Math.floor(Math.random() * q.length);
      playTrackInternal(q[nextIdx], q, nextIdx);
      return;
    }

    const currIdx = queueIndexRef.current;
    if (currIdx < q.length - 1) {
      playTrackInternal(q[currIdx + 1], q, currIdx + 1);
    } else if (repeatModeRef.current === 'all') {
      playTrackInternal(q[0], q, 0);
    }
  };

  const prevTrackInternal = () => {
    const q = queueRef.current;
    if (q.length === 0) return;

    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    const currIdx = queueIndexRef.current;
    if (currIdx > 0) {
      playTrackInternal(q[currIdx - 1], q, currIdx - 1);
    } else if (repeatModeRef.current === 'all') {
      playTrackInternal(q[q.length - 1], q, q.length - 1);
    } else if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  // Setup Audio Elements
  useEffect(() => {
    const audio = new Audio();
    const preloadAudio = new Audio();
    preloadAudio.muted = true;

    audio.volume = initial.volume;
    audioRef.current = audio;
    preloadAudioRef.current = preloadAudio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      if (repeatModeRef.current === 'one') {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      } else {
        nextTrackInternal();
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.pause();
      audio.src = '';
    };
  }, []);

  const togglePlay = () => {
    if (!currentTrack) return;

    if (!audioRef.current || !audioRef.current.src || audioRef.current.src === '' || audioRef.current.src === window.location.href) {
      // Resume restored song from saved timestamp
      playTrackInternal(currentTrack, queueRef.current, queueIndexRef.current, currentTime);
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
  };

  const seek = (seconds: number) => {
    if (!currentTrack) return;
    if (audioRef.current && audioRef.current.src && audioRef.current.src !== '' && audioRef.current.src !== window.location.href) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    } else {
      // If not yet loaded, start playing from the seeked point
      setCurrentTime(seconds);
      playTrackInternal(currentTrack, queueRef.current, queueIndexRef.current, seconds);
    }
  };

  const setVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    setIsMuted(false);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleShuffle = () => setIsShuffle((prev) => !prev);

  const toggleRepeat = () => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const next = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
    setRepeatMode(next);
  };

  const nextTrack = () => nextTrackInternal();
  const prevTrack = () => prevTrackInternal();

  const toggleFavorite = async () => {
    if (!currentTrack) return;
    const res = await bridge.toggleFavorite(currentTrack);
    setIsFavorite(res.isFavorite);
  };

  const toggleExpanded = () => setIsExpanded((prev) => !prev);

  const closePlayer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
      audioRef.current.currentTime = 0;
    }
    setCurrentTrack(null);
    currentTrackRef.current = null;
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentTime(0);
    setDuration(0);
    setIsLyricsOpen(false);
    setIsQueueOpen(false);
    setIsExpanded(false);
    localStorage.removeItem(STORAGE_KEY_PLAYER_STATE);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.metadata = null;
    }
  };

  const addToQueue = (track: Track) => {
    setQueue((prev) => [...prev, track]);
  };

  // MediaSession integration
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || 'RAGAM',
        artwork: currentTrack.thumbnailUrl
          ? [
              { src: currentTrack.thumbnailUrl, sizes: '96x96', type: 'image/jpeg' },
              { src: currentTrack.thumbnailUrl, sizes: '128x128', type: 'image/jpeg' },
              { src: currentTrack.thumbnailUrl, sizes: '256x256', type: 'image/jpeg' },
              { src: currentTrack.thumbnailUrl, sizes: '512x512', type: 'image/jpeg' }
            ]
          : []
      });
    } else {
      navigator.mediaSession.metadata = null;
    }

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    navigator.mediaSession.setActionHandler('play', () => {
      togglePlay();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      prevTrackInternal();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      nextTrackInternal();
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        seek(details.seekTime);
      }
    });
  }, [currentTrack, isPlaying]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || target?.isContentEditable;
      if (isInput) return;

      if (e.key === 'Escape') {
        setIsExpanded(false);
      } else if (e.code === 'MediaPlayPause' || e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'MediaTrackNext' || (e.shiftKey && e.code === 'ArrowRight') || (e.shiftKey && (e.key === 'n' || e.key === 'N'))) {
        e.preventDefault();
        nextTrackInternal();
      } else if (e.code === 'MediaTrackPrevious' || (e.shiftKey && e.code === 'ArrowLeft') || (e.shiftKey && (e.key === 'p' || e.key === 'P'))) {
        e.preventDefault();
        prevTrackInternal();
      } else if (e.code === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        if (currentTime > 0) {
          seek(Math.max(currentTime - 5, 0));
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (duration > 0) {
          seek(Math.min(currentTime + 5, duration));
        }
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setVolume(volume + 0.05);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setVolume(volume - 0.05);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        setIsLyricsOpen((prev) => !prev);
      } else if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        setIsQueueOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleMute, currentTime, duration, volume]);

  // Taskbar / Native Bridge Media Controls
  useEffect(() => {
    const unsubToggle = bridge.on('media_toggle_play', () => {
      togglePlay();
    });
    const unsubPlay = bridge.on('media_play', () => {
      if (!isPlaying) togglePlay();
    });
    const unsubPause = bridge.on('media_pause', () => {
      if (isPlaying) togglePlay();
    });
    const unsubNext = bridge.on('media_next', () => {
      nextTrackInternal();
    });
    const unsubPrev = bridge.on('media_prev', () => {
      prevTrackInternal();
    });

    return () => {
      unsubToggle();
      unsubPlay();
      unsubPause();
      unsubNext();
      unsubPrev();
    };
  }, [isPlaying, currentTrack, queue, queueIndex]);

  // Sync playback state & progress to Native Taskbar
  useEffect(() => {
    const hasTrack = !!currentTrack;
    const progress = duration > 0 ? currentTime / duration : 0;
    bridge.updatePlaybackState({
      hasTrack,
      isPlaying,
      title: currentTrack?.title,
      artist: currentTrack?.artist,
      thumbnailUrl: currentTrack?.thumbnailUrl,
      progress
    }).catch(() => {});
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.artist, currentTrack?.thumbnailUrl, isPlaying, Math.floor(currentTime), duration]);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        isLoading,
        currentTime,
        duration,
        volume,
        isMuted,
        isShuffle,
        repeatMode,
        queue,
        queueIndex,
        lyrics,
        isLyricsOpen,
        isQueueOpen,
        isFavorite,
        playTrack,
        togglePlay,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        toggleRepeat,
        nextTrack,
        prevTrack,
        toggleFavorite,
        setIsLyricsOpen,
        setIsQueueOpen,
        addToQueue,
        closePlayer,
        isExpanded,
        setIsExpanded,
        toggleExpanded
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within a PlayerProvider');
  return context;
};
