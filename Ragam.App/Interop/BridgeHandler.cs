using System.Text.Json;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using Velune.Desktop.App.Models;
using Velune.Desktop.App.Services;

namespace Velune.Desktop.App.Interop;

public class BridgeHandler
{
    private readonly CoreWebView2Environment _env;
    private readonly YouTubeService _youTubeService;
    private readonly InnerTubeService _innerTubeService;
    private readonly LyricsService _lyricsService;
    private readonly DatabaseService _databaseService;
    private readonly DiscordRpcService _discordService;
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
        DiscordRpcService discordService)
    {
        _window = window;
        _webView = webView;
        _env = env;
        _youTubeService = youTubeService;
        _innerTubeService = innerTubeService;
        _lyricsService = lyricsService;
        _databaseService = databaseService;
        _discordService = discordService;
    }

    private static HomeFeedDto? _cachedHomeFeed;
    private static DateTime _cachedHomeFeedTime = DateTime.MinValue;

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

                        if (!forceRefresh && string.IsNullOrEmpty(feedParams) && _cachedHomeFeed != null && (DateTime.UtcNow - _cachedHomeFeedTime).TotalMinutes < 15)
                        {
                            responseData = _cachedHomeFeed;
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

                        if (feed != null && string.IsNullOrEmpty(feedParams))
                        {
                            _cachedHomeFeed = feed;
                            _cachedHomeFeedTime = DateTime.UtcNow;
                        }

                        responseData = feed;
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
                        responseData = albumData ?? await _youTubeService.GetAlbumOrPlaylistAsync(albTitle, albArtist, albThumb, albId);
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
            var jsonResponse = JsonSerializer.Serialize(response);
            _webView.CoreWebView2.PostWebMessageAsJson(jsonResponse);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Bridge error: {ex}");
        }
    }
}
