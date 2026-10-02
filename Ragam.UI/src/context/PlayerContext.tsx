import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { Track, Lyrics, RepeatMode } from '../types';
import { bridge } from '../services/bridge';

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
  addToQueue: (track: Track) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const queueRef = useRef<Track[]>([]);
  const queueIndexRef = useRef<number>(0);
  const repeatModeRef = useRef<RepeatMode>('off');
  const isShuffleRef = useRef<boolean>(false);
  const currentTrackRef = useRef<Track | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    queueIndexRef.current = queueIndex;
  }, [queueIndex]);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  useEffect(() => {
    isShuffleRef.current = isShuffle;
  }, [isShuffle]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

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

    // 1. Tell backend to resolve manifests in parallel background tasks
    bridge.prefetchStreams(nextTracks.map((t) => t.id)).catch(() => {});

    // 2. Pre-fetch stream URL for immediate next track & preload audio buffer
    const immediateNext = nextTracks[0];
    if (immediateNext && !urlCacheRef.current.has(immediateNext.id)) {
      bridge.getStreamUrl(immediateNext.id).then((res) => {
        if (res.url) {
          urlCacheRef.current.set(immediateNext.id, res.url);
          // Pre-buffer into secondary hidden audio element to warm network cache
          if (preloadAudioRef.current) {
            preloadAudioRef.current.src = res.url;
            preloadAudioRef.current.preload = 'auto';
            preloadAudioRef.current.load();
          }
        }
      }).catch(() => {});
    }
  };

  const playTrackInternal = async (track: Track, newQueue?: Track[], targetIndex?: number) => {
    try {
      setCurrentTrack(track);
      currentTrackRef.current = track;
      setCurrentTime(0);
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

      // Check favorite
      bridge.getFavorites().then((favs) => {
        setIsFavorite(favs.some((f) => f.id === track.id));
      }).catch(console.error);

      // Add to history
      bridge.addHistory(track).catch(console.error);

      // Fetch lyrics in background
      bridge.getLyrics(track).then((l) => setLyrics(l)).catch(() => setLyrics(null));

      // Trigger prefetching for the next tracks immediately
      prefetchUpcoming(activeQueue, activeIndex);

      // Check if stream URL is already pre-cached for instant playback (0ms wait)
      const cachedUrl = urlCacheRef.current.get(track.id);
      let streamUrl = cachedUrl;

      if (!streamUrl) {
        const streamRes = await bridge.getStreamUrl(track.id);
        streamUrl = streamRes.url || undefined;
        if (streamUrl) {
          urlCacheRef.current.set(track.id, streamUrl);
        }
      }

      if (streamUrl && audioRef.current) {
        // If track changed while fetching, abort
        if (currentTrackRef.current?.id !== track.id) return;

        audioRef.current.src = streamUrl;
        audioRef.current.load();
        try {
          await audioRef.current.play();
          setIsPlaying(true);
          setIsLoading(false);
        } catch (playErr) {
          console.warn('Playback autoplay error:', playErr);
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Playback error:', err);
      setIsLoading(false);
    }
  };

  const nextTrackInternal = () => {
    const q = queueRef.current;
    const currentIdx = queueIndexRef.current;
    const repeat = repeatModeRef.current;
    const shuffle = isShuffleRef.current;

    if (!q || q.length === 0) return;

    let nextIdx = currentIdx + 1;

    if (shuffle && q.length > 1) {
      do {
        nextIdx = Math.floor(Math.random() * q.length);
      } while (nextIdx === currentIdx && q.length > 1);
    } else if (nextIdx >= q.length) {
      if (repeat === 'all') {
        nextIdx = 0;
      } else {
        // End of playlist reached
        setIsPlaying(false);
        setIsLoading(false);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        return;
      }
    }

    const nextTrk = q[nextIdx];
    if (nextTrk) {
      playTrackInternal(nextTrk, undefined, nextIdx);
    }
  };

  const prevTrackInternal = () => {
    const q = queueRef.current;
    const currentIdx = queueIndexRef.current;

    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    if (!q || q.length === 0) return;
    const prevIdx = currentIdx > 0 ? currentIdx - 1 : q.length - 1;
    const prevTrk = q[prevIdx];
    if (prevTrk) {
      playTrackInternal(prevTrk, undefined, prevIdx);
    }
  };

  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

    const preloadAudio = new Audio();
    preloadAudio.volume = 0;
    preloadAudio.preload = 'auto';
    preloadAudioRef.current = preloadAudio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
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

    const handlePlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
    };
    const handlePlaying = () => {
      setIsPlaying(true);
      setIsLoading(false);
    };
    const handleWaiting = () => {
      setIsLoading(true);
    };
    const handleCanPlay = () => {
      setIsLoading(false);
    };
    const handlePause = () => {
      setIsPlaying(false);
      setIsLoading(false);
    };
    const handleError = (e: any) => {
      console.error('Audio playback element error:', e);
      setIsLoading(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const playTrack = async (track: Track, newQueue?: Track[]) => {
    await playTrackInternal(track, newQueue);
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
  };

  const seek = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const setVolume = (val: number) => {
    setVolumeState(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      setIsMuted(val === 0);
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

  const addToQueue = (track: Track) => {
    setQueue((prev) => [...prev, track]);
  };

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
        addToQueue
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
