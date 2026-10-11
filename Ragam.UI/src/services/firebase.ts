import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  type User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import type { AuthState, Playlist, Track } from '../types';

// Cloud Sync Types
export interface CloudNowPlayingState {
  userId?: string;
  track: Track | null;
  isPlaying: boolean;
  positionSec: number;
  timestampMs: number;
  updatedAt?: unknown;
  deviceName?: string;
  volume?: number;
  repeatMode?: string;
  isShuffle?: boolean;
}

export interface CloudHistoryItem {
  id?: string;
  userId?: string;
  track: Track;
  playedAtMs: number;
  playedAt?: unknown;
  device?: string;
}

// Firebase Project config - loaded via env with project layam-7b80f fallbacks
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyChY1h4kml1hglDzIF-3K3iDKmugAUt5AU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "layam-7b80f.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "layam-7b80f",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "layam-7b80f.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "976431641719",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:976431641719:web:7de3873be7273baa214272",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-XB2GB3XWQ5"
};

export const isFirebaseConfigured = !!firebaseConfig.apiKey;

const app = isFirebaseConfigured
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp())
  : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

/**
 * Normalizes an email address or Firebase UID into a safe, consistent Firestore document ID.
 * This guarantees that signing in with YouTube Music (Google email) on Desktop
 * and signing in with Google Auth on Mobile connect to the exact same cloud record!
 */
export const getSyncUserId = (firebaseUid?: string | null, email?: string | null): string | null => {
  if (firebaseUid && firebaseUid.trim()) return firebaseUid.trim();
  if (email && email.trim()) {
    // Normalizes "john.doe@gmail.com" -> "u_john_doe_gmail_com"
    return 'u_' + email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  }
  return null;
};

/**
 * Ensures a background anonymous Firebase session exists if not signed in,
 * so Firestore security rules that require authentication pass seamlessly.
 */
export const ensureFirebaseAuthSession = async (): Promise<void> => {
  if (!auth) return;
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.warn('Anonymous Firebase auth fallback warning:', e);
    }
  }
};

export const mapFirebaseUserToAuthState = (user: FirebaseUser | null): AuthState => {
  if (!user) {
    return { isLoggedIn: false };
  }
  return {
    isLoggedIn: true,
    userId: user.uid,
    userName: user.displayName || user.email?.split('@')[0] || 'User',
    userEmail: user.email || undefined,
    avatarUrl: user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop'
  };
};

export const loginWithFirebase = async (email: string, pass: string): Promise<AuthState> => {
  if (!auth) throw new Error("Firebase not configured");
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  return mapFirebaseUserToAuthState(cred.user);
};

export const registerWithFirebase = async (
  email: string, 
  pass: string, 
  displayName: string, 
  avatarUrl?: string
): Promise<AuthState> => {
  if (!auth) throw new Error("Firebase not configured");
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  await updateProfile(cred.user, {
    displayName: displayName.trim() || email.split('@')[0],
    photoURL: avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop'
  });
  return mapFirebaseUserToAuthState(auth.currentUser);
};

export const loginWithGoogle = async (): Promise<AuthState> => {
  if (!auth) throw new Error("Firebase not configured");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  return mapFirebaseUserToAuthState(cred.user);
};

export const logoutFromFirebase = async (): Promise<void> => {
  if (auth) {
    await signOut(auth);
  }
};

// Cloud Playlist Sync Helpers
export const syncPlaylistToCloud = async (userId: string, playlist: Playlist): Promise<void> => {
  if (!db) return;
  try {
    const ref = doc(db, 'users', userId, 'playlists', playlist.id);
    await setDoc(ref, playlist, { merge: true });
  } catch (err) {
    console.warn('Failed to sync playlist to Firebase:', err);
  }
};

export const fetchCloudPlaylists = async (userId: string): Promise<Playlist[]> => {
  if (!db) return [];
  try {
    const col = collection(db, 'users', userId, 'playlists');
    const snap = await getDocs(col);
    return snap.docs.map((d) => d.data() as Playlist);
  } catch (err) {
    console.warn('Failed to fetch cloud playlists:', err);
    return [];
  }
};

// -------------------------------------------------------------
// Real-time Cloud Playback & Listening History Sync Helpers
// -------------------------------------------------------------

