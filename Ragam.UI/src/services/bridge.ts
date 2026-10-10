declare const __APP_VERSION__: string;
export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
  publishedAt: string;
}

import type { Track, Lyrics, HomeFeed, Album, Artist, Playlist, SearchResult, AuthState } from '../types';

declare global {
  interface Window {
    chrome?: {
      webview?: {
        postMessage: (message: any) => void;
        addEventListener: (event: string, handler: (e: any) => void) => void;
        removeEventListener: (event: string, handler: (e: any) => void) => void;
      };
    };
  }
}



class NativeBridge {
  public appVersion: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.1.1';
  private pendingRequests = new Map<string, { resolve: (data: any) => void; reject: (err: any) => void }>();
  private eventListeners = new Map<string, Set<(payload: any) => void>>();
  private isNativeAvailable = false;

  constructor() {
    this.isNativeAvailable = typeof window !== 'undefined' && !!window.chrome?.webview;

    if (this.isNativeAvailable) {
            window.chrome!.webview!.addEventListener('message', (event: any) => {
        try {
          const res: any = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (res && res.isEvent && res.eventName) {
            const listeners = this.eventListeners.get(res.eventName);
            if (listeners) {
              listeners.forEach((fn) => {
                try { fn(res.payload); } catch (err) { console.error(err); }
              });
            }
            return;
          }
          const msgId = res?.id || res?.Id;
          if (msgId && this.pendingRequests.has(msgId)) {
            const { resolve, reject } = this.pendingRequests.get(msgId)!;
            this.pendingRequests.delete(msgId);
            const isSuccess = res.success !== undefined ? res.success : res.Success;
            const resData = res.data !== undefined ? res.data : res.Data;
            const resError = res.error || res.Error;
            if (isSuccess) {
              resolve(resData);
            } else {
              reject(new Error(resError || 'Native bridge error'));
            }
          }
        } catch (e) {
          console.error('Failed to parse bridge response', e);
        }
      });
    }
  }

