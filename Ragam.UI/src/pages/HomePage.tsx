import React, { useEffect, useState } from 'react';
import type { HomeFeed, HomeSectionItem, NavigationTarget, Track, Album, Artist } from '../types';
import { bridge } from '../services/bridge';
import { TrackCard } from '../components/TrackCard';
import { ArtistCard } from '../components/ArtistCard';
import { AlbumCard } from '../components/AlbumCard';

interface HomePageProps {
  onNavigate: (target: NavigationTarget) => void;
}

const DEFAULT_CHIPS = ['All', 'Energize', 'Workout', 'Relax', 'Focus', 'Commute', 'Party'];

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [feed, setFeed] = useState<HomeFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChip, setSelectedChip] = useState('All');

  const loadFeed = async (chipParams?: string) => {
    try {
      setLoading(true);
      const data = await bridge.getHomeFeed(true, chipParams);
      setFeed(data);
    } catch (err) {
      console.error('Failed to load home feed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const handleChipClick = async (chipTitle: string, chipParams?: string) => {
    if (selectedChip === chipTitle && chipTitle !== 'All') {
      setSelectedChip('All');
      await loadFeed();
      return;
    }

    setSelectedChip(chipTitle);
    if (chipTitle === 'All') {
      await loadFeed();
    } else {
      await loadFeed(chipParams);
    }
  };

  const toTrack = (item: HomeSectionItem): Track => ({
    id: item.id,
    title: item.title,
    artist: item.artist,
    thumbnailUrl: item.thumbnailUrl,
    duration: item.duration || 210,
  });

  const toAlbum = (item: HomeSectionItem): Album => ({
    id: item.id,
    title: item.title,
    artist: item.artist,
    thumbnailUrl: item.thumbnailUrl,
    year: item.year || (item.title.toLowerCase().includes('mix') ? 'Mix' : 'Playlist / Album'),
    tracks: item.tracks || [],
  });

  const toArtist = (item: HomeSectionItem): Artist => ({
    id: item.id,
    name: item.title,
    thumbnailUrl: item.thumbnailUrl,
    topTracks: item.tracks || [],
  });

  if (loading && !feed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
        {[1, 2, 3].map((sec) => (
          <div key={sec} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="skeleton-box" style={{ width: '180px', height: '24px', borderRadius: '4px' }} />
            <div className="cards-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="spotify-card" style={{ pointerEvents: 'none' }}>
                  <div className="card-img-container">
                    <div className="skeleton-box" style={{ width: '100%', height: '100%', borderRadius: '6px' }} />
                  </div>
                  <div className="card-info" style={{ gap: '6px' }}>
                    <div className="skeleton-box" style={{ width: '85%', height: '14px', borderRadius: '3px' }} />
                    <div className="skeleton-box" style={{ width: '55%', height: '12px', borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Determine chips to display (prefer dynamic from YouTube Music, fallback to defaults)
  const chipsToRender = feed?.chips && feed.chips.length > 0
    ? [{ title: 'All', params: undefined }, ...feed.chips]
    : DEFAULT_CHIPS.map((title) => ({ title, params: undefined }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      {/* Category Filter Chips (Velune APK dynamic chips) */}
      <div className="home-chips-row">
        {chipsToRender.map((chip) => (
          <button
            key={chip.title}
            className={`home-chip ${selectedChip === chip.title ? 'active' : ''}`}
            onClick={() => handleChipClick(chip.title, chip.params)}
          >
            {chip.title}
          </button>
        ))}
      </div>

      {/* Dynamic Home Shelves/Sections (Exact Velune Android APK structure) */}
      {feed?.sections && feed.sections.length > 0 ? (
        feed.sections.map((section, sIdx) => {
          const songItems = section.items.filter((i) => i.type === 'song').map(toTrack);
          const isFresh = section.title.toLowerCase().includes('fresh') || section.subtitle?.toLowerCase().includes('hot');

          return (
            <section key={section.title + sIdx}>
              <div style={{ marginBottom: '16px' }}>
                {section.subtitle && (
                  <div style={{ 
                    fontSize: '11px', 
                    fontWeight: 800, 
                    color: isFresh ? '#FF5400' : 'var(--text-subdued)', 
                    letterSpacing: '0.08em', 
                    textTransform: 'uppercase',
                    marginBottom: '4px'
                  }}>
                    {section.subtitle}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 className="section-title" style={{ margin: 0 }}>{section.title}</h2>
                  <span className="section-show-all" onClick={() => onNavigate({ tab: 'search', query: section.title })}>
                    Show all
                  </span>
                </div>
              </div>

              <div className="cards-grid">
                {section.items.map((item) => {
                  if (item.type === 'song') {
                    const tr = toTrack(item);
                    return (
                      <TrackCard
                        key={item.id}
                        track={tr}
                        trackList={songItems.length > 0 ? songItems : [tr]}
                        onOpenDetail={(t) => {
                          onNavigate({ tab: 'album', album: { id: '', title: t.title, artist: t.artist, thumbnailUrl: t.thumbnailUrl, tracks: [] } });
                        }}
                      />
                    );
                  }
                  if (item.type === 'artist') {
                    const art = toArtist(item);
                    return (
                      <ArtistCard
                        key={item.id}
                        artist={art}
                        onSelectArtist={(a) => {
                          onNavigate({ tab: 'artist', artist: { id: a.id, name: a.name, thumbnailUrl: a.thumbnailUrl, topTracks: [] } });
                        }}
                      />
                    );
                  }
                  const alb = toAlbum(item);
                  return (
                    <AlbumCard
                      key={item.id}
                      album={alb}
                      onSelectAlbum={(a) => {
                        onNavigate({ tab: 'album', album: { id: a.id, title: a.title, artist: a.artist, thumbnailUrl: a.thumbnailUrl, year: a.year, tracks: [] } });
                      }}
                    />
                  );
                })}
              </div>
            </section>
          );
        })
      ) : (
        /* Fallback rendering if sections array is not present */
        <>
          {/* Quick Picks */}
          {feed?.quickPicks && feed.quickPicks.length > 0 && (
            <section>
              <div className="section-header">
                <h2 className="section-title">Quick picks</h2>
                <span className="section-show-all" onClick={() => onNavigate({ tab: 'search', query: 'top hits' })}>
                  Show all
                </span>
              </div>
              <div className="cards-grid">
                {feed.quickPicks.slice(0, 8).map((track) => (
                  <TrackCard 
                    key={track.id} 
                    track={track} 
                    trackList={feed.quickPicks}
                    onOpenDetail={(t) => {
                      onNavigate({ tab: 'album', album: { id: '', title: t.title, artist: t.artist, thumbnailUrl: t.thumbnailUrl, tracks: [] } });
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Mixed for you */}
          {feed?.mixedForYou && feed.mixedForYou.length > 0 && (
            <section>
              <div className="section-header">
                <h2 className="section-title">Mixed for you</h2>
                <span className="section-show-all" onClick={() => onNavigate({ tab: 'search', query: 'mix' })}>
                  Show all
                </span>
              </div>
              <div className="cards-grid">
                {feed.mixedForYou.slice(0, 6).map((mix) => (
                  <AlbumCard 
                    key={mix.id} 
                    album={mix} 
                    onSelectAlbum={(m) => {
                      onNavigate({ tab: 'album', album: { id: m.id, title: m.title, artist: m.artist, thumbnailUrl: m.thumbnailUrl, year: m.year, tracks: [] } });
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Trending Songs */}
          {feed?.trendingSongs && feed.trendingSongs.length > 0 && (
            <section>
              <div className="section-header">
                <h2 className="section-title">Trending songs</h2>
                <span className="section-show-all" onClick={() => onNavigate({ tab: 'search', query: 'trending' })}>
                  Show all
                </span>
              </div>
              <div className="cards-grid">
                {feed.trendingSongs.slice(0, 8).map((track) => (
                  <TrackCard 
                    key={track.id} 
                    track={track} 
                    trackList={feed.trendingSongs}
                    onOpenDetail={(t) => {
                      onNavigate({ tab: 'album', album: { id: '', title: t.title, artist: t.artist, thumbnailUrl: t.thumbnailUrl, tracks: [] } });
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Popular Artists */}
          {feed?.popularArtists && feed.popularArtists.length > 0 && (
            <section>
              <div className="section-header">
                <h2 className="section-title">Popular artists</h2>
                <span className="section-show-all" onClick={() => onNavigate({ tab: 'search', query: 'artists' })}>
                  Show all
                </span>
              </div>
              <div className="cards-grid">
                {feed.popularArtists.slice(0, 8).map((artist) => (
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
        </>
      )}

      {/* Moods & Genres (Directly from YouTube Music explore) */}
      {feed?.moodAndGenres && feed.moodAndGenres.length > 0 && (
        <section>
          <div className="section-header">
            <h2 className="section-title">Moods & genres</h2>
            <span className="section-show-all" onClick={() => onNavigate({ tab: 'search', query: 'moods genres' })}>
              Explore all
            </span>
          </div>

          <div className="mood-grid">
            {feed.moodAndGenres.map((mood) => (
              <div 
                key={mood.title} 
                className="mood-btn"
                onClick={() => {
                  if (mood.params) {
                    handleChipClick(mood.title, mood.params);
                  } else {
                    onNavigate({ tab: 'search', query: mood.title });
                  }
                }}
              >
                <div 
                  className="mood-stripe" 
                  style={{ backgroundColor: mood.stripeColor || '#FF5400' }} 
                />
                <span className="mood-title">{mood.title}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};


