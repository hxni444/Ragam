import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Mail, Lock, User, Sparkles, Loader2 } from 'lucide-react';
import { bridge } from '../services/bridge';
import { loginWithFirebase, registerWithFirebase, loginWithGoogle } from '../services/firebase';
import type { AuthState } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (state: AuthState) => void;
}

const AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&h=120&fit=crop',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=120&h=120&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop'
];

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let state: AuthState;
      try {
        if (tab === 'signin') {
          state = await loginWithFirebase(email, password);
        } else {
          state = await registerWithFirebase(email, password, displayName, selectedAvatar);
        }
      } catch (fbErr: any) {
        // Map common Firebase errors
        const code = fbErr.code || '';
        if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
          throw new Error('Invalid email or password.');
        } else if (code === 'auth/email-already-in-use') {
          throw new Error('An account with this email already exists.');
        } else if (code === 'auth/weak-password') {
          throw new Error('Password should be at least 6 characters.');
        } else if (code === 'auth/invalid-email') {
          throw new Error('Please enter a valid email address.');
        } else {
          // If Firebase config or offline, fallback to local backend auth
          console.warn('Firebase error, attempting local auth fallback:', fbErr);
          if (tab === 'signin') {
            state = await bridge.loginEmail(email, password);
          } else {
            state = await bridge.registerEmail(email, password, displayName, selectedAvatar);
          }
        }
      }

      onAuthSuccess(state);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleYouTubeSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const state = await bridge.loginYouTube();
      if (state && state.isLoggedIn) {
        onAuthSuccess(state);
        onClose();
        // Refresh to immediately populate YouTube Music home feed
        window.location.reload();
      }
    } catch (err: any) {
      console.error('YouTube sign-in error:', err);
      setError(err.message || 'YouTube Music sign-in was cancelled or failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const state = await loginWithGoogle();
      onAuthSuccess(state);
      onClose();
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      const code = err.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      } else if (code === 'auth/popup-blocked') {
        setError('Google sign-in popup was blocked by the browser. Please allow popups.');
      } else {
        setError(err.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGuest = async () => {
    setError(null);
    setLoading(true);
    try {
      const state = await bridge.guestLogin();
      onAuthSuccess(state);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Guest login failed.');
    } finally {
      setLoading(false);
    }
  };

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(16px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }} onClick={onClose}>
      <div 
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#121212',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-subdued)',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <X size={20} />
        </button>

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary)', marginBottom: '12px' }}>
            <Sparkles size={24} color="#000" />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff' }}>
            {tab === 'signin' ? 'Welcome back to Layam' : 'Create your account'}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-subdued)', marginTop: '4px' }}>
            {tab === 'signin' ? 'Sign in to access your library and personalized feed' : 'Join Layam to save playlists and personalized recommendations'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: '#1e1e1e', borderRadius: '8px', padding: '3px', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={() => { setTab('signin'); setError(null); }}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              borderRadius: '6px',
              background: tab === 'signin' ? 'var(--primary)' : 'transparent',
              color: tab === 'signin' ? '#000' : 'var(--text-subdued)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('signup'); setError(null); }}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              borderRadius: '6px',
              background: tab === 'signup' ? 'var(--primary)' : 'transparent',
              color: tab === 'signup' ? '#000' : 'var(--text-subdued)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            background: 'rgba(255, 84, 84, 0.12)',
            border: '1px solid rgba(255, 84, 84, 0.3)',
            borderRadius: '6px',
            padding: '10px 12px',
            fontSize: '13px',
            color: '#ff6b6b',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {tab === 'signup' && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
                Your Name
              </label>
              <div style={{ display: 'flex', alignItems: 'center', background: '#1e1e1e', borderRadius: '6px', padding: '0 12px', border: '1px solid var(--border-subtle)' }}>
                <User size={16} color="var(--text-subdued)" />
                <input 
                  type="text" 
                  placeholder="e.g. Alex Miller"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: 'none', padding: '10px 10px', color: '#fff', fontSize: '14px', outline: 'none' }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
              Email address
            </label>
            <div style={{ display: 'flex', alignItems: 'center', background: '#1e1e1e', borderRadius: '6px', padding: '0 12px', border: '1px solid var(--border-subtle)' }}>
              <Mail size={16} color="var(--text-subdued)" />
              <input 
                type="email" 
                placeholder="name@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ flex: 1, background: 'transparent', border: 'none', padding: '10px 10px', color: '#fff', fontSize: '14px', outline: 'none' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ display: 'flex', alignItems: 'center', background: '#1e1e1e', borderRadius: '6px', padding: '0 12px', border: '1px solid var(--border-subtle)' }}>
              <Lock size={16} color="var(--text-subdued)" />
              <input 
                type="password" 
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ flex: 1, background: 'transparent', border: 'none', padding: '10px 10px', color: '#fff', fontSize: '14px', outline: 'none' }}
              />
            </div>
          </div>

          {tab === 'signup' && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                Choose Profile Avatar
              </label>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {AVATARS.map((av, idx) => (
                  <img
                    key={idx}
                    src={av}
                    alt={`Avatar ${idx}`}
                    onClick={() => setSelectedAvatar(av)}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      border: selectedAvatar === av ? '2px solid var(--primary)' : '2px solid transparent',
                      transform: selectedAvatar === av ? 'scale(1.1)' : 'scale(1)',
                      transition: 'all 0.15s ease'
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || googleLoading}
            style={{
              marginTop: '8px',
              padding: '12px',
              background: 'var(--primary)',
              color: '#000',
              border: 'none',
              borderRadius: '500px',
              fontWeight: 800,
              fontSize: '14px',
              cursor: (loading || googleLoading) ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'transform 0.15s ease'
            }}
            onMouseEnter={(e) => { if (!loading && !googleLoading) e.currentTarget.style.transform = 'scale(1.02)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            <span>{tab === 'signin' ? 'Sign In' : 'Create Account'}</span>
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0 16px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-subdued)', fontWeight: 600 }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
        </div>

        {/* YouTube Music Sign-in Button */}
        <button
          type="button"
          onClick={handleYouTubeSignIn}
          disabled={loading || googleLoading}
          style={{
            width: '100%',
            padding: '11px 16px',
            background: '#ff0000',
            color: '#ffffff',
            border: 'none',
            borderRadius: '500px',
            fontWeight: 800,
            fontSize: '13px',
            cursor: (loading || googleLoading) ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '10px',
            transition: 'background 0.15s, transform 0.15s',
            boxShadow: '0 2px 10px rgba(255, 0, 0, 0.3)'
          }}
          onMouseEnter={(e) => { if (!loading && !googleLoading) { e.currentTarget.style.background = '#e60000'; e.currentTarget.style.transform = 'scale(1.01)'; } }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#ff0000'; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {googleLoading ? (
            <Loader2 size={18} className="animate-spin" color="#ffffff" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
          )}
          <span>{googleLoading ? 'Connecting...' : 'Sign in with YouTube Music'}</span>
        </button>

        {/* Google Sign-in Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading || googleLoading}
          style={{
            width: '100%',
            padding: '11px 16px',
            background: '#ffffff',
            color: '#1f1f1f',
            border: 'none',
            borderRadius: '500px',
            fontWeight: 700,
            fontSize: '13px',
            cursor: (loading || googleLoading) ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            transition: 'background 0.15s, transform 0.15s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
          onMouseEnter={(e) => { if (!loading && !googleLoading) { e.currentTarget.style.background = '#f1f1f1'; e.currentTarget.style.transform = 'scale(1.01)'; } }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Optional Guest Link */}
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <button
            type="button"
            onClick={handleGuest}
            disabled={loading || googleLoading}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-subdued)',
              fontSize: '12px',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '4px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-subdued)'}
          >
            or Continue as Guest
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
