import React, { useState, useRef, useLayoutEffect } from 'react';
import { TitleBar } from './components/TitleBar';
import { UpdateModal } from './components/UpdateModal';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PlayerBar } from './components/PlayerBar';
import { SyncedLyricsView } from './components/SyncedLyricsView';
import { QueueDrawer } from './components/QueueDrawer';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { LibraryPage } from './pages/LibraryPage';
import { AlbumDetailPage } from './pages/AlbumDetailPage';
import { ArtistDetailPage } from './pages/ArtistDetailPage';
import { PlaylistDetailPage } from './pages/PlaylistDetailPage';
import { PlayerProvider } from './context/PlayerContext';
import type { NavigationTarget } from './types';
import './styles/index.css';

export const App: React.FC = () => {
  const [history, setHistory] = useState<NavigationTarget[]>([{ tab: 'home' }]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  
  const scrollPositionsRef = useRef<Map<number, number>>(new Map());
  const contentAreaRef = useRef<HTMLElement | null>(null);

  const currentTarget = history[currentIndex] || { tab: 'home' };

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
      // Save current scroll position of the detail page
      if (contentAreaRef.current) {
        scrollPositionsRef.current.set(currentIndex, contentAreaRef.current.scrollTop);
      }
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Restore scroll position whenever index or target changes
  useLayoutEffect(() => {
    const targetScroll = scrollPositionsRef.current.get(currentIndex) || 0;
    if (contentAreaRef.current) {
      contentAreaRef.current.scrollTop = targetScroll;
    }

    // Double-check with a frame tick in case components take a cycle to render
    const frame = requestAnimationFrame(() => {
      if (contentAreaRef.current) {
        contentAreaRef.current.scrollTop = targetScroll;
      }
    });

    return () => cancelAnimationFrame(frame);
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
            </main>
          </div>

          <QueueDrawer />
          <SyncedLyricsView />
        </div>

        <PlayerBar />
        <UpdateModal />
      </div>
    </PlayerProvider>
  );
};

export default App;
