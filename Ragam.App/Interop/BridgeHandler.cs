using System.Runtime.InteropServices;
using System.Windows.Interop;
using System.Text.Json;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using Ragam.App.Models;
using Ragam.App.Services;

namespace Ragam.App.Interop;

public class BridgeHandler
{
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };
    [DllImport("user32.dll")]
    private static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    private static extern IntPtr SendMessage(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam);

    private const int WM_NCLBUTTONDOWN = 0xA1;
    private const int HT_CAPTION = 0x2;

    private readonly CoreWebView2Environment _env;
    private readonly YouTubeService _youTubeService;
    private readonly InnerTubeService _innerTubeService;
    private readonly LyricsService _lyricsService;
    private readonly DatabaseService _databaseService;
    private readonly DiscordRpcService _discordService;
    private readonly UpdateService _updateService;
    private readonly TaskbarService _taskbarService;
    private readonly AuthService _authService = new();
    private readonly Window _window;
    private readonly WebView2 _webView;

    public BridgeHandler(
        Window window,
        WebView2 webView,
        CoreWebView2Environment env,
        YouTubeService youTubeService,
        InnerTubeService innerTubeService,
        LyricsService lyricsService,
        DatabaseService databaseService,
        DiscordRpcService discordService,
        UpdateService updateService,
        TaskbarService taskbarService)
    {
        _window = window;
        _webView = webView;
        _env = env;
        _youTubeService = youTubeService;
        _innerTubeService = innerTubeService;
        _lyricsService = lyricsService;
        _databaseService = databaseService;
        _discordService = discordService;
        _updateService = updateService;
        _taskbarService = taskbarService;

        _taskbarService.OnPrevious += () => SendEvent("media_prev", new { });
        _taskbarService.OnTogglePlay += () => SendEvent("media_toggle_play", new { });
        _taskbarService.OnNext += () => SendEvent("media_next", new { });
    }

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, HomeFeedDto> _cachedChipFeeds = new();

    private void SendEvent(string eventName, object payload)
    {
        try
        {
            var eventObj = new { isEvent = true, eventName, payload };
            var json = JsonSerializer.Serialize(eventObj, _jsonOptions);
            _window.Dispatcher.Invoke(() =>
            {
                _webView.CoreWebView2.PostWebMessageAsJson(json);
            });
        }
        catch { }
    }

    public async Task HandleMessageAsync(string jsonMessage)
    {
        try
        {
            var req = JsonSerializer.Deserialize<BridgeRequest>(jsonMessage);
            if (req == null) return;

            object? responseData = null;
            string? error = null;

            try
            {
                switch (req.Action.ToLowerInvariant())
                {
                    case "get_home_feed":
                        var forceRefresh = req.Payload.ValueKind == JsonValueKind.Object &&
                                           req.Payload.TryGetProperty("forceRefresh", out var frProp) &&
                                           frProp.GetBoolean();
                        var feedParams = req.Payload.ValueKind == JsonValueKind.Object &&
                                         req.Payload.TryGetProperty("params", out var pProp)
                            ? pProp.GetString()
                            : null;

                        var cacheKey = string.IsNullOrEmpty(feedParams) ? "__main__" : feedParams;

                        if (!forceRefresh && _cachedChipFeeds.TryGetValue(cacheKey, out var existingFeed))
                        {
                            responseData = existingFeed;
                            break;
                        }

                        HomeFeedDto? feed = null;
                        try
                        {
                            var history = await _databaseService.GetHistoryAsync();
                            feed = await _innerTubeService.GetHomeFeedAsync(feedParams, history);
                        }
                        catch (Exception ex)
                        {
                            System.Diagnostics.Debug.WriteLine($"InnerTube feed exception: {ex.Message}");
                        }

                        if (feed == null || ((feed.Sections == null || feed.Sections.Count == 0) &&
                                             (feed.QuickPicks == null || feed.QuickPicks.Count == 0) &&
                                             (feed.TrendingSongs == null || feed.TrendingSongs.Count == 0)))
                        {
                            var topArtists = await _databaseService.GetTopPlayedArtistsAsync(3);
                            feed = await _youTubeService.GetHomeFeedAsync(topArtists);
                        }

                        if (feed != null)
                        {
                            _cachedChipFeeds[cacheKey] = feed;
                        }

                        responseData = feed;
                        break;

                    case "get_mood_category":
                        var moodTitle = req.Payload.TryGetProperty("title", out var mtProp) ? mtProp.GetString() ?? "Mood" : "Mood";
                        var moodParams = req.Payload.TryGetProperty("params", out var mpProp) ? mpProp.GetString() : null;
                        var moodBrowseId = req.Payload.TryGetProperty("browseId", out var mbProp) ? mbProp.GetString() : null;

                        HomeFeedDto? moodFeed = null;
                        try
                        {
                            moodFeed = await _innerTubeService.GetMoodCategoryAsync(moodBrowseId, moodParams, moodTitle);
                        }
                        catch (Exception ex)
                        {
                            System.Diagnostics.Debug.WriteLine($"InnerTube mood exception: {ex.Message}");
                        }

                        if (moodFeed == null || moodFeed.Sections == null || moodFeed.Sections.Count == 0)
                        {
                            // Fallback to YouTube service search
                            var fallbackPlaylists = await _youTubeService.SearchPlaylistsOnlyAsync($"{moodTitle} playlists music", 18);
                            var fallbackTracks = await _youTubeService.SearchVideosOnlyAsync($"{moodTitle} top songs", 12);

                            var fallbackSections = new List<HomeSectionDto>();
                            if (fallbackPlaylists.Count > 0)
                            {
                                fallbackSections.Add(new HomeSectionDto(
                                    Title: $"{moodTitle} Playlists",
                                    Subtitle: "Featured collections",
                                    ThumbnailUrl: null,
                                    Items: fallbackPlaylists.Select(p => new HomeSectionItemDto(
                                        Type: "playlist",
                                        Id: p.Id,
                                        Title: p.Title,
                                        Artist: p.Artist,
                                        ThumbnailUrl: p.ThumbnailUrl,
                                        Year: "Playlist"
                                    )).ToList()
                                ));
                            }
                            if (fallbackTracks.Count > 0)
                            {
                                fallbackSections.Add(new HomeSectionDto(
                                    Title: $"Popular {moodTitle} Songs",
                                    Subtitle: "Top tracks",
                                    ThumbnailUrl: null,
                                    Items: fallbackTracks.Select(t => new HomeSectionItemDto(
                                        Type: "song",
                                        Id: t.Id,
                                        Title: t.Title,
                                        Artist: t.Artist,
                                        ThumbnailUrl: t.ThumbnailUrl,
                                        DurationSeconds: t.DurationSeconds,
                                        Tracks: new List<TrackDto> { t }
                                    )).ToList()
                                ));
                            }

                            moodFeed = new HomeFeedDto(
                                TrendingSongs: fallbackTracks,
                                PopularArtists: new List<ArtistDto>(),
                                PopularAlbums: fallbackPlaylists,
                                QuickPicks: fallbackTracks,
                                Sections: fallbackSections
                            );
                        }

                        responseData = moodFeed;
                        break;

                    case "get_explore_moods":
                        responseData = await _innerTubeService.GetExploreMoodsAsync();
                        break;

                    case "get_auth_state":
                        if (_innerTubeService.IsLoggedIn)
                        {
                            responseData = new
                            {
                                isLoggedIn = true,
                                userName = _innerTubeService.Session.AccountName ?? "YouTube Music User",
                                userEmail = _innerTubeService.Session.AccountEmail,
                                avatarUrl = _innerTubeService.Session.AvatarUrl ?? "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop"
                            };
                        }
                        else
                        {
                            responseData = _authService.GetCurrentAuthState();
                        }
                        break;

                    case "login_youtube":
                        var tcs = new TaskCompletionSource<object>();
                        Application.Current.Dispatcher.Invoke(() =>
                        {
                            try
                            {
                                var loginWin = new YouTubeLoginWindow(_env, _innerTubeService)
                                {
                                    Owner = _window
                                };
                                loginWin.LoginCompleted += (success) =>
                                {
                                    if (success && _innerTubeService.IsLoggedIn)
                                    {
                                        tcs.TrySetResult(new
                                        {
                                            isLoggedIn = true,
                                            userName = _innerTubeService.Session.AccountName ?? "YouTube Music User",
                                            userEmail = _innerTubeService.Session.AccountEmail,
                                            avatarUrl = _innerTubeService.Session.AvatarUrl ?? "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop"
                                        });
                                    }
                                    else
                                    {
                                        tcs.TrySetResult(new { isLoggedIn = false });
                                    }
                                };
                                loginWin.Show();
                            }
                            catch (Exception ex)
                            {
                                tcs.TrySetException(ex);
                            }
                        });
                        responseData = await tcs.Task;
                        break;

                    case "login_email":
                        var loginEmail = req.Payload.GetProperty("email").GetString() ?? "";
                        var loginPass = req.Payload.GetProperty("password").GetString() ?? "";
                        responseData = await _authService.LoginAsync(loginEmail, loginPass);
                        break;

                    case "register_email":
                        var regEmail = req.Payload.GetProperty("email").GetString() ?? "";
                        var regPass = req.Payload.GetProperty("password").GetString() ?? "";
                        var regName = req.Payload.TryGetProperty("displayName", out var np) ? np.GetString() ?? "" : "";
                        var regAvatar = req.Payload.TryGetProperty("avatarUrl", out var ap) ? ap.GetString() : null;
                        responseData = await _authService.RegisterAsync(regEmail, regPass, regName, regAvatar);
                        break;

                    case "guest_login":
                        responseData = _authService.GuestLogin();
                        break;

                    case "logout":
                        _innerTubeService.Logout();
                        _authService.Logout();
                        responseData = new { success = true };
                        break;

                    case "search":
                        var query = req.Payload.GetProperty("query").GetString() ?? "";
                        responseData = await _youTubeService.SearchAllAsync(query);
                        break;

                    case "get_album_or_playlist":
                        var albTitle = req.Payload.GetProperty("title").GetString() ?? "";
                        var albArtist = req.Payload.GetProperty("artist").GetString() ?? "";
                        var albThumb = req.Payload.GetProperty("thumbnailUrl").GetString() ?? "";
                        var albId = req.Payload.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;
                        var albumData = await _innerTubeService.GetAlbumOrPlaylistAsync(albTitle, albArtist, albThumb, albId);
                        if (albumData == null || albumData.Tracks.Count == 0)
                        {
                            albumData = await _youTubeService.GetAlbumOrPlaylistAsync(albTitle, albArtist, albThumb, albId);
                        }
                        responseData = albumData;
                        break;

                    case "get_artist_details":
                        var artName = req.Payload.GetProperty("name").GetString() ?? "";
                        var artThumb = req.Payload.GetProperty("thumbnailUrl").GetString() ?? "";
                        var artId = req.Payload.TryGetProperty("id", out var idArtProp) ? idArtProp.GetString() : null;
                        var artistData = await _innerTubeService.GetArtistDetailsAsync(artName, artThumb, artId);
                        responseData = artistData ?? await _youTubeService.GetArtistDetailsAsync(artName, artThumb);
                        break;

                    case "get_stream_url":
                        var videoId = req.Payload.GetProperty("id").GetString() ?? "";
                        var streamUrl = await _youTubeService.GetAudioStreamUrlAsync(videoId);
                        responseData = new { url = streamUrl };
                        break;

                    case "prefetch_streams":
                        if (req.Payload.TryGetProperty("ids", out var idsProp) && idsProp.ValueKind == JsonValueKind.Array)
                        {
                            var ids = idsProp.EnumerateArray()
                                .Select(x => x.GetString())
                                .Where(x => !string.IsNullOrEmpty(x))
                                .Select(x => x!);
                            _youTubeService.PrefetchAudioStreamUrls(ids);
                        }
                        responseData = new { success = true };
                        break;

                    case "get_lyrics":
                        var trackId = req.Payload.GetProperty("id").GetString() ?? "";
                        var title = req.Payload.GetProperty("title").GetString() ?? "";
                        var artist = req.Payload.GetProperty("artist").GetString() ?? "";
                        var duration = req.Payload.GetProperty("duration").GetDouble();
                        responseData = await _lyricsService.GetLyricsAsync(trackId, title, artist, duration);
                        break;

                    case "toggle_favorite":
                        var favTrack = JsonSerializer.Deserialize<TrackDto>(req.Payload.GetRawText());
                        if (favTrack != null)
                        {
                            var isFav = await _databaseService.ToggleFavoriteAsync(favTrack);
                            responseData = new { isFavorite = isFav };
                        }
                        break;

                    case "get_favorites":
                        responseData = await _databaseService.GetFavoritesAsync();
                        break;

                    case "get_history":
                        responseData = await _databaseService.GetHistoryAsync();
                        break;

                    case "add_history":
                        var histTrack = JsonSerializer.Deserialize<TrackDto>(req.Payload.GetRawText());
                        if (histTrack != null)
                        {
                            await _databaseService.AddToHistoryAsync(histTrack);
                            _discordService.UpdatePresence(histTrack, true);
                        }
                        responseData = new { success = true };
                        break;

                    case "get_playlists":
                        responseData = await _databaseService.GetPlaylistsAsync();
                        break;

                    case "create_playlist":
                        var plName = req.Payload.GetProperty("name").GetString() ?? "New Playlist";
                        var plDesc = req.Payload.TryGetProperty("description", out var d) ? d.GetString() : null;
                        responseData = await _databaseService.CreatePlaylistAsync(plName, plDesc);
                        break;

                    case "add_to_playlist":
                        var pId = req.Payload.GetProperty("playlistId").GetString() ?? "";
                        var pTrack = JsonSerializer.Deserialize<TrackDto>(req.Payload.GetProperty("track").GetRawText());
                        if (pTrack != null)
                        {
                            var added = await _databaseService.AddTrackToPlaylistAsync(pId, pTrack);
                            responseData = new { success = added };
                        }
                        break;

                    case "remove_from_playlist":
                        var remPlId = req.Payload.GetProperty("playlistId").GetString() ?? "";
                        var remTrackId = req.Payload.GetProperty("trackId").GetString() ?? "";
                        var removed = await _databaseService.RemoveTrackFromPlaylistAsync(remPlId, remTrackId);
                        responseData = new { success = removed };
                        break;

                    case "delete_playlist":
                        var delId = req.Payload.GetProperty("playlistId").GetString() ?? "";
                        var deleted = await _databaseService.DeletePlaylistAsync(delId);
                        responseData = new { success = deleted };
                        break;

                                                            case "get_app_version":
                        responseData = new { version = _updateService.GetCurrentVersion() };
                        break;

                    case "check_for_updates":
                        var updateInfo = await _updateService.CheckForUpdatesAsync();
                        responseData = updateInfo;
                        break;

                    case "install_update":
                        var dlUrl = req.Payload.TryGetProperty("downloadUrl", out var dl) ? dl.GetString() ?? "" : "";
                        var updateSuccess = await _updateService.DownloadAndApplyUpdateAsync(dlUrl, (progress) =>
                        {
                            SendEvent("update_progress", new { progress });
                        });
                        responseData = new { success = updateSuccess };
                        break;

                    case "window_drag":
                        _window.Dispatcher.Invoke(() =>
                        {
                            var helper = new WindowInteropHelper(_window);
                            ReleaseCapture();
                            SendMessage(helper.Handle, WM_NCLBUTTONDOWN, (IntPtr)HT_CAPTION, IntPtr.Zero);
                        });
                        break;

                    case "window_minimize":
                        _window.Dispatcher.Invoke(() => _window.WindowState = WindowState.Minimized);
                        break;

                    case "window_maximize":
                        _window.Dispatcher.Invoke(() =>
                        {
                            _window.WindowState = _window.WindowState == WindowState.Maximized 
                                ? WindowState.Normal 
                                : WindowState.Maximized;
                        });
                        break;

                    case "open_external_url":
                        var extUrl = req.Payload.TryGetProperty("url", out var up) ? up.GetString() : "";
                        if (!string.IsNullOrEmpty(extUrl))
                        {
                            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(extUrl) { UseShellExecute = true });
                        }
                        responseData = new { success = true };
                        break;

                    case "update_playback_state":
                        var hasTrack = req.Payload.TryGetProperty("hasTrack", out var htProp) && htProp.GetBoolean();
                        var isPlaying = req.Payload.TryGetProperty("isPlaying", out var ipProp) && ipProp.GetBoolean();
                        var pTitle = req.Payload.TryGetProperty("title", out var ptProp) ? ptProp.GetString() : null;
                        var pArtist = req.Payload.TryGetProperty("artist", out var paProp) ? paProp.GetString() : null;
                        var pThumb = req.Payload.TryGetProperty("thumbnailUrl", out var pthProp) ? pthProp.GetString() : null;
                        var progress = req.Payload.TryGetProperty("progress", out var prProp) ? prProp.GetDouble() : 0.0;

                        _taskbarService.UpdatePlaybackState(hasTrack, isPlaying, pTitle, pArtist, pThumb, progress);
                        responseData = new { success = true };
                        break;

                    case "window_close":
                        _window.Dispatcher.Invoke(() => _window.Close());
                        break;

                    default:
                        error = $"Unknown action: {req.Action}";
                        break;
                }
            }
            catch (Exception ex)
            {
                error = ex.Message;
            }

            var response = new BridgeResponse(req.Id, error == null, responseData, error);
            var jsonResponse = JsonSerializer.Serialize(response, _jsonOptions);
            _webView.CoreWebView2.PostWebMessageAsJson(jsonResponse);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Bridge error: {ex}");



        }
    }
}
