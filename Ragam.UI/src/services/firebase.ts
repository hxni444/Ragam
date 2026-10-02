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

// Firebase Project config for Layam
export const firebaseConfig = {
  apiKey: "AIzaSyChY1h4kml1hglDzIF-3K3iDKmugAUt5AU",
  authDomain: "layam-7b80f.firebaseapp.com",
  projectId: "layam-7b80f",
  storageBucket: "layam-7b80f.firebasestorage.app",
  messagingSenderId: "976431641719",
  appId: "1:976431641719:web:7de3873be7273baa214272",
  measurementId: "G-XB2GB3XWQ5"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

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
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  return mapFirebaseUserToAuthState(cred.user);
};

export const registerWithFirebase = async (
  email: string, 
  pass: string, 
  displayName: string, 
  avatarUrl?: string
): Promise<AuthState> => {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  await updateProfile(cred.user, {
    displayName: displayName.trim() || email.split('@')[0],
    photoURL: avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop'
  });
  return mapFirebaseUserToAuthState(auth.currentUser);
};

export const loginWithGoogle = async (): Promise<AuthState> => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  return mapFirebaseUserToAuthState(cred.user);
};

export const logoutFromFirebase = async (): Promise<void> => {
  await signOut(auth);
};

// Cloud Sync Helpers
export const syncPlaylistToCloud = async (userId: string, playlist: Playlist): Promise<void> => {
  try {
    const ref = doc(db, 'users', userId, 'playlists', playlist.id);
    await setDoc(ref, playlist, { merge: true });
  } catch (err) {
    console.warn('Failed to sync playlist to Firebase:', err);
  }
};

export const fetchCloudPlaylists = async (userId: string): Promise<Playlist[]> => {
  try {
    const col = collection(db, 'users', userId, 'playlists');
    const snap = await getDocs(col);
    return snap.docs.map((d) => d.data() as Playlist);
  } catch (err) {
    console.warn('Failed to fetch cloud playlists:', err);
    return [];
  }
};
