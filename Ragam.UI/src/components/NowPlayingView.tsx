import React, { useState } from 'react';
import { 
  ChevronDown, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Repeat1, 
  Volume2, 
  VolumeX, 
  Heart, 
  Mic2,
  Loader2,
  Music2,
  Radio
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { AddToLibraryMenu } from './AddToLibraryMenu';

export const NowPlayingView: React.FC = () => {
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
    isFavorite,
    isSmartRadioActive,
    isSmartRadioLoading,
    toggleSmartRadio,
    queue,
    queueIndex,
    lyrics,
    isExpanded,
    setIsExpanded,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    nextTrack,
    prevTrack,
    toggleFavorite
  } = usePlayer();

  const [showLyricsTab, setShowLyricsTab] = useState(false);

  if (!isExpanded || !currentTrack) return null;

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

  const nextTrackItem = queue[queueIndex + 1];
  const currentMs = currentTime * 1000;

  return (
    <div className="nowplaying-overlay">
      {/* Dynamic Ambient Backdrop */}
      <div 
        className="nowplaying-backdrop"
        style={{ backgroundImage: `url(${currentTrack.thumbnailUrl})` }}
      />
      <div className="nowplaying-scrim" />

      {/* Top Header / Collapse Bar */}
      <div className="nowplaying-header">
        <button 
          className="nowplaying-collapse-btn"
          onClick={() => setIsExpanded(false)}
          title="Collapse (Esc)"
        >
          <ChevronDown size={28} />
        </button>

        <div className="nowplaying-header-info">
          <span className="nowplaying-subtitle">NOW PLAYING</span>
          <span className="nowplaying-subheader" title={currentTrack.album || currentTrack.artist}>
            {currentTrack.album || currentTrack.artist}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            className={`nowplaying-tab-btn ${showLyricsTab ? 'active' : ''}`}
            onClick={() => setShowLyricsTab(!showLyricsTab)}
            title="Toggle Lyrics"
          >
            <Mic2 size={18} />
          </button>
          <AddToLibraryMenu track={currentTrack} iconSize={18} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="nowplaying-content">
        {/* Left / Center: Artwork or Lyrics */}
        <div className="nowplaying-visual-container">
          {!showLyricsTab ? (
            <div className="nowplaying-art-wrapper">
              <img 
                src={currentTrack.thumbnailUrl} 
                alt={currentTrack.title} 
                className="nowplaying-art"
              />
            </div>
          ) : (
            <div className="nowplaying-lyrics-box">
              {lyrics?.lines && lyrics.lines.length > 0 ? (
                lyrics.lines.map((line, idx) => {
                  const isActive = lyrics.isSynced && currentMs >= line.timeMs && (idx === lyrics.lines.length - 1 || currentMs < lyrics.lines[idx + 1].timeMs);
                  return (
                    <div 
                      key={idx} 
                      className={`nowplaying-lyric-line ${isActive ? 'active' : ''}`}
                      onClick={() => lyrics.isSynced && seek(line.timeMs / 1000)}
                    >
                      {line.text}
                    </div>
                  );
                })
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-subdued)', gap: '12px' }}>
                  <Music2 size={36} style={{ opacity: 0.5 }} />
                  <span>No lyrics available for this song</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right / Bottom: Details & Controls */}
        <div className="nowplaying-info-controls">
          {/* Title & Artist Row */}
          <div className="nowplaying-title-row">
            <div style={{ overflow: 'hidden' }}>
              <h1 className="nowplaying-track-title" title={currentTrack.title}>
                {currentTrack.title}
              </h1>
              <p className="nowplaying-track-artist" title={currentTrack.artist}>
                {currentTrack.artist}
              </p>
            </div>
            <button 
              className="control-btn" 
              onClick={toggleFavorite}
              title={isFavorite ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
              style={{ padding: '8px' }}
            >
              <Heart 
                size={26} 
                fill={isFavorite ? 'var(--primary)' : 'none'} 
                color={isFavorite ? 'var(--primary)' : 'var(--text-subdued)'} 
              />
            </button>
          </div>

          {/* Scrubber Progress Bar */}
          <div className="scrubber-container nowplaying-scrubber">
            <span className="time-label">{formatTime(currentTime)}</span>
            <div className="slider-track" onClick={handleSliderClick}>
              <div className="slider-progress" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="time-label">{formatTime(duration)}</span>
          </div>

          {/* Primary Playback Controls */}
          <div className="nowplaying-controls-row">
            <button 
              className={`control-btn ${isShuffle ? 'active' : ''}`} 
              onClick={toggleShuffle}
              title="Enable shuffle"
            >
              <Shuffle size={20} />
            </button>

            <button 
              className="control-btn" 
              onClick={prevTrack}
              title="Previous"
            >
              <SkipBack size={26} fill="currentColor" />
            </button>

            <button 
              className="nowplaying-play-circle" 
              onClick={togglePlay}
              title={isLoading ? 'Loading...' : isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? (
                <Loader2 size={26} className="animate-spin" color="#000" />
              ) : isPlaying ? (
                <Pause size={26} fill="#000" color="#000" />
              ) : (
                <Play size={26} fill="#000" color="#000" style={{ transform: 'translateX(2px)' }} />
              )}
            </button>

            <button 
              className="control-btn" 
              onClick={nextTrack}
              title="Next"
            >
              <SkipForward size={26} fill="currentColor" />
            </button>

            <button 
              className={`control-btn ${repeatMode !== 'off' ? 'active' : ''}`} 
              onClick={toggleRepeat}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
            </button>

            <button 
              className={`control-btn ${isSmartRadioActive ? 'active' : ''}`} 
              onClick={() => toggleSmartRadio()}
              disabled={isSmartRadioLoading}
              title={isSmartRadioLoading ? "Finding similar songs..." : isSmartRadioActive ? "Radio Active (Click to turn off)" : "Start Radio Mix"}
              style={isSmartRadioActive ? { color: 'var(--primary)' } : {}}
            >
              {isSmartRadioLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Radio size={20} />
              )}
            </button>
          </div>

          {/* Volume Slider & Next Track Peek */}
          <div className="nowplaying-bottom-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button className="control-btn" onClick={toggleMute} title="Mute / Unmute">
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01" 
                value={isMuted ? 0 : volume} 
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                style={{ width: '120px', accentColor: 'var(--primary)', cursor: 'pointer', height: '5px' }}
              />
            </div>

            {nextTrackItem && (
              <div className="nowplaying-next-peek" onClick={nextTrack} title="Skip to next track">
                <span style={{ fontSize: '11px', color: 'var(--text-subdued)', fontWeight: 600 }}>UP NEXT:</span>
                <span style={{ fontSize: '12px', color: '#fff', fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nextTrackItem.title}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
