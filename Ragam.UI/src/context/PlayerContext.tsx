import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { Track, Lyrics, RepeatMode } from '../types';
import { bridge } from '../services/bridge';
import { 
  syncNowPlayingToCloud, 
  clearNowPlayingInCloud, 
  syncTrackHistoryToCloud,
  listenToCloudNowPlaying,
  getSyncUserId
} from '../services/firebase';

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

const STORAGE_KEY_AUTOPLAY_RADIO = 'ragam_autoplay_radio_v1';

interface PlayerContextType {
  currentTrack: Track | null;
  remoteDeviceName: string | null;
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
  isSmartRadioActive: boolean;
  isSmartRadioLoading: boolean;
  isAutoplayRadioEnabled: boolean;
  setIsAutoplayRadioEnabled: (val: boolean) => void;
  startSmartRadio: (track?: Track) => Promise<void>;
  stopSmartRadio: () => void;
  toggleSmartRadio: (track?: Track) => Promise<void>;
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
  takeControlHere: () => Promise<void>;
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
  const [isSmartRadioActive, setIsSmartRadioActive] = useState(false);
  const [isSmartRadioLoading, setIsSmartRadioLoading] = useState(false);
  const [isAutoplayRadioEnabled, setIsAutoplayRadioEnabledState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUTOPLAY_RADIO);
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const setIsAutoplayRadioEnabled = (val: boolean) => {
    setIsAutoplayRadioEnabledState(val);
    try {
      localStorage.setItem(STORAGE_KEY_AUTOPLAY_RADIO, JSON.stringify(val));
    } catch {}
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const queueRef = useRef<Track[]>(initial.queue);
  const queueIndexRef = useRef<number>(initial.queueIndex);
  const repeatModeRef = useRef<RepeatMode>(initial.repeatMode);
  const isShuffleRef = useRef<boolean>(initial.isShuffle);
  const currentTrackRef = useRef<Track | null>(initial.currentTrack);
  const currentTimeRef = useRef<number>(initial.currentTime);
  const syncUserIdRef = useRef<string | null>(null);
  const nextTrackRef = useRef<() => void>(() => {});
  const prevTrackRef = useRef<() => void>(() => {});

  // Keep refs in sync
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { isShuffleRef.current = isShuffle; }, [isShuffle]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  // Resolve sync ID from YouTube Music session via Bridge
  const resolveSyncUserId = async (): Promise<string | null> => {
    // 1. Check desktop YouTube Music session via Bridge
    try {
      const bAuth = await bridge.getAuthState();
      if (bAuth?.isLoggedIn) {
        const id = getSyncUserId(bAuth.userId, bAuth.userEmail) || bAuth.userId;
        if (id) {
          syncUserIdRef.current = id;
          localStorage.setItem('ragam_user_id', id);
          if (bAuth.userEmail) {
            localStorage.setItem('ragam_user_email', bAuth.userEmail);
          }
          localStorage.removeItem('ragam_device_sync_id');
          return id;
        }
      }
    } catch {}

    // 2. Cached real user ID in localStorage (ignore old guest fallback)
    const cachedId = localStorage.getItem('ragam_user_id');
    if (cachedId && !cachedId.startsWith('guest_')) {
      syncUserIdRef.current = cachedId;
      return cachedId;
    }

    // 3. Fallback only if genuinely unauthenticated: guest device ID
    let guestId = localStorage.getItem('ragam_device_sync_id');
    if (!guestId) {
      guestId = 'guest_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('ragam_device_sync_id', guestId);
    }
    syncUserIdRef.current = guestId;
    return guestId;
  };

  const [remoteDeviceName, setRemoteDeviceName] = useState<string | null>(null);

  // Live remote playhead state for real-time progress interpolation (Issue 2)
  interface RemotePlayhead {
    trackId: string;
    positionSec: number;
    timestampMs: number;
    duration: number;
    isPlaying: boolean;
  }
  const remotePlayheadRef = useRef<RemotePlayhead | null>(null);
  const lastRemoteCommandTimeRef = useRef<number>(0);
  const yieldingToRemoteRef = useRef<boolean>(false);

  // Track dismissed remote sessions so closing the player is respected until mobile resumes/changes (Issue 3)
  interface DismissedRemoteState {
    trackId: string;
    isPlaying: boolean;
    timestampMs: number;
  }
  const dismissedRemoteRef = useRef<DismissedRemoteState | null>(null);

  // Subscribe to real-time cloud playback to hydrate PlayerBar from Mobile or other devices
  useEffect(() => {
    let unsubSnapshot: (() => void) | undefined;

    const setupCloudListener = (syncId: string) => {
      if (unsubSnapshot) unsubSnapshot();
      unsubSnapshot = listenToCloudNowPlaying(syncId, (cloudState: any) => {
        if (!cloudState || !cloudState.track) return;

        const isFromRemote = !!(cloudState.deviceName && !cloudState.deviceName.toLowerCase().includes('desktop'));
        const isLocallyPlaying = audioRef.current && !audioRef.current.paused && audioRef.current.currentTime > 0;

        // Check if remote device sent a remote control command to Desktop (Play, Pause, Seek)
        const hasRemoteCommand = cloudState.remoteCommandFrom &&
          (!cloudState.deviceName || cloudState.deviceName.toLowerCase().includes('desktop'));

        if (hasRemoteCommand) {
          const cmdTime = cloudState.commandTimestampMs || cloudState.timestampMs || 0;
          if (cmdTime > lastRemoteCommandTimeRef.current) {
            lastRemoteCommandTimeRef.current = cmdTime;
            const cmd = cloudState.remoteCommand;

            // Clear remoteCommand in Firestore immediately so subsequent pauses/seeks never re-trigger it
            if (cmd && syncUserIdRef.current) {
              syncNowPlayingToCloud(syncUserIdRef.current, {
                remoteCommand: null,
                remoteCommandFrom: null
              } as any).catch(() => {});
            }

            if (cmd === 'next') {
              console.log('[Remote Control] Skipping to next track on command from', cloudState.remoteCommandFrom);
              nextTrackRef.current();
              return;
            }
            if (cmd === 'previous') {
              console.log('[Remote Control] Skipping to previous track on command from', cloudState.remoteCommandFrom);
              prevTrackRef.current();
              return;
            }
            if (cloudState.isPlaying === true) {
              if (audioRef.current && audioRef.current.paused) {
                console.log('[Remote Control] Resuming desktop playback on command from', cloudState.remoteCommandFrom);
                audioRef.current.play().catch(console.error);
              }
            } else if (cloudState.isPlaying === false) {
              if (audioRef.current && !audioRef.current.paused) {
                console.log('[Remote Control] Pausing desktop playback on command from', cloudState.remoteCommandFrom);
                audioRef.current.pause();
              }
            }
            if (typeof cloudState.positionSec === 'number' && audioRef.current) {
              if (Math.abs(audioRef.current.currentTime - cloudState.positionSec) > 2) {
                audioRef.current.currentTime = cloudState.positionSec;
              }
            }
          }
          return;
        }

        // If another device (Mobile) is actively playing audio, yield local playback to Mobile
        if (isFromRemote && cloudState.isPlaying && isLocallyPlaying) {
          console.log('[Remote Playback] Mobile started playing; pausing desktop audio');
          yieldingToRemoteRef.current = true;
          audioRef.current?.pause();
        } else if (isLocallyPlaying) {
          // If desktop is currently playing audio locally and remote is not claiming active playback, desktop stays master
          return;
        }

        if (!isFromRemote) return;

        const trackId = cloudState.track.id;
        const incomingIsPlaying = !!cloudState.isPlaying;
        const incomingTimestampMs = cloudState.timestampMs || Date.now();

        // Issue 3: Check if this remote playback was dismissed by the desktop user
        if (dismissedRemoteRef.current) {
          const dismissed = dismissedRemoteRef.current;
          const isSameTrack = dismissed.trackId === trackId;

          if (isSameTrack) {
            // Check if user on mobile resumed playback (from paused -> playing) or restarted/replayed
            const resumedOnMobile = (!dismissed.isPlaying && incomingIsPlaying) ||
                                    (incomingIsPlaying && incomingTimestampMs > dismissed.timestampMs + 1500);

            if (!resumedOnMobile) {
              // Still dismissed. Update state if mobile paused while dismissed so we detect future resume
              if (!incomingIsPlaying && dismissed.isPlaying) {
                dismissed.isPlaying = false;
                dismissed.timestampMs = incomingTimestampMs;
              }
              return; // Respect user closing the player; do not reopen!
            } else {
              // Mobile explicitly resumed/re-played! Un-dismiss and allow player to pop up
              dismissedRemoteRef.current = null;
            }
          } else {
            // Different song started playing on mobile! Un-dismiss and show new song
            dismissedRemoteRef.current = null;
          }
        }

        // Hydrate player bar
        const isDifferentTrack = !currentTrackRef.current || currentTrackRef.current.id !== trackId;
        if (isDifferentTrack || !currentTrackRef.current) {
          console.log('[Cloud Hydration] Hydrating PlayerBar from remote playback:', cloudState.track.title, `(${cloudState.deviceName})`);
          setCurrentTrack(cloudState.track);
          currentTrackRef.current = cloudState.track;

          if (cloudState.track.duration) {
            setDuration(cloudState.track.duration);
          }

          // Update queue if empty
          if (queueRef.current.length === 0 || queueRef.current.every(t => t.id !== trackId)) {
            setQueue([cloudState.track]);
            queueRef.current = [cloudState.track];
            setQueueIndex(0);
            queueIndexRef.current = 0;
          }
        }

        // Calculate anchored current position
        const elapsed = incomingIsPlaying && incomingTimestampMs
          ? (Date.now() - incomingTimestampMs) / 1000
          : 0;
        const pos = Math.min(
          Math.max(0, (cloudState.positionSec || 0) + elapsed),
          cloudState.track.duration || 99999
        );

        setCurrentTime(pos);
        currentTimeRef.current = pos;
        setIsPlaying(incomingIsPlaying);
        setRemoteDeviceName(cloudState.deviceName || 'Mobile');

        // Store live playhead for our real-time ticker
        remotePlayheadRef.current = {
          trackId: trackId,
          positionSec: cloudState.positionSec || 0,
          timestampMs: incomingTimestampMs,
          duration: cloudState.track.duration || 0,
          isPlaying: incomingIsPlaying
        };
      });
    };

    resolveSyncUserId().then((id) => {
      if (id) setupCloudListener(id);
    });

    return () => {
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  // Issue 2: Real-time playhead ticker for remote device playback
  useEffect(() => {
    if (!remoteDeviceName) return;

    const interval = setInterval(() => {
      // If desktop local audio is playing, local timeupdate event handles it
      const isLocallyPlaying = audioRef.current && !audioRef.current.paused && audioRef.current.currentTime > 0;
      if (isLocallyPlaying) return;

      const remote = remotePlayheadRef.current;
      if (remote && remote.isPlaying) {
        const elapsed = (Date.now() - remote.timestampMs) / 1000;
        const currentPos = Math.min(
          Math.max(0, remote.positionSec + elapsed),
          remote.duration || 99999
        );
        setCurrentTime(currentPos);
        currentTimeRef.current = currentPos;
      }
    }, 500);

    return () => clearInterval(interval);
  }, [remoteDeviceName]);

  // Sync playback state to Firestore cloud (ONLY when Desktop is actively playing audio locally)
  useEffect(() => {
    const isLocallyPlaying = audioRef.current && !audioRef.current.paused && audioRef.current.currentTime > 0;
    if (!isLocallyPlaying || remoteDeviceName) return;

    resolveSyncUserId().then((id) => {
      if (id && currentTrackRef.current) {
        syncNowPlayingToCloud(id, {
          track: currentTrackRef.current,
          isPlaying: true,
          positionSec: audioRef.current?.currentTime || currentTimeRef.current || 0,
          timestampMs: Date.now(),
          deviceName: 'Ragam Desktop',
          volume: volume,
          repeatMode: repeatModeRef.current,
          isShuffle: isShuffleRef.current
        }).catch(() => {});
      }
    });
  }, [volume, remoteDeviceName]);

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
      // If remote mobile was playing, or desktop was not actively playing audio, do not touch cloud state!
      if (remoteDeviceName) return;
      const isLocallyPlaying = audioRef.current && !audioRef.current.paused && audioRef.current.currentTime > 0;
      if (!isLocallyPlaying) return;
      const syncId = syncUserIdRef.current;
      if (syncId && currentTrackRef.current) {
        syncNowPlayingToCloud(syncId, {
          track: currentTrackRef.current,
          isPlaying: false,
          positionSec: audioRef.current?.currentTime || currentTimeRef.current || 0,
          timestampMs: Date.now(),
          deviceName: 'Ragam Desktop'
        }).catch(() => {});
      }
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
      bridge.getStreamUrl(immediateNext.id, immediateNext.title, immediateNext.artist).then((res) => {
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
      setRemoteDeviceName(null);
      remotePlayheadRef.current = null;
      dismissedRemoteRef.current = null;
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

      // Cloud Playback & Listening History Sync (works with YouTube Music & Firebase)
      const syncId = syncUserIdRef.current || await resolveSyncUserId();
      if (syncId) {
        syncNowPlayingToCloud(syncId, {
          track,
          isPlaying: true,
          positionSec: startFromSeconds,
          timestampMs: Date.now(),
          deviceName: 'Ragam Desktop',
          volume: isMuted ? 0 : volume,
          repeatMode: repeatModeRef.current,
          isShuffle: isShuffleRef.current
        }).catch(console.warn);

        syncTrackHistoryToCloud(syncId, track).catch(console.warn);
      }

      // Fetch lyrics in background
      bridge.getLyrics(track).then((l) => setLyrics(l)).catch(() => setLyrics(null));

      // Resolve stream URL
      let url: string | undefined = urlCacheRef.current.get(track.id) ?? undefined;
      if (!url) {
        const res = await bridge.getStreamUrl(track.id, track.title, track.artist);
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

  const startSmartRadio = async (track?: Track) => {
    const seedTrack = track || currentTrackRef.current;
    if (!seedTrack) return;

    setIsSmartRadioLoading(true);
    setIsSmartRadioActive(true);

    try {
      const radioTracks = await bridge.getSmartRadio(seedTrack.id, seedTrack.title, seedTrack.artist);
      const filteredRadio = (radioTracks || []).filter((t) => t.id !== seedTrack.id);

      if (filteredRadio.length > 0) {
        if (currentTrackRef.current?.id === seedTrack.id) {
          // Current track is already playing: keep playing, seamlessly replace upcoming tracks with smart radio mix
          const currIdx = queueIndexRef.current;
          const currentQueue = queueRef.current;
          const newQueue = [...currentQueue.slice(0, currIdx + 1), ...filteredRadio];
          setQueue(newQueue);
          queueRef.current = newQueue;
          prefetchUpcoming(newQueue, currIdx);
        } else {
          // Start playing seed track and initialize smart radio queue
          const newQueue = [seedTrack, ...filteredRadio];
          await playTrackInternal(seedTrack, newQueue, 0);
        }
      } else {
        if (currentTrackRef.current?.id !== seedTrack.id) {
          await playTrackInternal(seedTrack, [seedTrack], 0);
        }
      }
    } catch (err) {
      console.error('Failed to start smart radio:', err);
    } finally {
      setIsSmartRadioLoading(false);
    }
  };

  const stopSmartRadio = () => {
    setIsSmartRadioActive(false);
  };

  const toggleSmartRadio = async (track?: Track) => {
    if (isSmartRadioActive && (!track || track.id === currentTrackRef.current?.id)) {
      stopSmartRadio();
    } else {
      await startSmartRadio(track);
    }
  };

  const autoExtendRadioRef = useRef(false);

  // Auto-extend queue with smart radio recommendations when nearing the end and radio is active
  useEffect(() => {
    const checkAutoExtend = async () => {
      if (!isSmartRadioActive || autoExtendRadioRef.current) return;
      const q = queueRef.current;
      const currIdx = queueIndexRef.current;
      if (q.length === 0) return;

      // Trigger when 1 or 0 tracks remain in queue
      if (currIdx >= q.length - 2) {
        const seed = q[q.length - 1] || currentTrackRef.current;
        if (!seed) return;

        autoExtendRadioRef.current = true;
        try {
          const radioTracks = await bridge.getSmartRadio(seed.id, seed.title, seed.artist);
          const existingIds = new Set(queueRef.current.map((t) => t.id));
          const freshTracks = (radioTracks || []).filter((t) => !existingIds.has(t.id));

          if (freshTracks.length > 0) {
            setQueue((prev) => {
              const updated = [...prev, ...freshTracks];
              queueRef.current = updated;
              return updated;
            });
            setIsSmartRadioActive(true);
          }
        } catch (err) {
          console.warn('Failed to auto-extend smart radio queue:', err);
        } finally {
          autoExtendRadioRef.current = false;
        }
      }
    };

    checkAutoExtend();
  }, [queueIndex, queue.length, isSmartRadioActive]);

  const playTrack = async (track: Track, newQueue?: Track[]) => {
    return playTrackInternal(track, newQueue);
  };

  const nextTrackInternal = () => {
    if (remoteDeviceName && syncUserIdRef.current) {
      console.log('[Remote Control] Sending next command to remote device:', remoteDeviceName);
      syncNowPlayingToCloud(syncUserIdRef.current, {
        remoteCommand: 'next',
        remoteCommandFrom: 'Ragam Desktop',
        commandTimestampMs: Date.now()
      } as any).catch(console.error);
      return;
    }

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
    } else if (isSmartRadioActive && currentTrackRef.current) {
      startSmartRadio(currentTrackRef.current);
    }
  };

  const prevTrackInternal = () => {
    if (remoteDeviceName && syncUserIdRef.current) {
      console.log('[Remote Control] Sending previous command to remote device:', remoteDeviceName);
      syncNowPlayingToCloud(syncUserIdRef.current, {
        remoteCommand: 'previous',
        remoteCommandFrom: 'Ragam Desktop',
        commandTimestampMs: Date.now()
      } as any).catch(console.error);
      return;
    }

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

  nextTrackRef.current = nextTrackInternal;
  prevTrackRef.current = prevTrackInternal;

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

    const handlePlay = () => {
      setIsPlaying(true);
      const syncId = syncUserIdRef.current;
      if (syncId && currentTrackRef.current) {
        syncNowPlayingToCloud(syncId, {
          track: currentTrackRef.current,
          isPlaying: true,
          positionSec: audio.currentTime,
          timestampMs: Date.now(),
          deviceName: 'Ragam Desktop',
          volume: audio.volume,
          repeatMode: repeatModeRef.current,
          isShuffle: isShuffleRef.current
        }).catch(() => {});
      }
    };
    const handlePause = () => {
      setIsPlaying(false);
      if (yieldingToRemoteRef.current) {
        console.log('[Playback Handover] Suppressing desktop cloud pause sync because audio yielded to Mobile');
        yieldingToRemoteRef.current = false;
        return;
      }
      const syncId = syncUserIdRef.current;
      if (syncId && currentTrackRef.current) {
        syncNowPlayingToCloud(syncId, {
          track: currentTrackRef.current,
          isPlaying: false,
          positionSec: audio.currentTime,
          timestampMs: Date.now(),
          deviceName: 'Ragam Desktop',
          volume: audio.volume,
          repeatMode: repeatModeRef.current,
          isShuffle: isShuffleRef.current
        }).catch(() => {});
      }
    };
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

    if (remoteDeviceName && syncUserIdRef.current) {
      const nextPlay = !isPlaying;
      setIsPlaying(nextPlay);
      if (remotePlayheadRef.current) {
        remotePlayheadRef.current.isPlaying = nextPlay;
        remotePlayheadRef.current.timestampMs = Date.now();
      }
      syncNowPlayingToCloud(syncUserIdRef.current, {
        isPlaying: nextPlay,
        remoteCommand: nextPlay ? 'play' : 'pause',
        remoteCommandFrom: 'Ragam Desktop',
        commandTimestampMs: Date.now()
      } as any).catch(console.error);
      return;
    }

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

    if (remoteDeviceName && syncUserIdRef.current) {
      setCurrentTime(seconds);
      if (remotePlayheadRef.current) {
        remotePlayheadRef.current.positionSec = seconds;
        remotePlayheadRef.current.timestampMs = Date.now();
      }
      syncNowPlayingToCloud(syncUserIdRef.current, {
        positionSec: seconds,
        remoteCommandFrom: 'Ragam Desktop',
        commandTimestampMs: Date.now()
      } as any).catch(console.error);
      return;
    }

    if (audioRef.current && audioRef.current.src && audioRef.current.src !== '' && audioRef.current.src !== window.location.href) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    } else {
      // If not yet loaded, start playing from the seeked point
      setCurrentTime(seconds);
      playTrackInternal(currentTrack, queueRef.current, queueIndexRef.current, seconds);
    }

    const syncId = syncUserIdRef.current;
    if (syncId && currentTrackRef.current) {
      syncNowPlayingToCloud(syncId, {
        track: currentTrackRef.current,
        isPlaying: isPlaying,
        positionSec: seconds,
        timestampMs: Date.now(),
        deviceName: 'Ragam Desktop',
        volume: volume,
        repeatMode: repeatModeRef.current,
        isShuffle: isShuffleRef.current
      }).catch(() => {});
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

    // Issue 3: If closing while remote mobile device is playing, record dismissal so listener doesn't reopen it
    if (remoteDeviceName && currentTrackRef.current) {
      dismissedRemoteRef.current = {
        trackId: currentTrackRef.current.id,
        isPlaying: remotePlayheadRef.current?.isPlaying ?? isPlaying,
        timestampMs: remotePlayheadRef.current?.timestampMs ?? Date.now()
      };
    } else {
      dismissedRemoteRef.current = null;
      const syncId = syncUserIdRef.current;
      if (syncId) {
        clearNowPlayingInCloud(syncId).catch(() => {});
      }
    }

    remotePlayheadRef.current = null;
    setRemoteDeviceName(null);
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

  const takeControlHere = async () => {
    const track = currentTrackRef.current;
    if (!track) return;
    const pos = currentTimeRef.current || 0;
    console.log('[Take Control] Transferring playback to PC from', remoteDeviceName, 'at', pos, 'seconds');

    // 1. Tell remote mobile device to pause
    const syncId = syncUserIdRef.current;
    if (syncId) {
      syncNowPlayingToCloud(syncId, {
        isPlaying: false,
        remoteCommand: 'pause',
        remoteCommandFrom: 'Ragam Desktop',
        commandTimestampMs: Date.now()
      } as any).catch(console.error);
    }

    // 2. Clear remote state and start playing locally on Desktop from current position
    setRemoteDeviceName(null);
    remotePlayheadRef.current = null;
    dismissedRemoteRef.current = null;
    await playTrackInternal(track, queueRef.current, queueIndexRef.current, pos);
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
        remoteDeviceName,
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
        isSmartRadioActive,
        isSmartRadioLoading,
        isAutoplayRadioEnabled,
        setIsAutoplayRadioEnabled,
        startSmartRadio,
        stopSmartRadio,
        toggleSmartRadio,
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
        takeControlHere,
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
