using System.Text.Json.Serialization;

namespace Velune.Desktop.App.Models;

public record TrackDto(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("artist")] string Artist,
    [property: JsonPropertyName("album")] string? Album,
    [property: JsonPropertyName("duration")] double DurationSeconds,
    [property: JsonPropertyName("thumbnailUrl")] string ThumbnailUrl,
    [property: JsonPropertyName("audioUrl")] string? AudioUrl = null
);

public record AlbumDto(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("artist")] string Artist,
    [property: JsonPropertyName("thumbnailUrl")] string ThumbnailUrl,
    [property: JsonPropertyName("year")] string? Year,
    [property: JsonPropertyName("tracks")] List<TrackDto> Tracks
);

public record ArtistDto(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("thumbnailUrl")] string ThumbnailUrl,
    [property: JsonPropertyName("topTracks")] List<TrackDto> TopTracks
);

public record PlaylistDto(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("coverUrl")] string? CoverUrl,
    [property: JsonPropertyName("tracks")] List<TrackDto> Tracks
);

public record LyricLineDto(
    [property: JsonPropertyName("timeMs")] long TimeMs,
    [property: JsonPropertyName("text")] string Text
);

public record LyricsDto(
    [property: JsonPropertyName("trackId")] string TrackId,
    [property: JsonPropertyName("isSynced")] bool IsSynced,
    [property: JsonPropertyName("lines")] List<LyricLineDto> Lines,
    [property: JsonPropertyName("plainLyrics")] string? PlainLyrics = null
);

public record MoodAndGenreItemDto(
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("stripeColor")] string StripeColor,
    [property: JsonPropertyName("params")] string? Params,
    [property: JsonPropertyName("browseId")] string? BrowseId = null
);

public record HomeChipDto(
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("params")] string? Params
);

public record HomeSectionItemDto(
    [property: JsonPropertyName("type")] string Type, // "song", "album", "playlist", "artist"
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("artist")] string Artist,
    [property: JsonPropertyName("thumbnailUrl")] string ThumbnailUrl,
    [property: JsonPropertyName("year")] string? Year = null,
    [property: JsonPropertyName("duration")] double DurationSeconds = 210,
    [property: JsonPropertyName("tracks")] List<TrackDto>? Tracks = null
);

public record HomeSectionDto(
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("subtitle")] string? Subtitle,
    [property: JsonPropertyName("thumbnailUrl")] string? ThumbnailUrl,
    [property: JsonPropertyName("items")] List<HomeSectionItemDto> Items
);

public record HomeFeedDto(
    [property: JsonPropertyName("trendingSongs")] List<TrackDto> TrendingSongs,
    [property: JsonPropertyName("popularArtists")] List<ArtistDto> PopularArtists,
    [property: JsonPropertyName("popularAlbums")] List<AlbumDto> PopularAlbums,
    [property: JsonPropertyName("quickPicks")] List<TrackDto> QuickPicks,
    [property: JsonPropertyName("chips")] List<HomeChipDto>? Chips = null,
    [property: JsonPropertyName("sections")] List<HomeSectionDto>? Sections = null,
    [property: JsonPropertyName("continuation")] string? Continuation = null,
    [property: JsonPropertyName("mixedForYou")] List<AlbumDto>? MixedForYou = null,
    [property: JsonPropertyName("freshDrops")] List<TrackDto>? FreshDrops = null,
    [property: JsonPropertyName("recommended")] List<TrackDto>? Recommended = null,
    [property: JsonPropertyName("recommendedTitle")] string? RecommendedTitle = null,
    [property: JsonPropertyName("keepListening")] List<TrackDto>? KeepListening = null,
    [property: JsonPropertyName("albumsForYou")] List<AlbumDto>? AlbumsForYou = null,
    [property: JsonPropertyName("freshFinds")] List<TrackDto>? FreshFinds = null,
    [property: JsonPropertyName("communityPlaylists")] List<AlbumDto>? CommunityPlaylists = null,
    [property: JsonPropertyName("moodAndGenres")] List<MoodAndGenreItemDto>? MoodAndGenres = null
);

public record SearchResultDto(
    [property: JsonPropertyName("query")] string Query,
    [property: JsonPropertyName("tracks")] List<TrackDto> Tracks,
    [property: JsonPropertyName("artists")] List<ArtistDto> Artists,
    [property: JsonPropertyName("albums")] List<AlbumDto> Albums
);

public record BridgeRequest(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("action")] string Action,
    [property: JsonPropertyName("payload")] System.Text.Json.JsonElement Payload
);

public record BridgeResponse(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("success")] bool Success,
    [property: JsonPropertyName("data")] object? Data,
    [property: JsonPropertyName("error")] string? Error = null
);
