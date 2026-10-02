import React from 'react';
import { Play, Loader2, Music } from 'lucide-react';
import type { Track } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { AddToLibraryMenu } from './AddToLibraryMenu';

interface TrackCardProps {
  track: Track;
  trackList?: Track[];
  onOpenDetail?: (track: Track) => void;
}

export const TrackCard: React.FC<TrackCardProps> = ({ track, trackList, onOpenDetail }) => {
  const { playTrack, currentTrack, isLoading } = usePlayer();
  const isCurrent = currentTrack?.id === track.id;

  const handleCardClick = () => {
    if (onOpenDetail) {
      onOpenDetail(track);
    } else {
      playTrack(track, trackList || [track]);
    }
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    playTrack(track, trackList || [track]);
  };

  return (
    <div className="spotify-card song-card" onClick={handleCardClick}>
      <div className="card-img-container">
        <div className="card-img-wrap">
          <img src={track.thumbnailUrl} alt={track.title} className="card-img" />
        </div>
        <div className="card-type-badge song">
          <Music size={10} />
          <span>Song</span>
        </div>
        <div className="card-floating-actions" onClick={(e) => e.stopPropagation()}>
          <AddToLibraryMenu track={track} iconSize={16} className="card-floating-add" />
          <button
            className="card-floating-play"
            onClick={handlePlayClick}
            title={`Play ${track.title}`}
          >
            {isCurrent && isLoading ? (
              <Loader2 size={20} className="animate-spin" color="#000" />
            ) : (
              <Play size={22} fill="#000" color="#000" style={{ transform: 'translateX(1px)' }} />
            )}
          </button>
        </div>
      </div>

      <div className="card-info">
        <div className="card-main-title" title={track.title} style={{ color: isCurrent ? 'var(--primary)' : '#fff' }}>
          {track.title}
        </div>
        <div className="card-sub-title" title={track.artist}>
          Song • {track.artist}
        </div>
      </div>
    </div>
  );
};