  private send<T = any>(action: string, payload: any = {}): Promise<T> {
    if (!this.isNativeAvailable) {
      return this.mockFallback<T>(action, payload);
    }

    return new Promise((resolve, reject) => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      this.pendingRequests.set(id, { resolve, reject });

      window.chrome!.webview!.postMessage(JSON.stringify({
        id,
        action,
        payload
      }));

      // Extended timeout for long-running / network actions (YouTube auth, update check & installation)
      const timeoutMs = (action === 'login_youtube' || action === 'install_update' || action === 'check_for_updates') ? 600000 : 30000;
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Bridge request timed out: ${action}`));
        }
      }, timeoutMs);
    });
  }

  private cachedHomeFeed: HomeFeed | null = null;

  public async getHomeFeed(forceRefresh = false, params?: string): Promise<HomeFeed> {
    if (!forceRefresh && !params && this.cachedHomeFeed) {
      return this.cachedHomeFeed;
    }
    const feed = await this.send<HomeFeed>('get_home_feed', { forceRefresh, params });
    if (feed && !params && (feed.sections?.length || feed.quickPicks?.length || feed.trendingSongs?.length)) {
      this.cachedHomeFeed = feed;
    }
    return feed;
  }

  public getMoodCategory(title: string, params?: string, browseId?: string): Promise<HomeFeed> {
    return this.send<HomeFeed>('get_mood_category', { title, params, browseId });
  }

  public getExploreMoods(): Promise<any[]> {
    return this.send<any[]>('get_explore_moods');
  }

  public search(query: string): Promise<SearchResult> {
    return this.send<SearchResult>('search', { query });
  }

  public getAlbumOrPlaylist(title: string, artist: string, thumbnailUrl: string, id?: string): Promise<Album> {
    return this.send<Album>('get_album_or_playlist', { title, artist, thumbnailUrl, id });
  }

  public getArtistDetails(name: string, thumbnailUrl: string, id?: string): Promise<Artist> {
    return this.send<Artist>('get_artist_details', { name, thumbnailUrl, id });
  }

  public getStreamUrl(trackId: string, title?: string, artist?: string): Promise<{ url: string | null }> {
    return this.send<{ url: string | null }>('get_stream_url', { id: trackId, title, artist });
  }

  public getSmartRadio(videoId: string, title?: string, artist?: string, playlistId?: string): Promise<Track[]> {
    return this.send<Track[]>('get_smart_radio', { videoId, title, artist, playlistId });
  }

  public prefetchStreams(trackIds: string[]): Promise<{ success: boolean }> {
    return this.send<{ success: boolean }>('prefetch_streams', { ids: trackIds });
  }

  public getLyrics(track: Track): Promise<Lyrics> {
    return this.send<Lyrics>('get_lyrics', {
      id: track.id,
      title: track.title,
      artist: track.artist,
      duration: track.duration
    });
  }

  public toggleFavorite(track: Track): Promise<{ isFavorite: boolean }> {
    return this.send<{ isFavorite: boolean }>('toggle_favorite', track);
  }

  public getFavorites(): Promise<Track[]> {
    return this.send<Track[]>('get_favorites');
  }

  public getHistory(): Promise<Track[]> {
    return this.send<Track[]>('get_history');
  }

  public addHistory(track: Track): Promise<{ success: boolean }> {
    return this.send<{ success: boolean }>('add_history', track).then((res) => {
      this.notifyLibraryChange();
      return res;
    });
  }

  public getPlaylists(): Promise<Playlist[]> {
    return this.send<Playlist[]>('get_playlists');
  }

  public getAuthState(): Promise<AuthState> {
    return this.send<AuthState>('get_auth_state');
  }

  public loginEmail(email: string, password: string): Promise<AuthState> {
    return this.send<AuthState>('login_email', { email, password });
  }

  public registerEmail(email: string, password: string, displayName: string, avatarUrl?: string): Promise<AuthState> {
    return this.send<AuthState>('register_email', { email, password, displayName, avatarUrl });
  }

  public loginYouTube(): Promise<AuthState> {
    return this.send<AuthState>('login_youtube');
  }

  public guestLogin(): Promise<AuthState> {
    return this.send<AuthState>('guest_login');
  }

  public logout(): Promise<{ success: boolean }> {
    return this.send<{ success: boolean }>('logout');
  }

  public createPlaylist(name: string, description?: string): Promise<Playlist> {
    return this.send<Playlist>('create_playlist', { name, description });
  }

  private libraryListeners: Set<() => void> = new Set();

  public onLibraryChange(callback: () => void): () => void {
    this.libraryListeners.add(callback);
    return () => this.libraryListeners.delete(callback);
  }

  public notifyLibraryChange(): void {
    this.libraryListeners.forEach((cb) => {
      try { cb(); } catch (e) { console.error(e); }
    });
  }

  public addTrackToPlaylist(playlistId: string, track: Track): Promise<{ success: boolean }> {
    return this.send<{ success: boolean }>('add_to_playlist', { playlistId, track }).then((res) => {
      this.notifyLibraryChange();
      return res;
    });
  }

  public removeFromPlaylist(playlistId: string, trackId: string): Promise<{ success: boolean }> {
    return this.send<{ success: boolean }>('remove_from_playlist', { playlistId, trackId }).then((res) => {
      this.notifyLibraryChange();
      return res;
    });
  }

  public deletePlaylist(playlistId: string): Promise<{ success: boolean }> {
    return this.send<{ success: boolean }>('delete_playlist', { playlistId }).then((res) => {
      this.notifyLibraryChange();
      return res;
    });
  }

    public on(eventName: string, handler: (payload: any) => void): () => void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }
    this.eventListeners.get(eventName)!.add(handler);
    return () => this.off(eventName, handler);
  }

  public off(eventName: string, handler: (payload: any) => void): void {
    this.eventListeners.get(eventName)?.delete(handler);
  }

  
  public async getAppVersion(): Promise<string> {
    if (this.isNativeAvailable) {
      try {
        const res = await this.send<{ version: string }>('get_app_version');
        if (res && res.version) {
          this.appVersion = res.version;
          return res.version;
        }
      } catch (e) {
        console.warn('Failed to get native app version:', e);
      }
    }
    return this.appVersion;
  }

  public checkForUpdates(): Promise<UpdateInfo> {
    return this.send<UpdateInfo>('check_for_updates');
  }

  public installUpdate(downloadUrl: string): Promise<{ success: boolean }> {
    return this.send<{ success: boolean }>('install_update', { downloadUrl });
  }

  public openExternalUrl(url: string): void {
    if (this.isNativeAvailable) {
      this.send('open_external_url', { url }).catch(() => { window.open(url, '_blank', 'noopener,noreferrer'); });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

    public windowDrag(): void {
    if (this.isNativeAvailable) {
      this.send('window_drag');
    }
  }

  public windowMinimize(): void {
    if (this.isNativeAvailable) {
      this.send('window_minimize');
    }
  }

  public windowMaximize(): void {
    if (this.isNativeAvailable) {
      this.send('window_maximize');
    }
  }

  public windowClose(): void {
    if (this.isNativeAvailable) {
      this.send('window_close');
    }
  }

  public updatePlaybackState(state: {
    hasTrack: boolean;
    isPlaying: boolean;
    title?: string;
    artist?: string;
    thumbnailUrl?: string;
    progress?: number;
  }): Promise<{ success: boolean }> {
    return this.send('update_playback_state', state);
  }

  // Fallback mock data when running in standalone browser
  private async mockFallback<T>(action: string, payload: any): Promise<T> {
    await new Promise((r) => setTimeout(r, 200));

    const sampleTracks: Track[] = [
      { id: '1', title: 'Ashke', artist: 'Karan Aujla, Mxrci', duration: 185, thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop' },
      { id: '2', title: 'Alfaaz', artist: 'Hamza Malik, Zain Zohaib', duration: 220, thumbnailUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop' },
      { id: '3', title: 'Casa Tupka Anthemo', artist: 'Yo Yo Honey Singh', duration: 195, thumbnailUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop' },
      { id: '4', title: 'Shree Hanuman Chalisa', artist: 'Hariharan, Lalit Sen', duration: 580, thumbnailUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&h=300&fit=crop' },
      { id: '5', title: 'Ooroda Oththa Don', artist: 'Sai Abhyankkar', duration: 240, thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop' },
      { id: '6', title: 'One Sun One Moon', artist: 'Anirudh Ravichander', duration: 210, thumbnailUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&h=300&fit=crop' },
      { id: '7', title: 'Guzarish', artist: 'Satinder Sartaaj', duration: 275, thumbnailUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop' },
    ];

    const sampleArtists: Artist[] = [
      { id: 'sushin_shyam', name: 'Sushin Shyam', thumbnailUrl: 'https://cdn-images.dzcdn.net/images/artist/6ba914ca28d2c5cc21dc3effa07c690d/500x500-000000-80-0-0.jpg', topTracks: sampleTracks },
      { id: 'ar_rahman', name: 'A.R. Rahman', thumbnailUrl: 'https://cdn-images.dzcdn.net/images/artist/bd34315ef977a62a9e28c1ab19bb8ac4/500x500-000000-80-0-0.jpg', topTracks: sampleTracks },
      { id: 'anirudh', name: 'Anirudh Ravichander', thumbnailUrl: 'https://cdn-images.dzcdn.net/images/artist/9da0a547b39e99bc35c6a9724aef91bf/500x500-000000-80-0-0.jpg', topTracks: sampleTracks },
      { id: 'arijit_singh', name: 'Arijit Singh', thumbnailUrl: 'https://cdn-images.dzcdn.net/images/artist/ac5350cff290edd5b69fa584b8b1bd4f/500x500-000000-80-0-0.jpg', topTracks: sampleTracks },
      { id: 'pritam', name: 'Pritam', thumbnailUrl: 'https://cdn-images.dzcdn.net/images/artist/d4914ccd414067cd5e2c108867079a85/500x500-000000-80-0-0.jpg', topTracks: sampleTracks },
      { id: 'shreya_ghoshal', name: 'Shreya Ghoshal', thumbnailUrl: 'https://cdn-images.dzcdn.net/images/artist/3bb832d37d10ff2affcfa9afdc7c68a0/500x500-000000-80-0-0.jpg', topTracks: sampleTracks },
      { id: 'sid_sriram', name: 'Sid Sriram', thumbnailUrl: 'https://cdn-images.dzcdn.net/images/artist/fbe3e1d17fc6958e047f011f74233f82/500x500-000000-80-0-0.jpg', topTracks: sampleTracks },
      { id: 'ks_harisankar', name: 'K.S. Harisankar', thumbnailUrl: 'https://cdn-images.dzcdn.net/images/artist/54efec3e5ed3de1ed27924e804d93b82/500x500-000000-80-0-0.jpg', topTracks: sampleTracks },
    ];

    const sampleAlbums: Album[] = [
      { id: 'aavesham', title: 'Aavesham', artist: 'Sushin Shyam', thumbnailUrl: 'https://i.ytimg.com/vi/tOM-nWPcR4U/hqdefault.jpg', year: '2024', tracks: sampleTracks },
      { id: 'manjummel_boys', title: 'Manjummel Boys', artist: 'Sushin Shyam', thumbnailUrl: 'https://i.ytimg.com/vi/0pWsChox33I/hqdefault.jpg', year: '2024', tracks: sampleTracks },
      { id: 'aashiqui2', title: 'Aashiqui 2', artist: 'Mithoon, Ankit Tiwari', thumbnailUrl: 'https://i.ytimg.com/vi/72X7f56Z1eQ/hqdefault.jpg', year: '2013', tracks: sampleTracks },
      { id: 'rockstar', title: 'Rockstar', artist: 'A.R. Rahman', thumbnailUrl: 'https://i.ytimg.com/vi/6MgsHSAcI9k/hqdefault.jpg', year: '2011', tracks: sampleTracks },
    ];

    const sampleMixes: Album[] = [
      { id: 'supermix', title: 'My Supermix', artist: 'Arijit Singh, Sushin Shyam, A.R. Rahman, Anirudh', thumbnailUrl: 'https://i.ytimg.com/vi/tOM-nWPcR4U/hqdefault.jpg', year: 'Mix', tracks: sampleTracks },
      { id: 'mix1', title: 'My Mix 1', artist: 'Sushin Shyam, Kapil Kapilan, M.H.R, Rzee', thumbnailUrl: 'https://i.ytimg.com/vi/0pWsChox33I/hqdefault.jpg', year: 'Mix', tracks: sampleTracks },
      { id: 'mix2', title: 'My Mix 2', artist: 'A.R. Rahman, Sid Sriram, Shreya Ghoshal', thumbnailUrl: 'https://i.ytimg.com/vi/6MgsHSAcI9k/hqdefault.jpg', year: 'Mix', tracks: sampleTracks },
      { id: 'mix3', title: 'My Mix 3', artist: 'Anirudh Ravichander, Sean Roldan, Jonita Gandhi', thumbnailUrl: 'https://i.ytimg.com/vi/1F3hm6MfR1k/hqdefault.jpg', year: 'Mix', tracks: sampleTracks },
    ];

    if (action === 'get_home_feed') {
      return {
        trendingSongs: sampleTracks,
        popularArtists: sampleArtists,
        popularAlbums: sampleAlbums,
        quickPicks: sampleTracks,
        mixedForYou: sampleMixes
      } as unknown as T;
    }

    if (action === 'get_album_or_playlist') {
      return {
        id: 'mock_alb',
        title: payload.title,
        artist: payload.artist,
        thumbnailUrl: payload.thumbnailUrl,
        year: '2026',
        tracks: sampleTracks
      } as unknown as T;
    }

    if (action === 'get_artist_details') {
      return {
        id: 'mock_art',
        name: payload.name,
        thumbnailUrl: payload.thumbnailUrl,
        topTracks: sampleTracks
      } as unknown as T;
    }

    if (action === 'get_stream_url') {
      return { url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' } as unknown as T;
    }

    if (action === 'get_playlists') {
      return [
        { id: 'p1', name: 'My Favorite Hits', description: 'Top picks', tracks: sampleTracks.slice(0, 3) }
      ] as unknown as T;
    }

    if (action === 'create_playlist') {
      return { id: 'p_new', name: payload.name, tracks: [] } as unknown as T;
    }

    if (action === 'add_to_playlist' || action === 'remove_from_playlist' || action === 'delete_playlist') {
      return { success: true } as unknown as T;
    }

    if (action === 'toggle_favorite') {
      return { isFavorite: true } as unknown as T;
    }

    if (action === 'get_favorites') {
      return sampleTracks.slice(0, 4) as unknown as T;
    }

    if (action === 'get_lyrics') {
      return {
        trackId: payload.id,
        isSynced: true,
        lines: [
          { timeMs: 0, text: "♪ (Music Intro)" },
          { timeMs: 4000, text: "Ik vaari aa bhi ja yaara" },
          { timeMs: 8000, text: "Ik vaari aa bhi ja" },
          { timeMs: 12000, text: "Raahon mein bikhre hai armaan" },
          { timeMs: 16000, text: "Tu na jaane dil ka jahaan" }
        ]
      } as unknown as T;
    }

    if (action === 'get_smart_radio') {
      return sampleTracks as unknown as T;
    }

    if (action === 'search') {
      return {
        query: payload.query,
        tracks: sampleTracks,
        albums: sampleAlbums,
        artists: sampleArtists
      } as unknown as T;
    }

    return {} as T;
  }
}

export const bridge = new NativeBridge();
