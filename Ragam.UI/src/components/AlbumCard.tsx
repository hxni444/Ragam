import React, { useState } from 'react';
import { Play, ListMusic, Disc, Radio, Loader2 } from 'lucide-react';
import type { Album } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { bridge } from '../services/bridge';

interface AlbumCardProps {
  album: Album;
  onSelectAlbum: (album: Album) => void;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ album, onSelectAlbum }) => {
  const { playTrack } = usePlayer();
  const [loading, setLoading] = useState(false);

  const handlePlayClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;

    if (album.tracks && album.tracks.length > 0) {
      playTrack(album.tracks[0], album.tracks);
      return;
    }

    try {
      setLoading(true);
      const res = await bridge.getAlbumOrPlaylist(album.title, album.artist, album.thumbnailUrl, album.id);
      if (res && res.tracks && res.tracks.length > 0) {
        album.tracks = res.tracks;
        playTrack(res.tracks[0], res.tracks);
      }
    } catch (err) {
      console.error('Failed to start playing album/playlist:', err);
    } finally {
      setLoading(false);
    }
  };

  const isMix = album.year?.toLowerCase().includes('mix') || album.id.includes('mix') || album.title.toLowerCase().includes('mix');
  const isPlaylist = album.year?.toLowerCase().includes('playlist') || !album.year || album.year === 'Playlist / Album';
  const cardType = isMix ? 'Mix' : isPlaylist ? 'Playlist' : 'Album';
  const cardClass = isMix ? 'mix-card' : isPlaylist ? 'playlist-card' : 'album-card';
  const badgeClass = isMix ? 'mix' : isPlaylist ? 'playlist' : 'album';

  return (
    <div className={`spotify-card ${cardClass}`} onClick={() => onSelectAlbum(album)}>
      <div className="card-img-container">
        <div className="card-img-wrap">
          <img src={album.thumbnailUrl} alt={album.title} className="card-img" />
        </div>
        <div className={`card-type-badge ${badgeClass}`}>
          {isMix ? <Radio size={10} /> : isPlaylist ? <ListMusic size={10} /> : <Disc size={10} />}
          <span>{cardType}</span>
        </div>
        <button
          className="card-floating-play"
          onClick={handlePlayClick}
          title={`Play ${album.title}`}
          disabled={loading}
        >
          {loading ? (
            <Loader2 size={20} className="animate-spin" color="#000" />
          ) : (
            <Play size={22} fill="#000" color="#000" style={{ transform: 'translateX(1px)' }} />
          )}
        </button>
      </div>

      <div className="card-info">
        <div className="card-main-title" title={album.title}>
          {album.title}
        </div>
        <div className="card-sub-title" title={album.artist}>
          {cardType} • {album.artist}
        </div>
      </div>
    </div>
  );
};
