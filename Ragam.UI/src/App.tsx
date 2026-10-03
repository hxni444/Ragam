import React, { useState, useRef, useLayoutEffect, useEffect, useMemo, useCallback } from 'react';
import { TitleBar } from './components/TitleBar';
import { UpdateModal } from './components/UpdateModal';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PlayerBar } from './components/PlayerBar';
import { SyncedLyricsView } from './components/SyncedLyricsView';
import { NowPlayingView } from './components/NowPlayingView';
import { QueueDrawer } from './components/QueueDrawer';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { LibraryPage } from './pages/LibraryPage';
import { AlbumDetailPage } from './pages/AlbumDetailPage';
import { ArtistDetailPage } from './pages/ArtistDetailPage';
import { PlaylistDetailPage } from './pages/PlaylistDetailPage';
import { MoodCategoryPage } from './pages/MoodCategoryPage';
import { ExploreMoodsPage } from './pages/ExploreMoodsPage';
import { PlayerProvider } from './context/PlayerContext';
import type { NavigationTarget } from './types';
import './styles/index.css';

const STORAGE_KEY_APP_STATE = 'ragam_saved_navigation_state_v1';

interface SavedAppState {
  history: NavigationTarget[];
  currentIndex: number;
  scrollPositions: [number, number][];
  searchQuery?: string;
}

const loadSavedState = (): { initialHistory: NavigationTarget[]; initialIndex: number; initialScrolls: Map<number, number>; initialQuery: string } => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_APP_STATE);
    if (saved) {
      const parsed: SavedAppState = JSON.parse(saved);
      if (Array.isArray(parsed.history) && parsed.history.length > 0) {
        const safeIndex = Math.min(Math.max(0, parsed.currentIndex || 0), parsed.history.length - 1);
        const map = new Map<number, number>(parsed.scrollPositions || []);
        return {
          initialHistory: parsed.history,
          initialIndex: safeIndex,
          initialScrolls: map,
          initialQuery: parsed.searchQuery || ''
        };
      }
    }
  } catch (e) {
    console.warn('Failed to load saved app navigation state:', e);
  }
  return {
    initialHistory: [{ tab: 'home' }],
    initialIndex: 0,
    initialScrolls: new Map(),
    initialQuery: ''
  };
};

