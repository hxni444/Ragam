using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Ragam.App.Data;

[Table("FavoriteTracks")]
public class FavoriteTrackEntity
{
    [Key]
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Artist { get; set; } = string.Empty;
    public string? Album { get; set; }
    public double DurationSeconds { get; set; }
    public string ThumbnailUrl { get; set; } = string.Empty;
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
}

[Table("HistoryTracks")]
public class HistoryTrackEntity
{
    [Key]
    public int HistoryId { get; set; }
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Artist { get; set; } = string.Empty;
    public string? Album { get; set; }
    public double DurationSeconds { get; set; }
    public string ThumbnailUrl { get; set; } = string.Empty;
    public DateTime PlayedAt { get; set; } = DateTime.UtcNow;
}

[Table("Playlists")]
public class PlaylistEntity
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? CoverUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<PlaylistTrackEntity> Tracks { get; set; } = new();
}

[Table("PlaylistTracks")]
public class PlaylistTrackEntity
{
    [Key]
    public int Id { get; set; }
    public string PlaylistId { get; set; } = string.Empty;
    public string TrackId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Artist { get; set; } = string.Empty;
    public string? Album { get; set; }
    public double DurationSeconds { get; set; }
    public string ThumbnailUrl { get; set; } = string.Empty;
    public int Position { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
}

[Table("Users")]
public class UserAccountEntity
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

