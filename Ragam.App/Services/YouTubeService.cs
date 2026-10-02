using System.Collections.Concurrent;
using System.Net.Http;
using System.Text.Json;
using Ragam.App.Models;
using YoutubeExplode;
using YoutubeExplode.Common;
using YoutubeExplode.Playlists;
using YoutubeExplode.Search;
using YoutubeExplode.Videos.Streams;

namespace Ragam.App.Services;

public class YouTubeService
{
    private readonly YoutubeClient _youtubeClient;
    private readonly HttpClient _httpClient;
    private readonly ConcurrentDictionary<string, (string Url, DateTime Expiry)> _streamCache = new();

    public YouTubeService()
    {
        _httpClient = new HttpClient();
        _youtubeClient = new YoutubeClient(_httpClient);
    }

    public async Task<SearchResultDto> SearchAllAsync(string query, int limit = 15)
    {
        var tracks = new List<TrackDto>();
        var albums = new List<AlbumDto>();
        var artists = new List<ArtistDto>();

        try
        {
            // 1. Search Videos (Songs)
            var videoTask = Task.Run(async () =>
            {
                var vList = new List<TrackDto>();
                try
                {
                    await foreach (var batch in _youtubeClient.Search.GetResultBatchesAsync(query, SearchFilter.Video))
                    {
                        foreach (var item in batch.Items)
                        {
                            if (item is VideoSearchResult video)
                            {
                                vList.Add(new TrackDto(
                                    Id: video.Id.Value,
                                    Title: CleanTitle(video.Title),
                                    Artist: video.Author.ChannelTitle,
                                    Album: null,
                                    DurationSeconds: video.Duration?.TotalSeconds ?? 180,
                                    ThumbnailUrl: video.Thumbnails.GetWithHighestResolution()?.Url ?? $"https://i.ytimg.com/vi/{video.Id.Value}/hqdefault.jpg"
                                ));
                                if (vList.Count >= limit) break;
                            }
                        }
                        if (vList.Count >= limit) break;
                    }
                }
                catch { }
                return vList;
            });

            // 2. Search Playlists & Albums
            var playlistTask = Task.Run(async () =>
            {
                var pList = new List<AlbumDto>();
                try
                {
                    await foreach (var batch in _youtubeClient.Search.GetResultBatchesAsync(query, SearchFilter.Playlist))
                    {
                        foreach (var item in batch.Items)
                        {
                            if (item is PlaylistSearchResult pl)
                            {
                                pList.Add(new AlbumDto(
                                    Id: pl.Id.Value,
                                    Title: CleanTitle(pl.Title),
                                    Artist: pl.Author?.ChannelTitle ?? "Various Artists",
                                    ThumbnailUrl: pl.Thumbnails.GetWithHighestResolution()?.Url ?? "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
                                    Year: "Playlist / Album",
                                    Tracks: new List<TrackDto>()
                                ));
                                if (pList.Count >= limit) break;
                            }
                        }
                        if (pList.Count >= limit) break;
                    }
                }
                catch { }
                return pList;
            });

            // 3. Search Artists / Channels
            var artistTask = Task.Run(async () =>
            {
                var aList = new List<ArtistDto>();
                try
                {
                    await foreach (var batch in _youtubeClient.Search.GetResultBatchesAsync(query, SearchFilter.Channel))
                    {
                        foreach (var item in batch.Items)
                        {
                            if (item is ChannelSearchResult ch)
                            {
                                aList.Add(new ArtistDto(
                                    Id: ch.Id.Value,
                                    Name: ch.Title,
                                    ThumbnailUrl: ch.Thumbnails.GetWithHighestResolution()?.Url ?? "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop",
                                    TopTracks: new List<TrackDto>()
                                ));
                                if (aList.Count >= 6) break;
                            }
                        }
                        if (aList.Count >= 6) break;
                    }
                }
                catch { }
                return aList;
            });

            await Task.WhenAll(videoTask, playlistTask, artistTask);

            tracks = await videoTask;
            albums = await playlistTask;
            artists = await artistTask;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error during search: {ex.Message}");
        }

        return new SearchResultDto(query, tracks, artists, albums);
    }

