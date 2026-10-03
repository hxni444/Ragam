import React, { useState } from 'react';
import { Play, Loader2 } from 'lucide-react';
import type { Artist } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { bridge } from '../services/bridge';
import { AddToLibraryMenu } from './AddToLibraryMenu';

interface ArtistCardProps {
  artist: Artist;
  onSelectArtist: (artist: Artist) => void;
}

export const ArtistCard: React.FC<ArtistCardProps> = ({ artist, onSelectArtist }) => {
  const { playTrack } = usePlayer();
  const [loading, setLoading] = useState(false);

  const handlePlayClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;

    if (artist.topTracks && artist.topTracks.length > 0) {
      playTrack(artist.topTracks[0], artist.topTracks);
      return;
    }

    try {
      setLoading(true);
      const res = await bridge.getArtistDetails(artist.name, artist.thumbnailUrl, artist.id);
      if (res && res.topTracks && res.topTracks.length > 0) {
        artist.topTracks = res.topTracks;
        playTrack(res.topTracks[0], res.topTracks);
      }
    } catch (err) {
      console.error('Failed to start playing artist tracks:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="spotify-card" onClick={() => onSelectArtist(artist)}>
      <div className="card-img-container">
        <div className="card-img-wrap artist">
          <img src={artist.thumbnailUrl} alt={artist.name} className="card-img" />
        </div>
        <div className="card-floating-actions" onClick={(e) => e.stopPropagation()}>
          <AddToLibraryMenu artist={artist} iconSize={16} className="card-floating-add" />
          <button
            className="card-floating-play"
            onClick={handlePlayClick}
            title={`Play ${artist.name}`}
            disabled={loading}
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" color="#000" />
            ) : (
              <Play size={22} fill="#000" color="#000" style={{ transform: 'translateX(1px)' }} />
            )}
          </button>
        </div>
      </div>

      <div className="card-info">
        <div className="card-main-title" title={artist.name}>
          {artist.name}
        </div>
        <div className="card-sub-title">
          Artist
        </div>
      </div>
    </div>
  );
};
