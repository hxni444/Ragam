import React, { useEffect, useState } from 'react';
import { Disc3 } from 'lucide-react';
import type { MoodAndGenreItem, HomeFeed, HomeSectionItem, NavigationTarget, Track, Album, Artist } from '../types';
import { bridge } from '../services/bridge';
import { TrackCard } from '../components/TrackCard';
import { ArtistCard } from '../components/ArtistCard';
import { AlbumCard } from '../components/AlbumCard';

interface MoodCategoryPageProps {
  mood: MoodAndGenreItem;
  onNavigate: (target: NavigationTarget) => void;
}

// In-memory module cache for mood category feeds
const cachedMoodFeeds = new Map<string, HomeFeed>();

export const MoodCategoryPage: React.FC<MoodCategoryPageProps> = ({ mood, onNavigate }) => {
  const cacheKey = `${mood.title}_${mood.params || ''}_${mood.browseId || ''}`;
  const initialFeed = cachedMoodFeeds.get(cacheKey) || null;
  const [feed, setFeed] = useState<HomeFeed | null>(initialFeed);
  const [selectedSubChip, setSelectedSubChip] = useState<string>('All');
  const [loading, setLoading] = useState<boolean>(!initialFeed);
  const [error, setError] = useState<string | null>(null);

  const fetchCategoryFeed = async (title: string, params?: string, browseId?: string, force = false) => {
    const key = `${title}_${params || ''}_${browseId || ''}`;
    if (!force && cachedMoodFeeds.has(key)) {
      setFeed(cachedMoodFeeds.get(key)!);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await bridge.getMoodCategory(title, params, browseId);
      if (data) {
        cachedMoodFeeds.set(key, data);
        setFeed(data);
      } else {
        setError('No playlists found for this category.');
      }
    } catch (err: any) {
      console.error('Failed to load mood category:', err);
      setError(err?.message || 'Failed to load playlists.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const key = `${mood.title}_${mood.params || ''}_${mood.browseId || ''}`;
    const cached = cachedMoodFeeds.get(key);
    if (!cached) {
      fetchCategoryFeed(mood.title, mood.params, mood.browseId);
    } else {
      setFeed(cached);
      setLoading(false);
    }
  }, [mood]);

  const handleSubChipClick = (chipTitle: string, chipParams?: string) => {
    setSelectedSubChip(chipTitle);
    fetchCategoryFeed(mood.title, chipParams || mood.params, mood.browseId);
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
    year: item.year || 'Playlist',
    tracks: item.tracks || [],
  });

  const toArtist = (item: HomeSectionItem): Artist => ({
    id: item.id,
    name: item.title,
    thumbnailUrl: item.thumbnailUrl,
    topTracks: [],
  });

  const stripeColor = mood.stripeColor || '#FF5400';
  const dynamicSections = feed?.sections && feed.sections.length > 0 ? feed.sections : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Category Hero Header */}
      <div 
        style={{
          position: 'relative',
          padding: '28px 32px',
          borderRadius: '16px',
          background: `linear-gradient(135deg, ${stripeColor}22 0%, rgba(24, 24, 24, 0.6) 100%)`,
          border: `1px solid ${stripeColor}44`,
          backdropFilter: 'blur(20px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: `0 8px 32px ${stripeColor}18`
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '8px',
              height: '48px',
              borderRadius: '4px',
              backgroundColor: stripeColor,
              boxShadow: `0 0 16px ${stripeColor}`
            }}
          />
          <div>
            <h1 style={{ fontSize: '36px', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
              {mood.title}
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-subdued)', fontWeight: 500 }}>
              Curated playlists, popular hits & mixes in {mood.title}
            </p>
          </div>
        </div>

        {/* Sub-category chips if available */}
        {feed?.chips && feed.chips.length > 0 && (
          <div className="home-chips-row" style={{ marginTop: '8px' }}>
            {feed.chips.map((chip) => (
              <button
                key={chip.title}
                className={`home-chip ${selectedSubChip === chip.title ? 'active' : ''}`}
                onClick={() => handleSubChipClick(chip.title, chip.params)}
              >
                {chip.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {loading && !feed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {[1, 2].map((s) => (
            <div key={s} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="skeleton" style={{ width: '220px', height: '26px', borderRadius: '6px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                {[1, 2, 3, 4, 5, 6].map((c) => (
                  <div key={c} className="skeleton" style={{ height: '240px', borderRadius: '12px' }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-subdued)' }}>
          <Disc3 size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>{error}</div>
          <button
            onClick={() => fetchCategoryFeed(mood.title, mood.params, mood.browseId, true)}
            style={{
              marginTop: '12px',
              padding: '8px 20px',
              borderRadius: '500px',
              background: 'var(--primary)',
              border: 'none',
              color: '#000',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Dynamic Sections / Shelves of Playlists & Albums */}
      {!loading && dynamicSections.length > 0 && (
        dynamicSections.map((section, sIdx) => {
          if (!section.items || section.items.length === 0) return null;

          const songItems = section.items
            .filter((it) => it.type === 'song')
            .map(toTrack);

          return (
            <section key={section.title + sIdx}>
              <div style={{ marginBottom: '16px' }}>
                {section.subtitle && (
                  <div style={{ 
                    fontSize: '11px', 
                    fontWeight: 800, 
                    color: 'var(--text-subdued)', 
                    letterSpacing: '0.08em', 
                    textTransform: 'uppercase',
                    marginBottom: '4px'
                  }}>
                    {section.subtitle}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 className="section-title" style={{ margin: 0 }}>{section.title}</h2>
                  <span className="section-show-all" onClick={() => onNavigate({ tab: 'search', query: `${mood.title} ${section.title}` })}>
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
      )}
    </div>
  );
};
