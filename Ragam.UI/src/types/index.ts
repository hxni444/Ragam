export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  thumbnailUrl: string;
  audioUrl?: string;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  year?: string;
  tracks: Track[];
}

export interface Artist {
  id: string;
  name: string;
  thumbnailUrl: string;
  topTracks: Track[];
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  tracks: Track[];
}

export interface SearchResult {
  query: string;
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
}

export interface AuthState {
  isLoggedIn: boolean;
  userName?: string;
  userEmail?: string;
  avatarUrl?: string;
}

export interface LyricLine {
  timeMs: number;
  text: string;
}

export interface Lyrics {
  trackId: string;
  isSynced: boolean;
  lines: LyricLine[];
  plainLyrics?: string;
}

export interface MoodAndGenreItem {
  title: string;
  stripeColor: string;
  params?: string;
  browseId?: string;
}

export interface HomeChip {
  title: string;
  params?: string;
}

export interface HomeSectionItem {
  type: 'song' | 'album' | 'playlist' | 'artist';
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  year?: string;
  duration?: number;
  tracks?: Track[];
}

export interface HomeSection {
  title: string;
  subtitle?: string;
  thumbnailUrl?: string;
  items: HomeSectionItem[];
}

export interface HomeFeed {
  chips?: HomeChip[];
  sections?: HomeSection[];
  continuation?: string;
  trendingSongs?: Track[];
  popularArtists?: Artist[];
  popularAlbums?: Album[];
  quickPicks: Track[];
  mixedForYou?: Album[];
  freshDrops?: Track[];
  recommended?: Track[];
  recommendedTitle?: string;
  keepListening?: Track[];
  albumsForYou?: Album[];
  freshFinds?: Track[];
  communityPlaylists?: Album[];
  moodAndGenres?: MoodAndGenreItem[];
}

export type RepeatMode = 'off' | 'all' | 'one';

export type NavigationTarget =
  | { tab: 'home' }
  | { tab: 'search'; query?: string }
  | { tab: 'library' }
  | { tab: 'favorites' }
  | { tab: 'history' }
  | { tab: 'album'; album: Album }
  | { tab: 'artist'; artist: Artist }
  | { tab: 'playlist'; playlist: Playlist }
  | { tab: 'mood'; mood: MoodAndGenreItem }
  | { tab: 'explore_moods' };
