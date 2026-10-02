import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search, Home as HomeIcon, LogOut, User } from 'lucide-react';
import type { NavigationTarget, AuthState } from '../types';
import { bridge } from '../services/bridge';
import { auth, mapFirebaseUserToAuthState, logoutFromFirebase } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthModal } from './AuthModal';

interface HeaderProps {
  onNavigate: (target: NavigationTarget) => void;
  onSearch: (query: string) => void;
  searchQuery: string;
  canGoBack: boolean;
  onGoBack: () => void;
  canGoForward?: boolean;
  onGoForward?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  onNavigate, 
  onSearch, 
  searchQuery, 
  canGoBack, 
  onGoBack,
  canGoForward = false,
  onGoForward
}) => {
  const [authState, setAuthState] = useState<AuthState>({ isLoggedIn: false });
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    // 1. Initial bridge check
    bridge.getAuthState().then(setAuthState).catch(console.error);

    // 2. Firebase persistence listener across app launches / restarts
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthState(mapFirebaseUserToAuthState(user));
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await logoutFromFirebase();
    } catch (e) {
      console.warn('Firebase logout warning:', e);
    }
    await bridge.logout();
    setAuthState({ isLoggedIn: false });
    setShowUserMenu(false);
  };

  return (
    <header className="top-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="nav-arrows">
          <button 
            className="arrow-btn" 
            onClick={onGoBack} 
            disabled={!canGoBack}
            style={{ opacity: canGoBack ? 1 : 0.4, cursor: canGoBack ? 'pointer' : 'default' }}
            title="Go back"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            className="arrow-btn" 
            onClick={onGoForward} 
            disabled={!canGoForward}
            style={{ opacity: canGoForward ? 1 : 0.4, cursor: canGoForward ? 'pointer' : 'default' }}
            title="Go forward"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Home icon button */}
        <button 
          className="arrow-btn"
          onClick={() => onNavigate({ tab: 'home' })}
          title="Home"
          style={{ width: '40px', height: '40px', background: '#242424' }}
        >
          <HomeIcon size={18} />
        </button>

        {/* Search Pill Input */}
        <div className="search-pill-container">
          <Search size={18} color="#b3b3b3" />
          <input
            type="text"
            className="search-pill-input"
            placeholder="What do you want to play?"
            value={searchQuery}
            onChange={(e) => {
              onSearch(e.target.value);
              onNavigate({ tab: 'search', query: e.target.value });
            }}
          />
        </div>
      </div>

      {/* Right: Auth / Log In Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', position: 'relative' }}>
        {authState.isLoggedIn ? (
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: '#242424', padding: '4px 12px 4px 6px', borderRadius: '500px' }}
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <img 
              src={authState.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop"} 
              alt="Avatar" 
              style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
            />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
              {authState.userName || 'Account'}
            </span>

            {showUserMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  background: '#282828',
                  borderRadius: '6px',
                  padding: '6px',
                  minWidth: '140px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                  zIndex: 200
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div 
                  onClick={handleLogout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    color: '#ff5454',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <LogOut size={16} />
                  <span>Log out</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setIsAuthModalOpen(true)}
            style={{
              background: '#ffffff',
              color: '#000000',
              border: 'none',
              borderRadius: '500px',
              padding: '8px 22px',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.04)';
              e.currentTarget.style.background = '#f0f0f0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            <User size={16} strokeWidth={2.5} />
            <span>Log in</span>
          </button>
        )}
      </div>

      {/* In-App Authentication Dialog */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(state) => setAuthState(state)}
      />
    </header>
  );
};
