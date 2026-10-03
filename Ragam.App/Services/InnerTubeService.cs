using System.IO;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Ragam.App.Models;

namespace Ragam.App.Services;

public class InnerTubeSession
{
    public string? Cookie { get; set; }
    public string? VisitorData { get; set; }
    public string? DataSyncId { get; set; }
    public string? AccountName { get; set; }
    public string? AccountEmail { get; set; }
    public string? AvatarUrl { get; set; }
    public bool IsLoggedIn => !string.IsNullOrEmpty(Cookie) && (Cookie.Contains("SAPISID") || Cookie.Contains("SSID") || Cookie.Contains("__Secure-3PAPISID"));
}

public class InnerTubeService
{
    private static readonly string SessionFilePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "Ragam",
        "ytm_session.json"
    );

    private readonly HttpClient _httpClient;
    private InnerTubeSession _session;

    public InnerTubeSession Session => _session;
    public bool IsLoggedIn => _session.IsLoggedIn;

    public InnerTubeService()
    {
        _httpClient = new HttpClient();
        _session = LoadSession();
    }

    private InnerTubeSession LoadSession()
    {
        try
        {
            if (File.Exists(SessionFilePath))
            {
                var json = File.ReadAllText(SessionFilePath);
                var session = JsonSerializer.Deserialize<InnerTubeSession>(json);
                if (session != null) return session;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error loading YTM session: {ex.Message}");
        }

        return new InnerTubeSession();
    }

    public async Task SaveSessionAsync(string cookie, string? visitorData = null, string? dataSyncId = null)
    {
        _session.Cookie = cookie;
        if (!string.IsNullOrEmpty(visitorData)) _session.VisitorData = visitorData;
        if (!string.IsNullOrEmpty(dataSyncId)) _session.DataSyncId = dataSyncId;

        // Try to fetch real account name/avatar from YouTube Music
        try
        {
            await RefreshAccountInfoAsync();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to fetch account info: {ex.Message}");
        }

        SaveSessionToFile();
    }

    public void SaveSessionToFile()
    {
        try
        {
            var dir = Path.GetDirectoryName(SessionFilePath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }

            var json = JsonSerializer.Serialize(_session, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(SessionFilePath, json);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error saving YTM session: {ex.Message}");
        }
    }

    public void Logout()
    {
        _session = new InnerTubeSession();
        try
        {
            if (File.Exists(SessionFilePath))
            {
                File.Delete(SessionFilePath);
            }
        }
        catch { }
    }

    public async Task<bool> RefreshAccountInfoAsync()
    {
        if (!_session.IsLoggedIn) return false;

        try
        {
            var req = new HttpRequestMessage(HttpMethod.Post, "https://music.youtube.com/youtubei/v1/account/account_menu?prettyPrint=false");
            ApplyHeaders(req);

            var contextBody = new
            {
                context = new
                {
                    client = new
                    {
                        clientName = "WEB_REMIX",
                        clientVersion = "1.20260114.01.00",
                        hl = "en",
                        gl = "US"
                    }
                }
            };

            req.Content = new StringContent(JsonSerializer.Serialize(contextBody), Encoding.UTF8, "application/json");

            var res = await _httpClient.SendAsync(req);
            if (!res.IsSuccessStatusCode) return false;

            var json = await res.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            // Extract account name, email, avatar from account_menu
            if (root.TryGetProperty("actions", out var actions) && actions.GetArrayLength() > 0)
            {
                var action = actions[0];
                if (action.TryGetProperty("openPopupAction", out var popupAction) &&
                    popupAction.TryGetProperty("popup", out var popup) &&
                    popup.TryGetProperty("multiPageMenuRenderer", out var menu))
                {
                    if (menu.TryGetProperty("header", out var header) &&
                        header.TryGetProperty("activeAccountHeaderRenderer", out var accountHeader))
                    {
                        if (accountHeader.TryGetProperty("accountName", out var accName) &&
                            accName.TryGetProperty("runs", out var runs) && runs.GetArrayLength() > 0)
                        {
                            _session.AccountName = runs[0].GetProperty("text").GetString();
                        }

                        if (accountHeader.TryGetProperty("email", out var emailProp) &&
                            emailProp.TryGetProperty("runs", out var eRuns) && eRuns.GetArrayLength() > 0)
                        {
                            _session.AccountEmail = eRuns[0].GetProperty("text").GetString();
                        }

                        if (accountHeader.TryGetProperty("accountPhoto", out var photo) &&
                            photo.TryGetProperty("thumbnails", out var thumbs) && thumbs.GetArrayLength() > 0)
                        {
                            _session.AvatarUrl = thumbs[thumbs.GetArrayLength() - 1].GetProperty("url").GetString();
                        }
                    }
                }
            }

            SaveSessionToFile();
            return true;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error in RefreshAccountInfoAsync: {ex.Message}");
            return false;
        }
    }

    public async Task<JsonDocument?> BrowseJsonAsync(string? browseId, string? paramsValue = null, string? continuation = null)
    {
        try
        {
            var req = new HttpRequestMessage(HttpMethod.Post, "https://music.youtube.com/youtubei/v1/browse?prettyPrint=false");
            ApplyHeaders(req);

            var clientDict = new Dictionary<string, object?>
            {
                ["clientName"] = "WEB_REMIX",
                ["clientVersion"] = "1.20260114.01.00",
                ["hl"] = "en",
                ["gl"] = "US"
            };

            if (!string.IsNullOrEmpty(_session.VisitorData))
            {
                clientDict["visitorData"] = _session.VisitorData;
            }

            var contextBody = new Dictionary<string, object>
            {
                ["context"] = new Dictionary<string, object?>
                {
                    ["client"] = clientDict,
                    ["user"] = new Dictionary<string, object?>
                    {
                        ["onBehalfOfUser"] = _session.DataSyncId
                    }
                }
            };

            if (!string.IsNullOrEmpty(browseId))
            {
                contextBody["browseId"] = browseId;
            }

            if (!string.IsNullOrEmpty(paramsValue))
            {
                contextBody["params"] = paramsValue;
            }

            if (!string.IsNullOrEmpty(continuation))
            {
                contextBody["continuation"] = continuation;
            }

            req.Content = new StringContent(JsonSerializer.Serialize(contextBody), Encoding.UTF8, "application/json");

            var res = await _httpClient.SendAsync(req);
            if (!res.IsSuccessStatusCode)
            {
                System.Diagnostics.Debug.WriteLine($"Browse {browseId ?? continuation} returned status: {res.StatusCode}");
                return null;
            }

            var json = await res.Content.ReadAsStringAsync();
            return JsonDocument.Parse(json);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error browsing {browseId ?? continuation}: {ex.Message}");
            return null;
        }
    }

    public async Task<HomeFeedDto?> GetHomeFeedAsync(string? paramsValue = null, List<TrackDto>? localHistory = null)
    {
        try
        {
            var homeTask = BrowseJsonAsync("FEmusic_home", paramsValue);
            var moodsTask = string.IsNullOrEmpty(paramsValue) ? BrowseJsonAsync("FEmusic_moods_and_genres") : Task.FromResult<JsonDocument?>(null);

            await Task.WhenAll(homeTask, moodsTask);

            using var homeDoc = await homeTask;
            using var moodsDoc = await moodsTask;

            var quickPicks = new List<TrackDto>();
            var keepListening = new List<TrackDto>();
            var mixedForYou = new List<AlbumDto>();
            var albumsForYou = new List<AlbumDto>();
            var freshDrops = new List<TrackDto>();
            var freshFinds = new List<TrackDto>();
            var communityPlaylists = new List<AlbumDto>();
            var recommended = new List<TrackDto>();
            string? recommendedTitle = null;
            var trending = new List<TrackDto>();
            var popularArtists = new List<ArtistDto>();
            var popularAlbums = new List<AlbumDto>();
            var moodAndGenres = new List<MoodAndGenreItemDto>();

            // If user has local history, seed keepListening
            if (localHistory != null && localHistory.Count > 0)
            {
                keepListening.AddRange(localHistory.Take(12));
            }

            var (chips, sections, continuation) = homeDoc != null 
                ? ParseDynamicHomeFeed(homeDoc.RootElement) 
                : (new List<HomeChipDto>(), new List<HomeSectionDto>(), null);

            // Auto-fetch continuation pages so ALL shelves (15-20 shelves from YouTube Music) are fetched immediately
            int pagesFetched = 0;
            while (!string.IsNullOrEmpty(continuation) && pagesFetched < 3)
            {
                pagesFetched++;
                try
                {
                    using var contDoc = await BrowseJsonAsync(null, null, continuation);
                    if (contDoc != null)
                    {
                        var (contSections, nextCont) = ParseContinuationSections(contDoc.RootElement);
                        if (contSections.Count > 0)
                        {
                            sections.AddRange(contSections);
                        }
                        continuation = nextCont;
                        if (contSections.Count == 0) break;
                    }
                    else
                    {
                        break;
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Continuation error: {ex.Message}");
                    break;
                }
            }

            // If user is logged in, fetch their library playlists from FEmusic_liked_playlists
            if (_session.IsLoggedIn)
            {
                try
                {
                    using var likedDoc = await BrowseJsonAsync("FEmusic_liked_playlists");
                    if (likedDoc != null)
                    {
                        var userPlaylists = ParseLibraryPlaylists(likedDoc.RootElement);
                        if (userPlaylists.Count > 0)
                        {
                            communityPlaylists.AddRange(userPlaylists);
                            if (!sections.Any(s => s.Title.Contains("Your playlist", StringComparison.OrdinalIgnoreCase)))
                            {
                                sections.Insert(0, new HomeSectionDto(
                                    Title: "Your playlists",
                                    Subtitle: "From your YouTube Music library",
                                    ThumbnailUrl: null,
                                    Items: userPlaylists.Select(p => new HomeSectionItemDto(
                                        Type: "playlist",
                                        Id: p.Id,
                                        Title: p.Title,
                                        Artist: p.Artist,
                                        ThumbnailUrl: p.ThumbnailUrl,
                                        Year: "Playlist"
                                    )).ToList()
                                ));
                            }
                        }
                    }
                }
                catch { }
            }

            // Populate legacy categorization fields from dynamic sections for backwards compatibility
            foreach (var sec in sections)
            {
                var secTracks = sec.Items.Where(x => x.Type == "song")
                    .Select(x => new TrackDto(x.Id, x.Title, x.Artist, null, x.DurationSeconds, x.ThumbnailUrl))
                    .ToList();

                var secAlbums = sec.Items.Where(x => x.Type == "album" || x.Type == "playlist")
                    .Select(x => new AlbumDto(x.Id, x.Title, x.Artist, x.ThumbnailUrl, x.Year, x.Tracks ?? new List<TrackDto>()))
                    .ToList();

                var secArtists = sec.Items.Where(x => x.Type == "artist")
                    .Select(x => new ArtistDto(x.Id, x.Title, x.ThumbnailUrl, new List<TrackDto>()))
                    .ToList();

                if (sec.Title.Contains("Quick pick", StringComparison.OrdinalIgnoreCase) && quickPicks.Count == 0)
                {
                    quickPicks.AddRange(secTracks);
                }
                else if ((sec.Title.Contains("Keep listening", StringComparison.OrdinalIgnoreCase) || sec.Title.Contains("Listen again", StringComparison.OrdinalIgnoreCase)) && keepListening.Count == 0)
                {
                    keepListening.AddRange(secTracks);
                }
                else if (sec.Title.Contains("Mixed for you", StringComparison.OrdinalIgnoreCase) || sec.Title.Contains("My Mix", StringComparison.OrdinalIgnoreCase) || sec.Title.Contains("Supermix", StringComparison.OrdinalIgnoreCase))
                {
                    mixedForYou.AddRange(secAlbums);
                }
                else if (sec.Title.Contains("Albums for you", StringComparison.OrdinalIgnoreCase) || sec.Title.Contains("Recommended albums", StringComparison.OrdinalIgnoreCase))
                {
                    albumsForYou.AddRange(secAlbums);
                }
                else if (sec.Title.Contains("Fresh find", StringComparison.OrdinalIgnoreCase) || sec.Title.Contains("Fresh drop", StringComparison.OrdinalIgnoreCase) || sec.Title.Contains("Recap", StringComparison.OrdinalIgnoreCase))
                {
                    freshFinds.AddRange(secTracks);
                    freshDrops.AddRange(secTracks);
                }
                else if (sec.Title.Contains("community", StringComparison.OrdinalIgnoreCase) || sec.Title.Contains("From the", StringComparison.OrdinalIgnoreCase))
                {
                    communityPlaylists.AddRange(secAlbums);
                }
                else if (sec.Title.Contains("Trending", StringComparison.OrdinalIgnoreCase) || sec.Title.Contains("Hit", StringComparison.OrdinalIgnoreCase))
                {
                    trending.AddRange(secTracks);
                }

                if (popularArtists.Count < 8 && secArtists.Count > 0)
                {
                    popularArtists.AddRange(secArtists);
                }
                if (popularAlbums.Count < 8 && secAlbums.Count > 0)
                {
                    popularAlbums.AddRange(secAlbums);
                }
            }

            // Fallback quick picks / trending from first section if empty
            if (quickPicks.Count == 0 && sections.Count > 0)
            {
                var firstSongSec = sections.FirstOrDefault(s => s.Items.Any(i => i.Type == "song"));
                if (firstSongSec != null)
                {
                    quickPicks.AddRange(firstSongSec.Items.Where(i => i.Type == "song")
                        .Select(x => new TrackDto(x.Id, x.Title, x.Artist, null, x.DurationSeconds, x.ThumbnailUrl)));
                }
            }

            // Parse moods & genres dynamically from YouTube Music explore
            if (moodsDoc != null)
            {
                var parsedMoods = ParseMoodAndGenres(moodsDoc.RootElement);
                if (parsedMoods.Count > 0)
                {
                    moodAndGenres.AddRange(parsedMoods);
                }
            }

            if (moodAndGenres.Count == 0 && string.IsNullOrEmpty(paramsValue))
            {
                moodAndGenres.AddRange(GetDefaultMoodsAndGenres());
            }

            if (sections.Count == 0 && quickPicks.Count == 0 && trending.Count == 0 && popularArtists.Count == 0)
            {
                return null;
            }

            return new HomeFeedDto(
                TrendingSongs: trending,
                PopularArtists: popularArtists,
                PopularAlbums: popularAlbums,
                QuickPicks: quickPicks,
                Chips: chips.Count > 0 ? chips : null,
                Sections: sections.Count > 0 ? sections : null,
                Continuation: continuation,
                MixedForYou: mixedForYou,
                FreshDrops: freshDrops,
                Recommended: recommended,
                RecommendedTitle: recommendedTitle,
                KeepListening: keepListening,
                AlbumsForYou: albumsForYou,
                FreshFinds: freshFinds,
                CommunityPlaylists: communityPlaylists,
                MoodAndGenres: moodAndGenres
            );
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error fetching InnerTube home feed: {ex.Message}");
            return null;
        }
    }

    public async Task<HomeFeedDto?> GetMoodCategoryAsync(string? browseId, string? paramsValue, string? categoryTitle = null)
    {
        try
        {
            var targetBrowseId = !string.IsNullOrEmpty(browseId) ? browseId : "FEmusic_moods_and_genres_category";
            using var doc = await BrowseJsonAsync(targetBrowseId, paramsValue);
            if (doc != null)
            {
                var (chips, sections, continuation) = ParseDynamicHomeFeed(doc.RootElement);

                int pagesFetched = 0;
                while (!string.IsNullOrEmpty(continuation) && pagesFetched < 3)
                {
                    pagesFetched++;
                    try
                    {
                        using var contDoc = await BrowseJsonAsync(null, null, continuation);
                        if (contDoc != null)
                        {
                            var (contSections, nextCont) = ParseContinuationSections(contDoc.RootElement);
                            if (contSections.Count > 0)
                            {
                                sections.AddRange(contSections);
                            }
                            continuation = nextCont;
                            if (contSections.Count == 0) break;
                        }
                        else break;
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"Continuation error in mood category: {ex.Message}");
                        break;
                    }
                }

                if (sections.Count > 0)
                {
                    return new HomeFeedDto(
                        TrendingSongs: new List<TrackDto>(),
                        PopularArtists: new List<ArtistDto>(),
                        PopularAlbums: new List<AlbumDto>(),
                        QuickPicks: new List<TrackDto>(),
                        Chips: chips.Count > 0 ? chips : null,
                        Sections: sections
                    );
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error fetching mood category: {ex.Message}");
        }

        return null;
    }

    public async Task<List<MoodAndGenreItemDto>> GetExploreMoodsAsync()
    {
        var list = new List<MoodAndGenreItemDto>();
        try
        {
            using var doc = await BrowseJsonAsync("FEmusic_moods_and_genres");
            if (doc != null)
            {
                list = ParseMoodAndGenres(doc.RootElement);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error fetching explore moods: {ex.Message}");
        }

        if (list.Count == 0)
        {
            list = GetDefaultMoodsAndGenres();
        }

        return list;
    }

    private (List<HomeChipDto> chips, List<HomeSectionDto> sections, string? continuation) ParseDynamicHomeFeed(JsonElement root)
    {
        var chips = new List<HomeChipDto>();
        var sections = new List<HomeSectionDto>();
        string? continuation = null;

        if (!root.TryGetProperty("contents", out var contents) ||
            !contents.TryGetProperty("singleColumnBrowseResultsRenderer", out var singleCol) ||
            !singleCol.TryGetProperty("tabs", out var tabs) || tabs.GetArrayLength() == 0)
        {
            return (chips, sections, continuation);
        }

        var tab0 = tabs[0];
        if (!tab0.TryGetProperty("tabRenderer", out var tabRenderer) ||
            !tabRenderer.TryGetProperty("content", out var tabContent) ||
            !tabContent.TryGetProperty("sectionListRenderer", out var sectionList))
        {
            return (chips, sections, continuation);
        }

        // 1. Category Chips
        if (sectionList.TryGetProperty("header", out var header) &&
            header.TryGetProperty("chipCloudRenderer", out var chipCloud) &&
            chipCloud.TryGetProperty("chips", out var chipsArray))
        {
            foreach (var c in chipsArray.EnumerateArray())
            {
                if (c.TryGetProperty("chipCloudChipRenderer", out var cRenderer))
                {
                    string chipTitle = "";
                    string? chipParams = null;

                    if (cRenderer.TryGetProperty("text", out var tObj) &&
                        tObj.TryGetProperty("runs", out var tRuns) && tRuns.GetArrayLength() > 0)
                    {
                        chipTitle = tRuns[0].GetProperty("text").GetString() ?? "";
                    }

                    if (cRenderer.TryGetProperty("navigationEndpoint", out var nav) &&
                        nav.TryGetProperty("browseEndpoint", out var be) &&
                        be.TryGetProperty("params", out var pProp))
                    {
                        chipParams = pProp.GetString();
                    }

                    if (!string.IsNullOrEmpty(chipTitle) && !chipTitle.Contains("podcast", StringComparison.OrdinalIgnoreCase))
                    {
                        chips.Add(new HomeChipDto(chipTitle, chipParams));
                    }
                }
            }
        }

        // 2. Dynamic Shelves/Sections
        if (sectionList.TryGetProperty("contents", out var sectionContents))
        {
            foreach (var sec in sectionContents.EnumerateArray())
            {
                if (sec.TryGetProperty("musicCarouselShelfRenderer", out var shelf))
                {
                    string title = GetShelfTitle(shelf);
                    string? subtitle = GetShelfSubtitle(shelf);
                    string? thumb = GetShelfThumbnail(shelf);

                    if (shelf.TryGetProperty("contents", out var itemsArray))
                    {
                        var items = ParseShelfItemsToDto(itemsArray);
                        if (items.Count > 0 && !string.IsNullOrEmpty(title))
                        {
                            sections.Add(new HomeSectionDto(title, subtitle, thumb, items));
                        }
                    }
                }
                else if (sec.TryGetProperty("gridRenderer", out var grid))
                {
                    string title = GetGridTitle(grid);
                    if (grid.TryGetProperty("items", out var itemsArray))
                    {
                        var items = ParseShelfItemsToDto(itemsArray);
                        if (items.Count > 0 && !string.IsNullOrEmpty(title))
                        {
                            sections.Add(new HomeSectionDto(title, null, null, items));
                        }
                    }
                }
                else if (sec.TryGetProperty("musicShelfRenderer", out var musicShelf))
                {
                    string title = GetMusicShelfTitle(musicShelf);
                    if (musicShelf.TryGetProperty("contents", out var itemsArray))
                    {
                        var items = ParseShelfItemsToDto(itemsArray);
                        if (items.Count > 0 && !string.IsNullOrEmpty(title))
                        {
                            sections.Add(new HomeSectionDto(title, null, null, items));
                        }
                    }
                }
            }
        }

        // 3. Continuation
        if (sectionList.TryGetProperty("continuations", out var continuations) && continuations.GetArrayLength() > 0)
        {
            var c0 = continuations[0];
            if (c0.TryGetProperty("nextContinuationData", out var ncd) &&
                ncd.TryGetProperty("continuation", out var contProp))
            {
                continuation = contProp.GetString();
            }
            else if (c0.TryGetProperty("reloadContinuationData", out var rcd) &&
                     rcd.TryGetProperty("continuation", out var rcontProp))
            {
                continuation = rcontProp.GetString();
            }
        }

        return (chips, sections, continuation);
    }

    private (List<HomeSectionDto> sections, string? continuation) ParseContinuationSections(JsonElement root)
    {
        var sections = new List<HomeSectionDto>();
        string? nextContinuation = null;

        if (root.TryGetProperty("continuationContents", out var cc) &&
            cc.TryGetProperty("sectionListContinuation", out var slc))
        {
            if (slc.TryGetProperty("contents", out var contContents))
            {
                foreach (var sec in contContents.EnumerateArray())
                {
                    if (sec.TryGetProperty("musicCarouselShelfRenderer", out var shelf))
                    {
                        string title = GetShelfTitle(shelf);
                        string? subtitle = GetShelfSubtitle(shelf);
                        string? thumb = GetShelfThumbnail(shelf);

                        if (shelf.TryGetProperty("contents", out var itemsArray))
                        {
                            var items = ParseShelfItemsToDto(itemsArray);
                            if (items.Count > 0 && !string.IsNullOrEmpty(title))
                            {
                                sections.Add(new HomeSectionDto(title, subtitle, thumb, items));
                            }
                        }
                    }
                    else if (sec.TryGetProperty("gridRenderer", out var grid))
                    {
                        string title = GetGridTitle(grid);
                        if (grid.TryGetProperty("items", out var itemsArray))
                        {
                            var items = ParseShelfItemsToDto(itemsArray);
                            if (items.Count > 0 && !string.IsNullOrEmpty(title))
                            {
                                sections.Add(new HomeSectionDto(title, null, null, items));
                            }
                        }
                    }
                    else if (sec.TryGetProperty("musicShelfRenderer", out var musicShelf))
                    {
                        string title = GetMusicShelfTitle(musicShelf);
                        if (musicShelf.TryGetProperty("contents", out var itemsArray))
                        {
                            var items = ParseShelfItemsToDto(itemsArray);
                            if (items.Count > 0 && !string.IsNullOrEmpty(title))
                            {
                                sections.Add(new HomeSectionDto(title, null, null, items));
                            }
                        }
                    }
                }
            }

            if (slc.TryGetProperty("continuations", out var continuations) && continuations.GetArrayLength() > 0)
            {
                var c0 = continuations[0];
                if (c0.TryGetProperty("nextContinuationData", out var ncd) &&
                    ncd.TryGetProperty("continuation", out var contProp))
                {
                    nextContinuation = contProp.GetString();
                }
            }
        }

        return (sections, nextContinuation);
    }

    private static List<AlbumDto> ParseLibraryPlaylists(JsonElement root)
    {
        var list = new List<AlbumDto>();
        try
        {
            if (root.TryGetProperty("contents", out var contents) &&
                contents.TryGetProperty("singleColumnBrowseResultsRenderer", out var sc) &&
                sc.TryGetProperty("tabs", out var tabs) && tabs.GetArrayLength() > 0)
            {
                var tab0 = tabs[0];
                if (tab0.TryGetProperty("tabRenderer", out var tr) &&
                    tr.TryGetProperty("content", out var tc) &&
                    tc.TryGetProperty("sectionListRenderer", out var sl) &&
                    sl.TryGetProperty("contents", out var secArr))
                {
                    foreach (var sec in secArr.EnumerateArray())
                    {
                        if (sec.TryGetProperty("gridRenderer", out var grid) &&
                            grid.TryGetProperty("items", out var gItems))
                        {
                            var tempTracks = new List<TrackDto>();
                            var tempArtists = new List<ArtistDto>();
                            var tempAlbums = new List<AlbumDto>();
                            ParseShelfItems(gItems, tempTracks, tempArtists, tempAlbums);
                            list.AddRange(tempAlbums);
                        }
                    }
                }
            }
        }
        catch { }

        return list;
    }

    private static void ParseShelfItems(
        JsonElement itemsArray,
        List<TrackDto> tracks,
        List<ArtistDto> artists,
        List<AlbumDto> albums)
    {
        if (itemsArray.ValueKind != JsonValueKind.Array) return;
        foreach (var item in itemsArray.EnumerateArray())
        {
            try
            {
                if (item.TryGetProperty("musicTwoRowItemRenderer", out var twoRow))
                {
                    ParseTwoRowItem(twoRow, tracks, artists, albums);
                }
            }
            catch { }
        }
    }

    private static List<HomeSectionItemDto> ParseShelfItemsToDto(JsonElement itemsArray)
    {
        var list = new List<HomeSectionItemDto>();
        if (itemsArray.ValueKind != JsonValueKind.Array) return list;

        foreach (var item in itemsArray.EnumerateArray())
        {
            try
            {
                if (item.TryGetProperty("musicTwoRowItemRenderer", out var twoRow))
                {
                    var dto = ParseTwoRowItemToDto(twoRow);
                    if (dto != null) list.Add(dto);
                }
                else if (item.TryGetProperty("musicResponsiveListItemRenderer", out var resp))
                {
                    var tr = ParseResponsiveTrackItem(resp);
                    if (tr != null)
                    {
                        list.Add(new HomeSectionItemDto(
                            Type: "song",
                            Id: tr.Id,
                            Title: tr.Title,
                            Artist: tr.Artist,
                            ThumbnailUrl: tr.ThumbnailUrl,
                            Year: null,
                            DurationSeconds: tr.DurationSeconds,
                            Tracks: new List<TrackDto> { tr }
                        ));
                    }
                }
            }
            catch { }
        }

        return list;
    }

    private static HomeSectionItemDto? ParseTwoRowItemToDto(JsonElement twoRow)
    {
        string title = "";
        string subtitle = "";
        string thumb = "";

        if (twoRow.TryGetProperty("title", out var tObj) &&
            tObj.TryGetProperty("runs", out var tRuns) && tRuns.GetArrayLength() > 0)
        {
            title = tRuns[0].GetProperty("text").GetString() ?? "";
        }

        if (twoRow.TryGetProperty("subtitle", out var sObj) &&
            sObj.TryGetProperty("runs", out var sRuns) && sRuns.GetArrayLength() > 0)
        {
            subtitle = string.Join(" ", sRuns.EnumerateArray().Select(r => r.TryGetProperty("text", out var tp) ? tp.GetString() : ""));
        }

        if (twoRow.TryGetProperty("thumbnailRenderer", out var tr) &&
            tr.TryGetProperty("musicThumbnailRenderer", out var mtr) &&
            mtr.TryGetProperty("thumbnail", out var tn) &&
            tn.TryGetProperty("thumbnails", out var thumbs) && thumbs.GetArrayLength() > 0)
        {
            thumb = thumbs[thumbs.GetArrayLength() - 1].GetProperty("url").GetString() ?? "";
        }

        if (string.IsNullOrEmpty(thumb) &&
            twoRow.TryGetProperty("thumbnail", out var tDirect) &&
            tDirect.TryGetProperty("musicThumbnailRenderer", out var mtr2) &&
            mtr2.TryGetProperty("thumbnail", out var tn2) &&
            tn2.TryGetProperty("thumbnails", out var thumbs2) && thumbs2.GetArrayLength() > 0)
        {
            thumb = thumbs2[thumbs2.GetArrayLength() - 1].GetProperty("url").GetString() ?? "";
        }

        if (thumb.StartsWith("//")) thumb = "https:" + thumb;
        if (string.IsNullOrEmpty(title)) return null;

        // Detect navigation endpoint type
        if (twoRow.TryGetProperty("navigationEndpoint", out var nav))
        {
            // 1. BrowseEndpoint (Artist, Album, or Playlist/Mix)
            if (nav.TryGetProperty("browseEndpoint", out var browse))
            {
                var browseId = browse.TryGetProperty("browseId", out var bIdProp) ? bIdProp.GetString() ?? "" : "";
                string pageType = "";

                if (browse.TryGetProperty("browseEndpointContextSupportedConfigs", out var configs) &&
                    configs.TryGetProperty("browseEndpointContextMusicConfig", out var musicConfig) &&
                    musicConfig.TryGetProperty("pageType", out var ptProp))
                {
                    pageType = ptProp.GetString() ?? "";
                }

                if (!string.IsNullOrEmpty(browseId))
                {
                    if (pageType == "MUSIC_PAGE_TYPE_ARTIST" || browseId.StartsWith("UC") || browseId.StartsWith("FEmusic_library_artist"))
                    {
                        return new HomeSectionItemDto(
                            Type: "artist",
                            Id: browseId,
                            Title: title,
                            Artist: "Artist",
                            ThumbnailUrl: !string.IsNullOrEmpty(thumb) ? thumb : "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop"
                        );
                    }

                    if (pageType == "MUSIC_PAGE_TYPE_PLAYLIST" || browseId.StartsWith("VL") || browseId.StartsWith("PL") || browseId.StartsWith("RD") || browseId.StartsWith("FEmusic_library_playlist"))
                    {
                        var cleanId = browseId.StartsWith("VL") ? browseId.Substring(2) : browseId;
                        return new HomeSectionItemDto(
                            Type: "playlist",
                            Id: cleanId,
                            Title: title,
                            Artist: !string.IsNullOrEmpty(subtitle) ? subtitle : "YouTube Music",
                            ThumbnailUrl: !string.IsNullOrEmpty(thumb) ? thumb : "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
                            Year: title.Contains("Mix", StringComparison.OrdinalIgnoreCase) ? "Mix" : "Playlist"
                        );
                    }

                    // Album default for browse endpoints
                    return new HomeSectionItemDto(
                        Type: "album",
                        Id: browseId,
                        Title: title,
                        Artist: !string.IsNullOrEmpty(subtitle) ? subtitle : "Various Artists",
                        ThumbnailUrl: !string.IsNullOrEmpty(thumb) ? thumb : "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
                        Year: "Album"
                    );
                }
            }

            // 2. WatchPlaylistEndpoint
            if (nav.TryGetProperty("watchPlaylistEndpoint", out var wp) &&
                wp.TryGetProperty("playlistId", out var wpId) &&
                !string.IsNullOrEmpty(wpId.GetString()))
            {
                var plId = wpId.GetString()!;
                return new HomeSectionItemDto(
                    Type: "playlist",
                    Id: plId,
                    Title: title,
                    Artist: !string.IsNullOrEmpty(subtitle) ? subtitle : "YouTube Music",
                    ThumbnailUrl: !string.IsNullOrEmpty(thumb) ? thumb : "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
                    Year: title.Contains("Mix", StringComparison.OrdinalIgnoreCase) ? "Mix" : "Playlist"
                );
            }

            // 3. WatchEndpoint (could be song, single, or playlist/radio)
            if (nav.TryGetProperty("watchEndpoint", out var watch))
            {
                var watchPlId = watch.TryGetProperty("playlistId", out var wpidProp) ? wpidProp.GetString() : null;
                var watchVid = watch.TryGetProperty("videoId", out var wvidProp) ? wvidProp.GetString() : null;

                if (!string.IsNullOrEmpty(watchPlId) && (watchPlId.StartsWith("RD") || watchPlId.StartsWith("PL") || watchPlId.StartsWith("OLAK")))
                {
                    return new HomeSectionItemDto(
                        Type: "playlist",
                        Id: watchPlId,
                        Title: title,
                        Artist: !string.IsNullOrEmpty(subtitle) ? subtitle : "YouTube Music",
                        ThumbnailUrl: !string.IsNullOrEmpty(thumb) ? thumb : (watchVid != null ? $"https://i.ytimg.com/vi/{watchVid}/hqdefault.jpg" : "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop"),
                        Year: "Playlist"
                    );
                }

                if (!string.IsNullOrEmpty(watchVid))
                {
                    var trItem = new TrackDto(
                        Id: watchVid,
                        Title: title,
                        Artist: !string.IsNullOrEmpty(subtitle) ? subtitle : "Various Artists",
                        Album: null,
                        DurationSeconds: 210,
                        ThumbnailUrl: !string.IsNullOrEmpty(thumb) ? thumb : $"https://i.ytimg.com/vi/{watchVid}/hqdefault.jpg"
                    );
                    return new HomeSectionItemDto(
                        Type: "song",
                        Id: watchVid,
                        Title: title,
                        Artist: !string.IsNullOrEmpty(subtitle) ? subtitle : "Various Artists",
                        ThumbnailUrl: !string.IsNullOrEmpty(thumb) ? thumb : $"https://i.ytimg.com/vi/{watchVid}/hqdefault.jpg",
                        Year: null,
                        DurationSeconds: 210,
                        Tracks: new List<TrackDto> { trItem }
                    );
                }
            }
        }

        // Subtitle inference fallback
        if (subtitle.Contains("Artist", StringComparison.OrdinalIgnoreCase))
        {
            return new HomeSectionItemDto(
                Type: "artist",
                Id: title.ToLowerInvariant().Replace(" ", "_"),
                Title: title,
                Artist: "Artist",
                ThumbnailUrl: !string.IsNullOrEmpty(thumb) ? thumb : "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop"
            );
        }

        return new HomeSectionItemDto(
            Type: title.Contains("Mix", StringComparison.OrdinalIgnoreCase) ? "playlist" : "album",
            Id: title.ToLowerInvariant().Replace(" ", "_"),
            Title: title,
            Artist: !string.IsNullOrEmpty(subtitle) ? subtitle : "Various Artists",
            ThumbnailUrl: !string.IsNullOrEmpty(thumb) ? thumb : "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
            Year: title.Contains("Mix", StringComparison.OrdinalIgnoreCase) ? "Mix" : "Album"
        );
    }

    private static string? GetShelfSubtitle(JsonElement shelf)
    {
        if (shelf.TryGetProperty("header", out var header))
        {
            if (header.TryGetProperty("musicCarouselShelfBasicHeaderRenderer", out var basicHeader) &&
                basicHeader.TryGetProperty("strapline", out var stObj) &&
                stObj.TryGetProperty("runs", out var runs) && runs.GetArrayLength() > 0)
            {
                return runs[0].GetProperty("text").GetString();
            }
        }
        return null;
    }

    private static string? GetShelfThumbnail(JsonElement shelf)
    {
        if (shelf.TryGetProperty("header", out var header))
        {
            if (header.TryGetProperty("musicCarouselShelfBasicHeaderRenderer", out var basicHeader) &&
                basicHeader.TryGetProperty("thumbnail", out var thObj) &&
                thObj.TryGetProperty("musicThumbnailRenderer", out var mtr) &&
                mtr.TryGetProperty("thumbnail", out var tn) &&
                tn.TryGetProperty("thumbnails", out var thumbs) && thumbs.GetArrayLength() > 0)
            {
                var url = thumbs[thumbs.GetArrayLength() - 1].GetProperty("url").GetString();
                if (url != null && url.StartsWith("//")) url = "https:" + url;
                return url;
            }
        }
        return null;
    }

    private static List<MoodAndGenreItemDto> ParseMoodAndGenres(JsonElement root)
    {
        var list = new List<MoodAndGenreItemDto>();
        try
        {
            if (root.TryGetProperty("contents", out var contents) &&
                contents.TryGetProperty("singleColumnBrowseResultsRenderer", out var sc) &&
                sc.TryGetProperty("tabs", out var tabs) && tabs.GetArrayLength() > 0)
            {
                var tab0 = tabs[0];
                if (tab0.TryGetProperty("tabRenderer", out var tr) &&
                    tr.TryGetProperty("content", out var tabC) &&
                    tabC.TryGetProperty("sectionListRenderer", out var sl) &&
                    sl.TryGetProperty("contents", out var sections))
                {
                    foreach (var sec in sections.EnumerateArray())
                    {
                        if (sec.TryGetProperty("gridRenderer", out var grid) &&
                            grid.TryGetProperty("items", out var items))
                        {
                            foreach (var item in items.EnumerateArray())
                            {
                                if (item.TryGetProperty("musicNavigationButtonRenderer", out var navBtn))
                                {
                                    string title = "";
                                    string? paramsVal = null;
                                    string? browseId = null;
                                    string stripeColor = "#3d91f4";

                                    if (navBtn.TryGetProperty("buttonText", out var btObj) &&
                                        btObj.TryGetProperty("runs", out var runs) && runs.GetArrayLength() > 0)
                                    {
                                        title = runs[0].GetProperty("text").GetString() ?? "";
                                    }

                                    if (navBtn.TryGetProperty("solid", out var solid) &&
                                        solid.TryGetProperty("leftStripeColor", out var colProp))
                                    {
                                        if (colProp.ValueKind == JsonValueKind.Number)
                                        {
                                            long col = colProp.GetInt64();
                                            stripeColor = $"#{(col & 0xFFFFFF):X6}";
                                        }
                                    }

                                    if (navBtn.TryGetProperty("clickCommand", out var cc) &&
                                        cc.TryGetProperty("browseEndpoint", out var be))
                                    {
                                        if (be.TryGetProperty("params", out var pProp)) paramsVal = pProp.GetString();
                                        if (be.TryGetProperty("browseId", out var bProp)) browseId = bProp.GetString();
                                    }

                                    if (!string.IsNullOrEmpty(title))
                                    {
                                        list.Add(new MoodAndGenreItemDto(
                                            Title: title,
                                            StripeColor: stripeColor,
                                            Params: paramsVal,
                                            BrowseId: browseId
                                        ));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        catch { }

        return list;
    }

    private static List<MoodAndGenreItemDto> GetDefaultMoodsAndGenres()
    {
        return new List<MoodAndGenreItemDto>
        {
            new("Chill", "#4CAF50", "ggMGCgQIgAQ%3D", "FEmusic_moods_and_genres"),
            new("Energy Boosters", "#FF9800", "ggMGCgQIgAQ%3D", "FEmusic_moods_and_genres"),
            new("Workout", "#E91E63", "ggMGCgQIgAQ%3D", "FEmusic_moods_and_genres"),
            new("Focus", "#2196F3", "ggMGCgQIgAQ%3D", "FEmusic_moods_and_genres"),
            new("Party", "#9C27B0", "ggMGCgQIgAQ%3D", "FEmusic_moods_and_genres"),
            new("Romance", "#F06292", "ggMGCgQIgAQ%3D", "FEmusic_moods_and_genres"),
            new("Sleep", "#3F51B5", "ggMGCgQIgAQ%3D", "FEmusic_moods_and_genres"),
            new("Commute", "#00BCD4", "ggMGCgQIgAQ%3D", "FEmusic_moods_and_genres"),
            new("Pop", "#00E676", "ggMGCgQIgAQ%3D", "FEmusic_moods_and_genres"),
            new("Hip-Hop", "#FF5722", "ggMGCgQIgAQ%3D", "FEmusic_moods_and_genres"),
            new("Rock", "#F44336", "ggMGCgQIgAQ%3D", "FEmusic_moods_and_genres"),
            new("R&B", "#673AB7", "ggMGCgQIgAQ%3D", "FEmusic_moods_and_genres"),
            new("Dance & Electronic", "#00E5FF", "ggMGCgQIgAQ%3D", "FEmusic_moods_and_genres"),
            new("Indie & Alternative", "#8BC34A", "ggMGCgQIgAQ%3D", "FEmusic_moods_and_genres"),
            new("Metal", "#607D8B", "ggMGCgQIgAQ%3D", "FEmusic_moods_and_genres"),
            new("Classical", "#795548", "ggMGCgQIgAQ%3D", "FEmusic_moods_and_genres"),
            new("Jazz", "#FFC107", "ggMGCgQIgAQ%3D", "FEmusic_moods_and_genres"),
            new("K-Pop", "#FF4081", "ggMGCgQIgAQ%3D", "FEmusic_moods_and_genres")
        };
    }

    private static (List<TrackDto> tracks, List<ArtistDto> artists, List<AlbumDto> albums) ParseItemsFromShelf(JsonElement items)
    {
        var tracks = new List<TrackDto>();
        var artists = new List<ArtistDto>();
        var albums = new List<AlbumDto>();

        if (items.ValueKind != JsonValueKind.Array) return (tracks, artists, albums);

        foreach (var item in items.EnumerateArray())
        {
            try
            {
                // Case 1: musicTwoRowItemRenderer
                if (item.TryGetProperty("musicTwoRowItemRenderer", out var twoRow))
                {
                    ParseTwoRowItem(twoRow, tracks, artists, albums);
                }
                // Case 2: musicResponsiveListItemRenderer
                else if (item.TryGetProperty("musicResponsiveListItemRenderer", out var resp))
                {
                    var track = ParseResponsiveTrackItem(resp);
                    if (track != null) tracks.Add(track);
                }
            }
            catch { }
        }

        return (tracks, artists, albums);
    }

    private static void ParseTwoRowItem(
        JsonElement twoRow,
        List<TrackDto> tracks,
        List<ArtistDto> artists,
        List<AlbumDto> albums)
    {
        string title = "";
        string subtitle = "";
        string thumb = "";

        if (twoRow.TryGetProperty("title", out var tObj) &&
            tObj.TryGetProperty("runs", out var tRuns) && tRuns.GetArrayLength() > 0)
        {
            title = tRuns[0].GetProperty("text").GetString() ?? "";
        }

        if (twoRow.TryGetProperty("subtitle", out var sObj) &&
            sObj.TryGetProperty("runs", out var sRuns) && sRuns.GetArrayLength() > 0)
        {
            subtitle = string.Join(" ", sRuns.EnumerateArray().Select(r => r.TryGetProperty("text", out var tp) ? tp.GetString() : ""));
        }

        if (twoRow.TryGetProperty("thumbnailRenderer", out var tr) &&
            tr.TryGetProperty("musicThumbnailRenderer", out var mtr) &&
            mtr.TryGetProperty("thumbnail", out var tn) &&
            tn.TryGetProperty("thumbnails", out var thumbs) && thumbs.GetArrayLength() > 0)
        {
            thumb = thumbs[thumbs.GetArrayLength() - 1].GetProperty("url").GetString() ?? "";
        }

        if (string.IsNullOrEmpty(thumb) &&
            twoRow.TryGetProperty("thumbnail", out var tDirect) &&
            tDirect.TryGetProperty("musicThumbnailRenderer", out var mtr2) &&
            mtr2.TryGetProperty("thumbnail", out var tn2) &&
            tn2.TryGetProperty("thumbnails", out var thumbs2) && thumbs2.GetArrayLength() > 0)
        {
            thumb = thumbs2[thumbs2.GetArrayLength() - 1].GetProperty("url").GetString() ?? "";
        }

        if (thumb.StartsWith("//")) thumb = "https:" + thumb;

        // Navigation Endpoint analysis (Identical to Ragam APK MusicTwoRowItemRenderer)
        if (twoRow.TryGetProperty("navigationEndpoint", out var nav))
        {
            // A: WatchEndpoint -> Song
            if (nav.TryGetProperty("watchEndpoint", out var watch) &&
                watch.TryGetProperty("videoId", out var vidProp) &&
                !string.IsNullOrEmpty(vidProp.GetString()))
            {
                var videoId = vidProp.GetString()!;
                if (!string.IsNullOrEmpty(title))
                {
                    tracks.Add(new TrackDto(
                        Id: videoId,
                        Title: title,
                        Artist: !string.IsNullOrEmpty(subtitle) ? subtitle : "Various Artists",
                        Album: null,
                        DurationSeconds: 210,
                        ThumbnailUrl: !string.IsNullOrEmpty(thumb) ? thumb : $"https://i.ytimg.com/vi/{videoId}/hqdefault.jpg"
                    ));
                }
                return;
            }

            // B: BrowseEndpoint -> Artist, Album, or Playlist
            if (nav.TryGetProperty("browseEndpoint", out var browse))
            {
                var browseId = browse.TryGetProperty("browseId", out var bIdProp) ? bIdProp.GetString() ?? "" : "";
                string pageType = "";

                if (browse.TryGetProperty("browseEndpointContextSupportedConfigs", out var configs) &&
                    configs.TryGetProperty("browseEndpointContextMusicConfig", out var musicConfig) &&
                    musicConfig.TryGetProperty("pageType", out var ptProp))
                {
                    pageType = ptProp.GetString() ?? "";
                }

                // Is Artist:
                if (pageType == "MUSIC_PAGE_TYPE_ARTIST" || browseId.StartsWith("UC") || browseId.StartsWith("FEmusic_library_artist"))
                {
                    if (!string.IsNullOrEmpty(title))
                    {
                        artists.Add(new ArtistDto(
                            Id: !string.IsNullOrEmpty(browseId) ? browseId : title.ToLowerInvariant().Replace(" ", "_"),
                            Name: title,
                            ThumbnailUrl: !string.IsNullOrEmpty(thumb) ? thumb : "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop",
                            TopTracks: new List<TrackDto>()
                        ));
                    }
                    return;
                }

                // Is Album:
                if (pageType == "MUSIC_PAGE_TYPE_ALBUM" || pageType == "MUSIC_PAGE_TYPE_AUDIOBOOK" || browseId.StartsWith("MPREb_") || browseId.StartsWith("FEmusic_library_album"))
                {
                    if (!string.IsNullOrEmpty(title))
                    {
                        albums.Add(new AlbumDto(
                            Id: !string.IsNullOrEmpty(browseId) ? browseId : Guid.NewGuid().ToString("N"),
                            Title: title,
                            Artist: !string.IsNullOrEmpty(subtitle) ? subtitle : "Various Artists",
                            ThumbnailUrl: !string.IsNullOrEmpty(thumb) ? thumb : "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
                            Year: "Album",
                            Tracks: new List<TrackDto>()
                        ));
                    }
                    return;
                }

                // Is Playlist / Mix:
                if (pageType == "MUSIC_PAGE_TYPE_PLAYLIST" || browseId.StartsWith("VL") || browseId.StartsWith("PL") || browseId.StartsWith("RD") || browseId.StartsWith("FEmusic_library_playlist"))
                {
                    var cleanId = browseId.StartsWith("VL") ? browseId.Substring(2) : browseId;
                    if (!string.IsNullOrEmpty(title))
                    {
                        albums.Add(new AlbumDto(
                            Id: !string.IsNullOrEmpty(cleanId) ? cleanId : Guid.NewGuid().ToString("N"),
                            Title: title,
                            Artist: !string.IsNullOrEmpty(subtitle) ? subtitle : "YouTube Music",
                            ThumbnailUrl: !string.IsNullOrEmpty(thumb) ? thumb : "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
                            Year: "Playlist / Mix",
                            Tracks: new List<TrackDto>()
                        ));
                    }
                    return;
                }
            }
        }

        // Fallback categorization based on title/subtitle if navigationEndpoint was generic
        if (!string.IsNullOrEmpty(title))
        {
            if (subtitle.Contains("Artist", StringComparison.OrdinalIgnoreCase))
            {
                artists.Add(new ArtistDto(
                    Id: title.ToLowerInvariant().Replace(" ", "_"),
                    Name: title,
                    ThumbnailUrl: !string.IsNullOrEmpty(thumb) ? thumb : "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop",
                    TopTracks: new List<TrackDto>()
                ));
            }
            else
            {
                albums.Add(new AlbumDto(
                    Id: Guid.NewGuid().ToString("N"),
                    Title: title,
                    Artist: !string.IsNullOrEmpty(subtitle) ? subtitle : "Various Artists",
                    ThumbnailUrl: !string.IsNullOrEmpty(thumb) ? thumb : "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
                    Year: "Album / Playlist",
                    Tracks: new List<TrackDto>()
                ));
            }
        }
    }

    private static TrackDto? ParseResponsiveTrackItem(JsonElement responsive)
    {
        string? videoId = null;
        string title = "";
        string artist = "Unknown Artist";
        string thumb = "";

        if (responsive.TryGetProperty("playlistItemData", out var pidObj) &&
            pidObj.TryGetProperty("videoId", out var vidP))
        {
            videoId = vidP.GetString();
        }

        if (responsive.TryGetProperty("flexColumns", out var flexCols) && flexCols.GetArrayLength() > 0)
        {
            var col0 = flexCols[0];
            if (col0.TryGetProperty("musicResponsiveListItemFlexColumnRenderer", out var fc0) &&
                fc0.TryGetProperty("text", out var t0) &&
                t0.TryGetProperty("runs", out var runs0) && runs0.GetArrayLength() > 0)
            {
                title = runs0[0].GetProperty("text").GetString() ?? "";
                if (string.IsNullOrEmpty(videoId) &&
                    runs0[0].TryGetProperty("navigationEndpoint", out var nav) &&
                    nav.TryGetProperty("watchEndpoint", out var watch) &&
                    watch.TryGetProperty("videoId", out var vidProp))
                {
                    videoId = vidProp.GetString();
                }
            }

            if (flexCols.GetArrayLength() > 1)
            {
                var col1 = flexCols[1];
                if (col1.TryGetProperty("musicResponsiveListItemFlexColumnRenderer", out var fc1) &&
                    fc1.TryGetProperty("text", out var t1) &&
                    t1.TryGetProperty("runs", out var runs1) && runs1.GetArrayLength() > 0)
                {
                    artist = runs1[0].GetProperty("text").GetString() ?? "Unknown Artist";
                }
            }
        }

        if (responsive.TryGetProperty("thumbnail", out var thumbObj) &&
            thumbObj.TryGetProperty("musicThumbnailRenderer", out var mtr) &&
            mtr.TryGetProperty("thumbnail", out var tObj) &&
            tObj.TryGetProperty("thumbnails", out var thumbs) && thumbs.GetArrayLength() > 0)
        {
            thumb = thumbs[thumbs.GetArrayLength() - 1].GetProperty("url").GetString() ?? "";
        }

        if (thumb.StartsWith("//")) thumb = "https:" + thumb;

        if (!string.IsNullOrEmpty(videoId) && !string.IsNullOrEmpty(title))
        {
            return new TrackDto(
                Id: videoId,
                Title: title,
                Artist: artist,
                Album: null,
                DurationSeconds: 210,
                ThumbnailUrl: !string.IsNullOrEmpty(thumb) ? thumb : $"https://i.ytimg.com/vi/{videoId}/hqdefault.jpg"
            );
        }

        return null;
    }

    public async Task<ArtistDto?> GetArtistDetailsAsync(string artistName, string thumbnailUrl, string? artistId = null)
    {
        try
        {
            if (!string.IsNullOrEmpty(artistId) && (artistId.StartsWith("UC") || artistId.StartsWith("FEmusic_library_artist")))
            {
                using var doc = await BrowseJsonAsync(artistId);
                if (doc != null)
                {
                    var root = doc.RootElement;
                    var tracks = new List<TrackDto>();
                    string? highResThumb = null;

                    // Extract high-res artist visual header
                    if (root.TryGetProperty("header", out var header))
                    {
                        if (header.TryGetProperty("musicImmersiveHeaderRenderer", out var immHeader))
                        {
                            if (immHeader.TryGetProperty("thumbnail", out var mtr) &&
                                mtr.TryGetProperty("musicThumbnailRenderer", out var mtrObj) &&
                                mtrObj.TryGetProperty("thumbnail", out var tn) &&
                                tn.TryGetProperty("thumbnails", out var thumbs) && thumbs.GetArrayLength() > 0)
                            {
                                highResThumb = thumbs[thumbs.GetArrayLength() - 1].GetProperty("url").GetString();
                            }
                        }
                        else if (header.TryGetProperty("musicVisualHeaderRenderer", out var visHeader))
                        {
                            if (visHeader.TryGetProperty("foregroundThumbnail", out var mtr) &&
                                mtr.TryGetProperty("musicThumbnailRenderer", out var mtrObj) &&
                                mtrObj.TryGetProperty("thumbnail", out var tn) &&
                                tn.TryGetProperty("thumbnails", out var thumbs) && thumbs.GetArrayLength() > 0)
                            {
                                highResThumb = thumbs[thumbs.GetArrayLength() - 1].GetProperty("url").GetString();
                            }
                        }
                    }

                    // Extract songs shelf
                    if (root.TryGetProperty("contents", out var contents) &&
                        contents.TryGetProperty("singleColumnBrowseResultsRenderer", out var sc) &&
                        sc.TryGetProperty("tabs", out var tabs) && tabs.GetArrayLength() > 0)
                    {
                        var tab0 = tabs[0];
                        if (tab0.TryGetProperty("tabRenderer", out var tr) &&
                            tr.TryGetProperty("content", out var tabC) &&
                            tabC.TryGetProperty("sectionListRenderer", out var sl) &&
                            sl.TryGetProperty("contents", out var sections))
                        {
                            foreach (var sec in sections.EnumerateArray())
                            {
                                if (sec.TryGetProperty("musicShelfRenderer", out var ms) &&
                                    ms.TryGetProperty("contents", out var msItems))
                                {
                                    foreach (var item in msItems.EnumerateArray())
                                    {
                                        if (item.TryGetProperty("musicResponsiveListItemRenderer", out var resp))
                                        {
                                            var t = ParseResponsiveTrackItem(resp);
                                            if (t != null) tracks.Add(t);
                                        }
                                    }
                                }
                                else if (sec.TryGetProperty("musicCarouselShelfRenderer", out var cs))
                                {
                                    string title = GetShelfTitle(cs);
                                    if (title.Contains("Song", StringComparison.OrdinalIgnoreCase) || title.Contains("Top", StringComparison.OrdinalIgnoreCase))
                                    {
                                        if (cs.TryGetProperty("contents", out var csItems))
                                        {
                                            foreach (var item in csItems.EnumerateArray())
                                            {
                                                if (item.TryGetProperty("musicResponsiveListItemRenderer", out var resp))
                                                {
                                                    var t = ParseResponsiveTrackItem(resp);
                                                    if (t != null) tracks.Add(t);
                                                }
                                                else if (item.TryGetProperty("musicTwoRowItemRenderer", out var twoRow))
                                                {
                                                    var tempTracks = new List<TrackDto>();
                                                    ParseTwoRowItem(twoRow, tempTracks, new List<ArtistDto>(), new List<AlbumDto>());
                                                    tracks.AddRange(tempTracks);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (tracks.Count > 0)
                    {
                        return new ArtistDto(
                            Id: artistId,
                            Name: artistName,
                            ThumbnailUrl: !string.IsNullOrEmpty(highResThumb) ? highResThumb : thumbnailUrl,
                            TopTracks: tracks
                        );
                    }
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error fetching InnerTube artist details: {ex.Message}");
        }

        return null;
    }

    public async Task<AlbumDto?> GetAlbumOrPlaylistAsync(string title, string artist, string thumbnailUrl, string? playlistId = null)
    {
        try
        {
            var tracks = new List<TrackDto>();
            string? highResThumb = null;

            if (!string.IsNullOrEmpty(playlistId))
            {
                var browseId = playlistId.StartsWith("VL") || playlistId.StartsWith("MPREb_") || playlistId.StartsWith("FEmusic_")
                    ? playlistId
                    : (playlistId.StartsWith("PL") || playlistId.StartsWith("RD") || playlistId.StartsWith("OLAK") ? $"VL{playlistId}" : playlistId);

                using var doc = await BrowseJsonAsync(browseId);
                if (doc != null)
                {
                    ExtractResponsiveTracks(doc.RootElement, tracks);
                }

                // If browse was empty and playlistId is a direct 11-char video ID (Single)
                if (tracks.Count == 0 && playlistId.Length == 11 && !playlistId.StartsWith("PL") && !playlistId.StartsWith("VL") && !playlistId.StartsWith("MP"))
                {
                    tracks.Add(new TrackDto(
                        Id: playlistId,
                        Title: title,
                        Artist: artist,
                        Album: title,
                        DurationSeconds: 210,
                        ThumbnailUrl: thumbnailUrl
                    ));
                }
            }

            if (tracks.Count > 0)
            {
                return new AlbumDto(
                    Id: playlistId ?? Guid.NewGuid().ToString("N"),
                    Title: title,
                    Artist: artist,
                    ThumbnailUrl: !string.IsNullOrEmpty(highResThumb) ? highResThumb : thumbnailUrl,
                    Year: "Album / Single",
                    Tracks: tracks
                );
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error fetching InnerTube album/playlist: {ex.Message}");
        }

        return null;
    }

    private static void ExtractResponsiveTracks(JsonElement element, List<TrackDto> tracks)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            if (element.TryGetProperty("musicResponsiveListItemRenderer", out var resp))
            {
                var t = ParseResponsiveTrackItem(resp);
                if (t != null && !tracks.Any(existing => existing.Id == t.Id))
                {
                    tracks.Add(t);
                }
            }
            else
            {
                foreach (var prop in element.EnumerateObject())
                {
                    ExtractResponsiveTracks(prop.Value, tracks);
                }
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
            {
                ExtractResponsiveTracks(item, tracks);
            }
        }
    }

    private static string GetShelfTitle(JsonElement shelf)
    {
        if (shelf.TryGetProperty("header", out var header))
        {
            if (header.TryGetProperty("musicCarouselShelfBasicHeaderRenderer", out var basicHeader) &&
                basicHeader.TryGetProperty("title", out var titleObj) &&
                titleObj.TryGetProperty("runs", out var runs) && runs.GetArrayLength() > 0)
            {
                return runs[0].GetProperty("text").GetString() ?? "";
            }
        }
        return "";
    }

    private static string GetGridTitle(JsonElement grid)
    {
        if (grid.TryGetProperty("header", out var header))
        {
            if (header.TryGetProperty("gridHeaderRenderer", out var gHeader) &&
                gHeader.TryGetProperty("title", out var titleObj) &&
                titleObj.TryGetProperty("runs", out var runs) && runs.GetArrayLength() > 0)
            {
                return runs[0].GetProperty("text").GetString() ?? "";
            }
        }
        return "";
    }

    private static string GetMusicShelfTitle(JsonElement musicShelf)
    {
        if (musicShelf.TryGetProperty("title", out var titleObj) &&
            titleObj.TryGetProperty("runs", out var runs) && runs.GetArrayLength() > 0)
        {
            return runs[0].GetProperty("text").GetString() ?? "";
        }
        return "";
    }

    private void ApplyHeaders(HttpRequestMessage req)
    {
        req.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36");
        req.Headers.Add("X-Goog-Api-Format-Version", "1");
        req.Headers.Add("X-YouTube-Client-Name", "67"); // WEB_REMIX
        req.Headers.Add("X-YouTube-Client-Version", "1.20260114.01.00");
        req.Headers.Add("X-Origin", "https://music.youtube.com");
        req.Headers.Add("Referer", "https://music.youtube.com/");
        req.Headers.Add("Origin", "https://music.youtube.com");

        if (!string.IsNullOrEmpty(_session.VisitorData))
        {
            req.Headers.Add("X-Goog-Visitor-Id", _session.VisitorData);
        }

        if (_session.IsLoggedIn && !string.IsNullOrEmpty(_session.Cookie))
        {
            req.Headers.Add("Cookie", _session.Cookie);

            // Calculate SAPISIDHASH Authorization
            var sapisid = ExtractCookieValue(_session.Cookie, "SAPISID") ??
                          ExtractCookieValue(_session.Cookie, "__Secure-3PAPISID") ??
                          ExtractCookieValue(_session.Cookie, "SSID");

            if (!string.IsNullOrEmpty(sapisid))
            {
                var currentTime = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                var sapisidHash = Sha1($"{currentTime} {sapisid} https://music.youtube.com");
                req.Headers.Add("Authorization", $"SAPISIDHASH {currentTime}_{sapisidHash}");
            }
        }
    }

    private static string? ExtractCookieValue(string cookieString, string key)
    {
        var pairs = cookieString.Split(';', StringSplitOptions.RemoveEmptyEntries);
        foreach (var pair in pairs)
        {
            var parts = pair.Trim().Split('=', 2);
            if (parts.Length == 2 && parts[0].Trim().Equals(key, StringComparison.OrdinalIgnoreCase))
            {
                return parts[1].Trim();
            }
        }
        return null;
    }

    private static string Sha1(string input)
    {
        using var sha = SHA1.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
