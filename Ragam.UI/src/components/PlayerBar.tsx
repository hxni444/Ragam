import React from 'react';
import { 
  X, 
  ChevronUp, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Repeat1, 
  Volume2, 
  VolumeX, 
  ListMusic, 
  Mic2, 
  Heart,
  Loader2,
  Radio
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { AddToLibraryMenu } from './AddToLibraryMenu';

export const PlayerBar: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    isLyricsOpen,
    isQueueOpen,
    isFavorite,
    isSmartRadioActive,
    isSmartRadioLoading,
    toggleSmartRadio,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    nextTrack,
    prevTrack,
    toggleFavorite,
    setIsLyricsOpen,
    setIsQueueOpen,
    closePlayer,
    setIsExpanded,
    isExpanded
  } = usePlayer();

  if (!currentTrack) return null;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSliderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    seek(pos * duration);
  };

  const handleBarClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, .slider-track, .slider-progress, [data-no-expand], .add-to-library-menu')) {
      return;
    }
    setIsExpanded(true);
  };

  return (
    <footer 
      className={`playerbar ${isExpanded ? "hidden-expanded" : ""}`}
      onClick={handleBarClick}
      title="Click to open Now Playing"
      style={{ cursor: 'pointer' }}
    >

      {/* Left: Track Information */}
      <div className="player-track-info" onClick={() => setIsExpanded(true)} style={{ cursor: 'pointer' }}>
        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setIsExpanded(true)} title="Open Now Playing">
          <img 
            src={currentTrack.thumbnailUrl} 
            alt={currentTrack.title} 
            className="player-thumb" 
          />
          <div className="player-expand-hover-badge">
            <ChevronUp size={16} color="#fff" />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer' }} onClick={() => setIsExpanded(true)} title="Open Now Playing">
          <span className="player-title" title={currentTrack.title}>
            {currentTrack.title}
          </span>
          <span className="player-artist" title={currentTrack.artist}>
            {currentTrack.artist}
          </span>
        </div>
        <button className="control-btn" onClick={() => setIsExpanded(true)} title="Open Now Playing" style={{ opacity: 0.75, padding: '4px' }}>
          <ChevronUp size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '2px' }} data-no-expand="true">
          <button 
            className="control-btn" 
            onClick={toggleFavorite}
            title={isFavorite ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
          >
            <Heart size={16} fill={isFavorite ? 'var(--primary)' : 'none'} color={isFavorite ? 'var(--primary)' : 'var(--text-subdued)'} />
          </button>
          <AddToLibraryMenu track={currentTrack} iconSize={16} />
        </div>
      </div>

      {/* Center: Controls & Scrubber */}
      <div className="player-center">
        <div className="player-controls" data-no-expand="true">
          <button 
            className={`control-btn ${isShuffle ? 'active' : ''}`} 
            onClick={toggleShuffle}
            title="Enable shuffle"
          >
            <Shuffle size={16} />
          </button>

          <button 
            className="control-btn" 
            onClick={prevTrack}
            title="Previous"
          >
            <SkipBack size={18} fill="currentColor" />
          </button>

          <button 
            className="play-btn-circle" 
            onClick={togglePlay}
            title={isLoading ? 'Loading...' : isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" color="#000" />
            ) : isPlaying ? (
              <Pause size={18} fill="#000" color="#000" />
            ) : (
              <Play size={18} fill="#000" color="#000" style={{ transform: 'translateX(1px)' }} />
            )}
          </button>

          <button 
            className="control-btn" 
            onClick={nextTrack}
            title="Next"
          >
            <SkipForward size={18} fill="currentColor" />
          </button>

          <button 
            className={`control-btn ${repeatMode !== 'off' ? 'active' : ''}`} 
            onClick={toggleRepeat}
            title={`Repeat: ${repeatMode}`}
          >
            {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>

          <button 
            className={`control-btn ${isSmartRadioActive ? 'active' : ''}`} 
            onClick={() => toggleSmartRadio()}
            disabled={isSmartRadioLoading}
            title={isSmartRadioLoading ? "Finding similar songs..." : isSmartRadioActive ? "Radio Active (Click to turn off)" : "Start Radio Mix"}
            style={isSmartRadioActive ? { color: 'var(--primary)', position: 'relative' } : {}}
          >
            {isSmartRadioLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Radio size={16} />
            )}
          </button>
        </div>

        <div className="scrubber-container" data-no-expand="true">
          <span className="time-label">{formatTime(currentTime)}</span>
          <div className="slider-track" onClick={handleSliderClick}>
            <div className="slider-progress" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="time-label">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Lyrics, Queue, Volume */}
      <div className="player-right">
        <button 
          className={`control-btn ${isLyricsOpen ? 'active' : ''}`} 
          onClick={() => setIsLyricsOpen(!isLyricsOpen)}
          title="Lyrics"
        >
          <Mic2 size={16} />
        </button>

        <button 
          className={`control-btn ${isQueueOpen ? 'active' : ''}`} 
          onClick={() => setIsQueueOpen(!isQueueOpen)}
          title="Queue"
        >
          <ListMusic size={16} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} data-no-expand="true">
          <button className="control-btn" onClick={toggleMute} title="Mute / Unmute">
            {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={isMuted ? 0 : volume} 
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            style={{ width: '80px', accentColor: 'var(--primary)', cursor: 'pointer', height: '4px' }}
          />
        </div>

        <button 
          className="control-btn" 
          onClick={closePlayer}
          title="Close player"
          style={{ marginLeft: '4px', opacity: 0.7 }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
        >
          <X size={17} />
        </button>
      </div>
    </footer>
  );
};