export const App: React.FC = () => {
  const savedState = useMemo(() => loadSavedState(), []);
  const [history, setHistory] = useState<NavigationTarget[]>(savedState.initialHistory);
  const [currentIndex, setCurrentIndex] = useState(savedState.initialIndex);
  const [searchQuery, setSearchQuery] = useState(savedState.initialQuery);
  
  const scrollPositionsRef = useRef<Map<number, number>>(savedState.initialScrolls);
  const contentAreaRef = useRef<HTMLElement | null>(null);

  const currentTarget = history[currentIndex] || { tab: 'home' };

  // Save current navigation state & scroll positions to localStorage
  const saveStateToStorage = useCallback(() => {
    try {
      if (contentAreaRef.current) {
        scrollPositionsRef.current.set(currentIndex, contentAreaRef.current.scrollTop);
      }
      const dataToSave: SavedAppState = {
        history,
        currentIndex,
        scrollPositions: Array.from(scrollPositionsRef.current.entries()),
        searchQuery
      };
      localStorage.setItem(STORAGE_KEY_APP_STATE, JSON.stringify(dataToSave));
    } catch (e) {
      console.warn('Failed to save app navigation state:', e);
    }
  }, [history, currentIndex, searchQuery]);

  // Persist state whenever history, index or query updates
  useEffect(() => {
    saveStateToStorage();
  }, [history, currentIndex, searchQuery, saveStateToStorage]);

  // Real-time debounced scroll listener so closing the app at any scroll position restores it accurately
  useEffect(() => {
    const el = contentAreaRef.current;
    if (!el) return;

    let timeoutId: any = null;
    const handleScroll = () => {
      scrollPositionsRef.current.set(currentIndex, el.scrollTop);
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        saveStateToStorage();
      }, 300);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      el.removeEventListener('scroll', handleScroll);
    };
  }, [currentIndex, saveStateToStorage]);

  // Save on window beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveStateToStorage();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStateToStorage]);

  const navigateTo = (target: NavigationTarget) => {
    // Save current scroll position of the current page before navigating away
    if (contentAreaRef.current) {
      scrollPositionsRef.current.set(currentIndex, contentAreaRef.current.scrollTop);
    }

    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(target);
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
    if (target.tab === 'search' && target.query !== undefined) {
      setSearchQuery(target.query);
    }
  };

  const handleGoBack = () => {
    if (currentIndex > 0) {
      if (contentAreaRef.current) {
        scrollPositionsRef.current.set(currentIndex, contentAreaRef.current.scrollTop);
      }
      setCurrentIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  const handleGoForward = () => {
    if (currentIndex < history.length - 1) {
      if (contentAreaRef.current) {
        scrollPositionsRef.current.set(currentIndex, contentAreaRef.current.scrollTop);
      }
      setCurrentIndex((prev) => Math.min(prev + 1, history.length - 1));
    }
  };

  // Trackpad 2-finger horizontal swipe gesture & Mouse Back/Forward navigation
  useEffect(() => {
    let lastSwipeTime = 0;
    let accumulatedDeltaX = 0;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.2 && Math.abs(e.deltaX) > 15) {
        accumulatedDeltaX += e.deltaX;
        const now = Date.now();

        if (now - lastSwipeTime > 500) {
          if (accumulatedDeltaX < -40) {
            handleGoBack();
            lastSwipeTime = now;
            accumulatedDeltaX = 0;
          } else if (accumulatedDeltaX > 40) {
            handleGoForward();
            lastSwipeTime = now;
            accumulatedDeltaX = 0;
          }
        }
      } else {
        accumulatedDeltaX = 0;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        handleGoBack();
      } else if (e.button === 4) {
        e.preventDefault();
        handleGoForward();
      }
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleGoBack();
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleGoForward();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [currentIndex, history.length]);

  // Restore scroll position whenever index or target changes
  useLayoutEffect(() => {
    const targetScroll = scrollPositionsRef.current.get(currentIndex) || 0;
    if (contentAreaRef.current) {
      contentAreaRef.current.scrollTop = targetScroll;
    }

    const frame = requestAnimationFrame(() => {
      if (contentAreaRef.current) {
        contentAreaRef.current.scrollTop = targetScroll;
      }
    });

    const timer = setTimeout(() => {
      if (contentAreaRef.current && contentAreaRef.current.scrollTop !== targetScroll) {
        contentAreaRef.current.scrollTop = targetScroll;
      }
    }, 150);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [currentIndex, currentTarget]);

  return (
    <PlayerProvider>
      <div className="app-container">
        <TitleBar />

        <div className="main-body">
          <Sidebar currentTarget={currentTarget} onNavigate={navigateTo} />

          <div className="content-wrapper">
            <Header 
              onNavigate={navigateTo}
              onSearch={setSearchQuery}
              searchQuery={searchQuery}
              canGoBack={currentIndex > 0}
              onGoBack={handleGoBack}
            />

            <main ref={contentAreaRef} className="content-area">
              {currentTarget.tab === 'home' && <HomePage onNavigate={navigateTo} />}
              {currentTarget.tab === 'search' && (
                <SearchPage initialQuery={searchQuery} onNavigate={navigateTo} />
              )}
              {currentTarget.tab === 'library' && (
                <LibraryPage initialTab="all" onNavigate={navigateTo} />
              )}
              {currentTarget.tab === 'favorites' && (
                <LibraryPage initialTab="favorites" onNavigate={navigateTo} />
              )}
              {currentTarget.tab === 'history' && (
                <LibraryPage initialTab="history" onNavigate={navigateTo} />
              )}
              {currentTarget.tab === 'album' && (
                <AlbumDetailPage album={currentTarget.album} />
              )}
              {currentTarget.tab === 'artist' && (
                <ArtistDetailPage artist={currentTarget.artist} />
              )}
              {currentTarget.tab === 'playlist' && (
                <PlaylistDetailPage playlist={currentTarget.playlist} onNavigate={navigateTo} />
              )}
              {currentTarget.tab === 'mood' && (
                <MoodCategoryPage mood={currentTarget.mood} onNavigate={navigateTo} />
              )}
              {currentTarget.tab === 'explore_moods' && (
                <ExploreMoodsPage onNavigate={navigateTo} />
              )}
            </main>
          </div>

          <QueueDrawer />
          <SyncedLyricsView />
          <NowPlayingView />
        </div>

        <PlayerBar />
        <UpdateModal />
      </div>
    </PlayerProvider>
  );
};

export default App;
