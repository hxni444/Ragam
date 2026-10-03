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

// In-memory module cache to immediately render cached feed and preserve cards during navigation
const cachedChipFeeds = new Map<string, HomeFeed>();
let cachedChip = 'All';

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [selectedChip, setSelectedChip] = useState(cachedChip);
  const initialFeed = cachedChipFeeds.get(selectedChip) || cachedChipFeeds.get('All') || null;
  const [feed, setFeed] = useState<HomeFeed | null>(initialFeed);
  const [loading, setLoading] = useState(!initialFeed);

  const loadFeed = async (chipTitle: string, chipParams?: string, force = false) => {
    const existing = cachedChipFeeds.get(chipTitle);
    if (existing && !force) {
      setFeed(existing);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await bridge.getHomeFeed(force, chipParams);
      if (data) {
        cachedChipFeeds.set(chipTitle, data);
        if (chipTitle === 'All') {
          cachedChipFeeds.set('__main__', data);
        }
        setFeed(data);
      }
    } catch (err) {
      console.error('Failed to load home feed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = cachedChipFeeds.get(selectedChip) || cachedChipFeeds.get('All');
    if (!cached) {
      loadFeed('All', undefined);
    } else {
      setFeed(cached);
      setLoading(false);
    }
  }, []);

  const handleChipClick = async (chipTitle: string, chipParams?: string) => {
    if (selectedChip === chipTitle && chipTitle !== 'All') {
      setSelectedChip('All');
      cachedChip = 'All';
      await loadFeed('All', undefined);
      return;
    }

    setSelectedChip(chipTitle);
    cachedChip = chipTitle;
    await loadFeed(chipTitle, chipTitle === 'All' ? undefined : chipParams);
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
    year: 'Playlist',
    tracks: [],
  });

  const toArtist = (item: HomeSectionItem): Artist => ({
    id: item.id,
    name: item.title,
    thumbnailUrl: item.thumbnailUrl,
    topTracks: [],
  });

  if (loading && !feed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton" style={{ width: '80px', height: '32px', borderRadius: '8px' }} />
          ))}
        </div>
        {[1, 2, 3].map((s) => (
          <div key={s} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="skeleton" style={{ width: '200px', height: '28px', borderRadius: '6px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
              {[1, 2, 3, 4, 5, 6].map((c) => (
                <div key={c} className="skeleton" style={{ height: '240px', borderRadius: '12px' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const chipsToRender = feed?.chips && feed.chips.length > 0 
    ? feed.chips 
    : DEFAULT_CHIPS.map(c => ({ title: c, params: undefined }));

  // Render dynamic shelves in natural order from YouTube Music
  const dynamicSections = feed?.sections && feed.sections.length > 0 ? feed.sections : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      {/* Category Filter Chips */}
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

      {/* Dynamic Home Shelves/Sections */}
      {dynamicSections.length > 0 ? (
        dynamicSections.map((section, sIdx) => {
          if (!section.items || section.items.length === 0) return null;

          const songItems = section.items
            .filter((it) => it.type === 'song')
            .map(toTrack);

          const isFresh = section.title.toLowerCase().includes('fresh') || section.title.toLowerCase().includes('new');

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

      {/* Moods & Genres */}
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
