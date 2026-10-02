import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import type { SearchResult, NavigationTarget, Track, Album, Artist } from '../types';
import { bridge } from '../services/bridge';
import { TrackRow } from '../components/TrackRow';
import { AlbumCard } from '../components/AlbumCard';
import { ArtistCard } from '../components/ArtistCard';
import { usePlayer } from '../context/PlayerContext';

interface SearchPageProps {
  initialQuery?: string;
  onNavigate: (target: NavigationTarget) => void;
}

type FilterType = 'all' | 'songs' | 'albums' | 'artists';

export const SearchPage: React.FC<SearchPageProps> = ({ initialQuery = '', onNavigate }) => {
  const [query, setQuery] = useState(initialQuery);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(false);
  const { playTrack } = usePlayer();

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResult(null);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      bridge.search(query.trim())
        .then((res) => {
          setSearchResult(res);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Search error:', err);
          setLoading(false);
        });
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const quickTags = ['Arijit Singh', 'Karan Aujla', 'Lofi Beats', 'Taylor Swift', 'Anirudh', 'EDM Festival', 'Shree Hanuman Chalisa', 'Bollywood 2026'];

  const tracks = searchResult?.tracks || [];
  const albums = searchResult?.albums || [];
  const artists = searchResult?.artists || [];
  const topResult = tracks[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Category Filter Pills (When search active) */}
      {query && (
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['all', 'songs', 'albums', 'artists'] as FilterType[]).map((filter) => {
            const labels = { all: 'All', songs: 'Songs', albums: 'Playlists & Albums', artists: 'Artists' };
            const isActive = activeFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                style={{
                  background: isActive ? '#ffffff' : '#242424',
                  color: isActive ? '#000000' : '#ffffff',
                  border: 'none',
                  borderRadius: '500px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {labels[filter]}
              </button>
            );
          })}
        </div>
      )}

      {/* Suggested Quick Browse Tags when search is empty */}
      {!query && (
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Browse All</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {quickTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setQuery(tag)}
                style={{
                  background: '#242424',
                  border: 'none',
                  borderRadius: '500px',
                  padding: '8px 18px',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#2e2e2e'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#242424'}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top Result + Songs (For 'all' and 'songs') */}
      {query && (activeFilter === 'all' || activeFilter === 'songs') && topResult && (
        <div style={{ display: 'grid', gridTemplateColumns: activeFilter === 'all' ? '360px 1fr' : '1fr', gap: '28px' }}>
          {activeFilter === 'all' && (
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '14px' }}>Top result</h3>
              <div 
                className="spotify-card"
                onClick={() => playTrack(topResult, tracks)}
                style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                <img 
                  src={topResult.thumbnailUrl} 
                  alt={topResult.title} 
                  style={{ width: '92px', height: '92px', borderRadius: '6px', objectFit: 'cover', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}
                />
                <div>
                  <h4 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                    {topResult.title}
                  </h4>
                  <p style={{ fontSize: '14px', color: 'var(--text-subdued)', marginTop: '4px' }}>
                    Song • <span style={{ color: '#fff', fontWeight: 600 }}>{topResult.artist}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '14px' }}>Songs</h3>
            <div className="track-table">
              <div className="track-table-header">
                <span>#</span>
                <span>Title</span>
                <span>Album</span>
                <span style={{ textAlign: 'right' }}><Clock size={14} style={{ display: 'inline' }} /></span>
                <span></span>
              </div>

              {(activeFilter === 'all' ? tracks.slice(0, 5) : tracks).map((track: Track, idx: number) => (
                <TrackRow key={track.id} track={track} index={idx} trackList={tracks} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Playlists & Albums Section (For 'all' and 'albums') */}
      {query && (activeFilter === 'all' || activeFilter === 'albums') && albums.length > 0 && (
        <section>
          <div className="section-header">
            <h2 className="section-title">Playlists & Albums</h2>
          </div>

          <div className="cards-grid">
            {albums.map((album: Album) => (
              <AlbumCard 
                key={album.id} 
                album={album} 
                onSelectAlbum={(alb) => {
                  onNavigate({ tab: 'album', album: { id: alb.id, title: alb.title, artist: alb.artist, thumbnailUrl: alb.thumbnailUrl, year: alb.year, tracks: [] } });
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Artists Section (For 'all' and 'artists') */}
      {query && (activeFilter === 'all' || activeFilter === 'artists') && artists.length > 0 && (
        <section>
          <div className="section-header">
            <h2 className="section-title">Artists</h2>
          </div>

          <div className="cards-grid">
            {artists.map((artist: Artist) => (
              <ArtistCard 
                key={artist.id} 
                artist={artist} 
                onSelectArtist={(art) => {
                  onNavigate({ tab: 'artist', artist: { id: art.id, name: art.name, thumbnailUrl: art.thumbnailUrl, topTracks: [] } });
                }}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && query && tracks.length === 0 && albums.length === 0 && artists.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-subdued)' }}>
          <p style={{ fontSize: '16px', fontWeight: 600 }}>No results found for "{query}"</p>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>Try searching for a different song, album, or artist name.</p>
        </div>
      )}
    </div>
  );
};