    public async Task<List<TrackDto>> SearchVideosOnlyAsync(string query, int limit = 10)
    {
        var vList = new List<TrackDto>();
        try
        {
            await foreach (var batch in _youtubeClient.Search.GetResultBatchesAsync(query, SearchFilter.Video))
            {
                foreach (var item in batch.Items)
                {
                    if (item is VideoSearchResult video)
                    {
                        vList.Add(new TrackDto(
                            Id: video.Id.Value,
                            Title: CleanTitle(video.Title),
                            Artist: video.Author.ChannelTitle,
                            Album: null,
                            DurationSeconds: video.Duration?.TotalSeconds ?? 180,
                            ThumbnailUrl: video.Thumbnails.GetWithHighestResolution()?.Url ?? $"https://i.ytimg.com/vi/{video.Id.Value}/hqdefault.jpg"
                        ));
                        if (vList.Count >= limit) break;
                    }
                }
                if (vList.Count >= limit) break;
            }
        }
        catch { }
        return vList;
    }

    public async Task<List<TrackDto>> SearchTracksAsync(string query, int limit = 20)
    {
        return await SearchVideosOnlyAsync(query, limit);
    }

    public async Task<AlbumDto> GetAlbumOrPlaylistAsync(string title, string artist, string thumbnailUrl, string? playlistId = null)
    {
        var tracks = new List<TrackDto>();

        // If a real YouTube playlistId is provided, fetch its actual tracks directly
        if (!string.IsNullOrEmpty(playlistId) && playlistId.Length > 5)
        {
            try
            {
                await foreach (var video in _youtubeClient.Playlists.GetVideosAsync(playlistId))
                {
                    tracks.Add(new TrackDto(
                        Id: video.Id.Value,
                        Title: CleanTitle(video.Title),
                        Artist: video.Author.ChannelTitle,
                        Album: title,
                        DurationSeconds: video.Duration?.TotalSeconds ?? 180,
                        ThumbnailUrl: video.Thumbnails.GetWithHighestResolution()?.Url ?? $"https://i.ytimg.com/vi/{video.Id.Value}/hqdefault.jpg"
                    ));

                    if (tracks.Count >= 50) break;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error fetching playlist {playlistId}: {ex.Message}");
            }
        }

        // Fallback search if empty
        if (tracks.Count == 0)
        {
            var query = $"{title} {artist} songs";
            tracks = await SearchVideosOnlyAsync(query, 15);
        }

        return new AlbumDto(
            Id: playlistId ?? Guid.NewGuid().ToString("N"),
            Title: title,
            Artist: artist,
            ThumbnailUrl: thumbnailUrl,
            Year: "Album / Playlist",
            Tracks: tracks
        );
    }

    public async Task<ArtistDto> GetArtistDetailsAsync(string artistName, string thumbnailUrl)
    {
        var tracks = await SearchVideosOnlyAsync($"{artistName} top songs", 15);
        return new ArtistDto(
            Id: artistName.ToLowerInvariant().Replace(" ", "_"),
            Name: artistName,
            ThumbnailUrl: thumbnailUrl,
            TopTracks: tracks
        );
    }

    public void PrefetchAudioStreamUrls(IEnumerable<string> videoIds)
    {
        foreach (var id in videoIds)
        {
            if (string.IsNullOrWhiteSpace(id)) continue;
            if (_streamCache.TryGetValue(id, out var cached) && cached.Expiry > DateTime.UtcNow)
                continue;

            _ = Task.Run(async () =>
            {
                try
                {
                    await GetAudioStreamUrlAsync(id);
                }
                catch { }
            });
        }
    }

    public async Task<string?> GetAudioStreamUrlAsync(string videoId)
    {
        if (_streamCache.TryGetValue(videoId, out var cached) && cached.Expiry > DateTime.UtcNow)
        {
            return cached.Url;
        }

        try
        {
            var manifest = await _youtubeClient.Videos.Streams.GetManifestAsync(videoId);
            var audioStreamInfo = manifest.GetAudioOnlyStreams()
                .OrderByDescending(s => s.Bitrate)
                .FirstOrDefault();

            if (audioStreamInfo != null)
            {
                var url = audioStreamInfo.Url;
                _streamCache[videoId] = (url, DateTime.UtcNow.AddHours(6));
                return url;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error resolving audio stream for {videoId}: {ex.Message}");
        }

        return null;
    }

    public async Task<List<AlbumDto>> SearchPlaylistsOnlyAsync(string query, int limit = 6)
    {
        var pList = new List<AlbumDto>();
        try
        {
            await foreach (var batch in _youtubeClient.Search.GetResultBatchesAsync(query, SearchFilter.Playlist))
            {
                foreach (var item in batch.Items)
                {
                    if (item is PlaylistSearchResult pl)
                    {
                        pList.Add(new AlbumDto(
                            Id: pl.Id.Value,
                            Title: CleanTitle(pl.Title),
                            Artist: pl.Author?.ChannelTitle ?? "YouTube Music",
                            ThumbnailUrl: pl.Thumbnails.GetWithHighestResolution()?.Url ?? "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
                            Year: "Playlist",
                            Tracks: new List<TrackDto>()
                        ));
                        if (pList.Count >= limit) break;
                    }
                }
                if (pList.Count >= limit) break;
            }
        }
        catch { }
        return pList;
    }

    public async Task<List<ArtistDto>> SearchArtistsOnlyAsync(string query, int limit = 6)
    {
        var aList = new List<ArtistDto>();
        try
        {
            await foreach (var batch in _youtubeClient.Search.GetResultBatchesAsync(query, SearchFilter.Channel))
            {
                foreach (var item in batch.Items)
                {
                    if (item is ChannelSearchResult ch)
                    {
                        aList.Add(new ArtistDto(
                            Id: ch.Id.Value,
                            Name: ch.Title,
                            ThumbnailUrl: ch.Thumbnails.GetWithHighestResolution()?.Url ?? "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop",
                            TopTracks: new List<TrackDto>()
                        ));
                        if (aList.Count >= limit) break;
                    }
                }
                if (aList.Count >= limit) break;
            }
        }
        catch { }
        return aList;
    }

    public async Task<HomeFeedDto> GetHomeFeedAsync(List<string>? topArtists = null)
    {
        var trendingTask = SearchVideosOnlyAsync("trending songs global billboard charts 2026", 8);
        var quickPicksTask = SearchVideosOnlyAsync("top viral hits audio songs 2026", 8);
        var freshDropsTask = SearchVideosOnlyAsync("latest new music drops singles 2026", 8);

        var topArtist = topArtists?.FirstOrDefault();
        var recommendedTask = !string.IsNullOrEmpty(topArtist)
            ? SearchVideosOnlyAsync($"{topArtist} best songs hits", 8)
            : SearchVideosOnlyAsync("daily mix songs hits", 8);

        var albumsTask = SearchPlaylistsOnlyAsync("top music albums 2026", 6);
        var mixesTask = SearchPlaylistsOnlyAsync("best music mix playlist", 6);
        var artistsTask = SearchArtistsOnlyAsync("popular singers artists", 6);

        await Task.WhenAll(trendingTask, quickPicksTask, freshDropsTask, recommendedTask, albumsTask, mixesTask, artistsTask);

        var quickPicks = (await quickPicksTask).Take(8).ToList();
        var quickIds = quickPicks.Select(t => t.Id).ToHashSet();

        var trending = (await trendingTask).Where(t => !quickIds.Contains(t.Id)).Take(8).ToList();
        var usedIds = new HashSet<string>(quickIds);
        foreach (var t in trending) usedIds.Add(t.Id);

        var freshDrops = (await freshDropsTask).Where(t => !usedIds.Contains(t.Id)).Take(8).ToList();

        var recTitle = !string.IsNullOrEmpty(topArtist)
            ? $"Because you listened to {topArtist}"
            : "Recommended for you";

        return new HomeFeedDto(
            TrendingSongs: trending,
            PopularArtists: await artistsTask,
            PopularAlbums: await albumsTask,
            QuickPicks: quickPicks,
            MixedForYou: await mixesTask,
            FreshDrops: freshDrops,
            Recommended: await recommendedTask,
            RecommendedTitle: recTitle
        );
    }

    private static string CleanTitle(string title)
    {
        return title
            .Replace("(Official Video)", "", StringComparison.OrdinalIgnoreCase)
            .Replace("(Official Music Video)", "", StringComparison.OrdinalIgnoreCase)
            .Replace("[Official Video]", "", StringComparison.OrdinalIgnoreCase)
            .Replace("(Audio)", "", StringComparison.OrdinalIgnoreCase)
            .Replace("[Audio]", "", StringComparison.OrdinalIgnoreCase)
            .Replace("(Lyrics)", "", StringComparison.OrdinalIgnoreCase)
            .Replace("[Lyrics]", "", StringComparison.OrdinalIgnoreCase)
            .Trim();
    }
}