/**
 * Syncs the current playing song state to Firestore `users/{userId}/playback/current`.
 * Notice: This is event-driven (song change, pause, play, seek). It uses an anchor timestamp
 * (`timestampMs` + `positionSec`) so clients calculate live time without polling every second!
 */
export const syncNowPlayingToCloud = async (
  userId: string,
  state: CloudNowPlayingState
): Promise<void> => {
  if (!db || !userId) {
    console.warn('[Firebase Sync] Skipped: db or userId is missing', { db: !!db, userId });
    return;
  }
  try {
    const ref = doc(db, 'users', userId, 'playback', 'current');
    await setDoc(ref, {
      ...state,
      userId,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log(`[Firebase Sync] Updated now-playing in users/${userId}/playback/current:`, state.track?.title, `(isPlaying: ${state.isPlaying})`);
  } catch (err: any) {
    console.error(`[Firebase Sync Error] Failed to update now-playing (${err?.code || 'unknown'}):`, err?.message || err);
  }
};

/**
 * Clears or pauses now-playing state in the cloud (e.g., when the player is closed)
 */
export const clearNowPlayingInCloud = async (userId: string): Promise<void> => {
  if (!db || !userId) return;
  try {
    const ref = doc(db, 'users', userId, 'playback', 'current');
    await setDoc(ref, {
      userId,
      isPlaying: false,
      positionSec: 0,
      timestampMs: Date.now(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log(`[Firebase Sync] Cleared now-playing state in users/${userId}/playback/current`);
  } catch (err: any) {
    console.error(`[Firebase Sync Error] Failed to clear now-playing (${err?.code || 'unknown'}):`, err?.message || err);
  }
};

/**
 * Syncs a played track to `users/{userId}/history`
 */
export const syncTrackHistoryToCloud = async (userId: string, track: Track): Promise<void> => {
  if (!db || !userId) return;
  try {
    const historyCol = collection(db, 'users', userId, 'history');
    const newDocRef = doc(historyCol);
    await setDoc(newDocRef, {
      userId,
      track: {
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album || '',
        duration: track.duration,
        thumbnailUrl: track.thumbnailUrl
      },
      playedAtMs: Date.now(),
      playedAt: serverTimestamp(),
      device: 'Ragam Desktop'
    });
    console.log(`[Firebase Sync] Added track to users/${userId}/history:`, track.title);
  } catch (err: any) {
    console.error(`[Firebase Sync Error] Failed to sync history (${err?.code || 'unknown'}):`, err?.message || err);
  }
};

/**
 * Subscribes to real-time updates of the currently playing song
 * Returns an unsubscribe callback.
 */
export const listenToCloudNowPlaying = (
  userId: string,
  callback: (state: CloudNowPlayingState | null) => void
): (() => void) => {
  if (!db || !userId) return () => {};
  const ref = doc(db, 'users', userId, 'playback', 'current');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as CloudNowPlayingState);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.warn('Error in listenToCloudNowPlaying listener:', err);
    }
  );
};

/**
 * Subscribes to real-time updates of listening history in descending order
 * Returns an unsubscribe callback.
 */
export const listenToCloudHistory = (
  userId: string,
  callback: (history: CloudHistoryItem[]) => void,
  maxItems = 50
): (() => void) => {
  if (!db || !userId) return () => {};
  const historyCol = collection(db, 'users', userId, 'history');
  const q = query(historyCol, orderBy('playedAtMs', 'desc'), limit(maxItems));
  return onSnapshot(
    q,
    (snap) => {
      const items: CloudHistoryItem[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CloudHistoryItem, 'id'>)
      }));
      callback(items);
    },
    (err) => {
      console.warn('Error in listenToCloudHistory listener:', err);
    }
  );
};

/**
 * One-time fetch of listening history from cloud
 */
export const fetchCloudHistory = async (
  userId: string,
  maxItems = 50
): Promise<CloudHistoryItem[]> => {
  if (!db || !userId) return [];
  try {
    const historyCol = collection(db, 'users', userId, 'history');
    const q = query(historyCol, orderBy('playedAtMs', 'desc'), limit(maxItems));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CloudHistoryItem, 'id'>)
    }));
  } catch (err) {
    console.warn('Failed to fetch cloud history:', err);
    return [];
  }
};

