import React, { useState } from 'react';
import { TitleBar } from './components/TitleBar';
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

  const currentTarget = history[currentIndex] || { tab: 'home' };

  const navigateTo = (target: NavigationTarget) => {
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
      setCurrentIndex(currentIndex - 1);
    }
  };

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

            <main className="content-area">
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
      </div>
    </PlayerProvider>
  );
};

export default App;
