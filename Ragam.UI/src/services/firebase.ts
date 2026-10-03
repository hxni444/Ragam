import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  type User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs 
} from 'firebase/firestore';
import type { AuthState, Playlist } from '../types';

// Firebase Project config - sanitized and loaded via environment variables
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

export const isFirebaseConfigured = !!firebaseConfig.apiKey;

const app = isFirebaseConfigured
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp())
  : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

export const mapFirebaseUserToAuthState = (user: FirebaseUser | null): AuthState => {
  if (!user) {
    return { isLoggedIn: false };
  }
  return {
    isLoggedIn: true,
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

// Cloud Sync Helpers
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
