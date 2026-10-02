using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Ragam.App.Models;

namespace Ragam.App.Services;

public class LyricsService
{
    private readonly HttpClient _httpClient;
    private static readonly Regex LrcRegex = new(@"\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)", RegexOptions.Compiled);

    public LyricsService()
    {
        _httpClient = new HttpClient();
        _httpClient.DefaultRequestHeaders.Add("User-Agent", "Ragam/1.0.0 (https://github.com/nikhilvishwakarma00/Ragam)");
    }

    public async Task<LyricsDto> GetLyricsAsync(string trackId, string title, string artist, double durationSeconds)
    {
        try
        {
            var cleanTitle = CleanTrackTitle(title);
            var cleanArtist = CleanArtistName(artist);

            // 1. Try exact match on LRCLIB
            var url = $"https://lrclib.net/api/get?track_name={Uri.EscapeDataString(cleanTitle)}&artist_name={Uri.EscapeDataString(cleanArtist)}&duration={Math.Round(durationSeconds)}";
            var response = await _httpClient.GetAsync(url);

            if (response.IsSuccessStatusCode)
            {
                var lrcResponse = await response.Content.ReadFromJsonAsync<LrcLibResponse>();
                if (lrcResponse != null)
                {
                    if (!string.IsNullOrWhiteSpace(lrcResponse.SyncedLyrics))
                    {
                        var lines = ParseLrc(lrcResponse.SyncedLyrics);
                        return new LyricsDto(trackId, true, lines, lrcResponse.PlainLyrics);
                    }
                    if (!string.IsNullOrWhiteSpace(lrcResponse.PlainLyrics))
                    {
                        return new LyricsDto(trackId, false, new List<LyricLineDto>(), lrcResponse.PlainLyrics);
                    }
                }
            }

            // 2. Fallback to LRCLIB Search endpoint
            var searchUrl = $"https://lrclib.net/api/search?q={Uri.EscapeDataString($"{cleanTitle} {cleanArtist}")}";
            var searchResponse = await _httpClient.GetAsync(searchUrl);
            if (searchResponse.IsSuccessStatusCode)
            {
                var list = await searchResponse.Content.ReadFromJsonAsync<List<LrcLibResponse>>();
                var match = list?.FirstOrDefault(x => !string.IsNullOrEmpty(x.SyncedLyrics) || !string.IsNullOrEmpty(x.PlainLyrics));
                if (match != null)
                {
                    if (!string.IsNullOrWhiteSpace(match.SyncedLyrics))
                    {
                        var lines = ParseLrc(match.SyncedLyrics);
                        return new LyricsDto(trackId, true, lines, match.PlainLyrics);
                    }
                    if (!string.IsNullOrWhiteSpace(match.PlainLyrics))
                    {
                        return new LyricsDto(trackId, false, new List<LyricLineDto>(), match.PlainLyrics);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error fetching lyrics: {ex.Message}");
        }

        return new LyricsDto(trackId, false, new List<LyricLineDto>(), "Lyrics not available for this track.");
    }

    private static List<LyricLineDto> ParseLrc(string syncedLyrics)
    {
        var result = new List<LyricLineDto>();
        var lines = syncedLyrics.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);

        foreach (var line in lines)
        {
            var match = LrcRegex.Match(line);
            if (match.Success)
            {
                var minutes = int.Parse(match.Groups[1].Value);
                var seconds = int.Parse(match.Groups[2].Value);
                var fractionStr = match.Groups[3].Value;
                var millis = fractionStr.Length == 2 ? int.Parse(fractionStr) * 10 : int.Parse(fractionStr);

                var totalMs = (minutes * 60 * 1000) + (seconds * 1000) + millis;
                var text = match.Groups[4].Value.Trim();

                if (!string.IsNullOrWhiteSpace(text))
                {
                    result.Add(new LyricLineDto(totalMs, text));
                }
            }
        }

        return result.OrderBy(l => l.TimeMs).ToList();
    }

    private static string CleanTrackTitle(string title)
    {
        var t = title;
        var ftIndex = t.IndexOf("feat.", StringComparison.OrdinalIgnoreCase);
        if (ftIndex > 0) t = t.Substring(0, ftIndex);
        var ftIndex2 = t.IndexOf("ft.", StringComparison.OrdinalIgnoreCase);
        if (ftIndex2 > 0) t = t.Substring(0, ftIndex2);
        return t.Trim();
    }

    private static string CleanArtistName(string artist)
    {
        return artist.Replace(" - Topic", "", StringComparison.OrdinalIgnoreCase)
                     .Replace("VEVO", "", StringComparison.OrdinalIgnoreCase)
                     .Trim();
    }

    private class LrcLibResponse
    {
        [JsonPropertyName("id")] public int Id { get; set; }
        [JsonPropertyName("name")] public string? Name { get; set; }
        [JsonPropertyName("artistName")] public string? ArtistName { get; set; }
        [JsonPropertyName("syncedLyrics")] public string? SyncedLyrics { get; set; }
        [JsonPropertyName("plainLyrics")] public string? PlainLyrics { get; set; }
    }
}
