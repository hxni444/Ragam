using Microsoft.EntityFrameworkCore;
using Ragam.App.Data;
using Ragam.App.Models;

namespace Ragam.App.Services;

public class DatabaseService
{

    private static string CleanTitleDecoration(string title)
    {
        if (string.IsNullOrWhiteSpace(title)) return "";
        var cleaned = System.Text.RegularExpressions.Regex.Replace(
            title,
            @"\s*[([{\-]\s*(official\s*(music\s*)?video|official\s*audio|visualizer|lyric\s*video|lyrics|4k|hd|hq|audio|video|full\s*song)\s*[)\]}]",
            "",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase
        );
        cleaned = System.Text.RegularExpressions.Regex.Replace(cleaned, @"[^\w\s]", "");
        return System.Text.RegularExpressions.Regex.Replace(cleaned, @"\s+", " ").Trim().ToLowerInvariant();
    }

    private static bool IsSameSong(PlaylistTrackEntity existing, TrackDto incoming)
    {
        if (existing.TrackId == incoming.Id) return true;

        var t1 = CleanTitleDecoration(existing.Title);
        var t2 = CleanTitleDecoration(incoming.Title);

        if (!string.IsNullOrEmpty(t1) && t1 == t2)
        {
            var a1 = CleanTitleDecoration(existing.Artist);
            var a2 = CleanTitleDecoration(incoming.Artist);
            if (string.IsNullOrEmpty(a1) || string.IsNullOrEmpty(a2) || a1 == a2 || a1.Contains(a2) || a2.Contains(a1))
            {
                return true;
            }
        }
        return false;
    }

    public async Task<List<TrackDto>> GetFavoritesAsync()
    {
        using var db = new AppDbContext();
        var favs = await db.Favorites.OrderByDescending(f => f.AddedAt).ToListAsync();
        return favs.Select(f => new TrackDto(f.Id, f.Title, f.Artist, f.Album, f.DurationSeconds, f.ThumbnailUrl)).ToList();
    }

    public async Task<bool> ToggleFavoriteAsync(TrackDto track)
    {
        using var db = new AppDbContext();
        var existing = await db.Favorites.FindAsync(track.Id);
        if (existing != null)
        {
            db.Favorites.Remove(existing);
            await db.SaveChangesAsync();
            return false;
        }
        else
        {
            db.Favorites.Add(new FavoriteTrackEntity
            {
                Id = track.Id,
                Title = track.Title,
                Artist = track.Artist,
                Album = track.Album,
                DurationSeconds = track.DurationSeconds,
                ThumbnailUrl = track.ThumbnailUrl,
                AddedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
            return true;
        }
    }

    public async Task<bool> IsFavoriteAsync(string trackId)
    {
        using var db = new AppDbContext();
        return await db.Favorites.AnyAsync(f => f.Id == trackId);
    }

    public async Task AddToHistoryAsync(TrackDto track)
    {
        using var db = new AppDbContext();
        db.History.Add(new HistoryTrackEntity
        {
            Id = track.Id,
            Title = track.Title,
            Artist = track.Artist,
            Album = track.Album,
            DurationSeconds = track.DurationSeconds,
            ThumbnailUrl = track.ThumbnailUrl,
            PlayedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
    }

    public async Task<List<string>> GetTopPlayedArtistsAsync(int limit = 3)
    {
        using var db = new AppDbContext();
        return await db.History
            .Where(h => !string.IsNullOrEmpty(h.Artist))
            .GroupBy(h => h.Artist)
            .OrderByDescending(g => g.Count())
            .Take(limit)
            .Select(g => g.Key)
            .ToListAsync();
    }

    public async Task<List<TrackDto>> GetHistoryAsync(int limit = 50)
    {
        using var db = new AppDbContext();
        var items = await db.History
            .OrderByDescending(h => h.PlayedAt)
            .Take(limit)
            .ToListAsync();

        return items.Select(h => new TrackDto(h.Id, h.Title, h.Artist, h.Album, h.DurationSeconds, h.ThumbnailUrl)).ToList();
    }

    public async Task<List<PlaylistDto>> GetPlaylistsAsync()
    {
        using var db = new AppDbContext();
        var playlists = await db.Playlists.Include(p => p.Tracks).ToListAsync();
        return playlists.Select(p => {
            var distinctTracks = p.Tracks
                .OrderBy(t => t.Position)
                .GroupBy(t => t.TrackId)
                .Select(g => g.First())
                .Select(t => new TrackDto(t.TrackId, t.Title, t.Artist, t.Album, t.DurationSeconds, t.ThumbnailUrl))
                .ToList();

            return new PlaylistDto(
                p.Id,
                p.Name,
                p.Description,
                p.CoverUrl ?? distinctTracks.FirstOrDefault()?.ThumbnailUrl,
                distinctTracks
            );
        }).ToList();
    }

    public async Task<PlaylistDto> CreatePlaylistAsync(string name, string? description = null)
    {
        using var db = new AppDbContext();
        var entity = new PlaylistEntity
        {
            Id = Guid.NewGuid().ToString("N"),
            Name = name,
            Description = description,
            CreatedAt = DateTime.UtcNow
        };
        db.Playlists.Add(entity);
        await db.SaveChangesAsync();

        return new PlaylistDto(entity.Id, entity.Name, entity.Description, null, new List<TrackDto>());
    }

    public async Task<bool> AddTrackToPlaylistAsync(string playlistId, TrackDto track)
    {
        using var db = new AppDbContext();
        var playlist = await db.Playlists.Include(p => p.Tracks).FirstOrDefaultAsync(p => p.Id == playlistId);
        if (playlist == null) return false;

        // Check if track already exists in the playlist to prevent duplicates
        if (playlist.Tracks.Any(t => IsSameSong(t, track)))
        {
            return true; // Already added
        }

        playlist.Tracks.Add(new PlaylistTrackEntity
        {
            PlaylistId = playlistId,
            TrackId = track.Id,
            Title = track.Title ?? "",
            Artist = track.Artist ?? "",
            Album = track.Album,
            DurationSeconds = track.DurationSeconds,
            ThumbnailUrl = track.ThumbnailUrl ?? "",
            Position = playlist.Tracks.Count,
            AddedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RemoveTrackFromPlaylistAsync(string playlistId, string trackId)
    {
        using var db = new AppDbContext();
        var trackItems = await db.PlaylistTracks
            .Where(t => t.PlaylistId == playlistId && t.TrackId == trackId)
            .ToListAsync();
        if (trackItems.Count == 0) return false;

        db.PlaylistTracks.RemoveRange(trackItems);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeletePlaylistAsync(string playlistId)
    {
        using var db = new AppDbContext();
        var entity = await db.Playlists.FindAsync(playlistId);
        if (entity == null) return false;

        db.Playlists.Remove(entity);
        await db.SaveChangesAsync();
        return true;
    }
}
