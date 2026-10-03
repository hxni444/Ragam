using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Velopack;
using Velopack.Sources;

namespace Ragam.App.Services;

public class UpdateInfo
{
    public bool HasUpdate { get; set; }
    public string CurrentVersion { get; set; } = "2.0.6";
    public string LatestVersion { get; set; } = "2.0.6";
    public string ReleaseNotes { get; set; } = "";
    public string DownloadUrl { get; set; } = "";
    public string PublishedAt { get; set; } = "";
}

public class UpdateService
{
    private const string RepoUrl = "https://github.com/hxni444/Ragam";
    private Velopack.UpdateInfo? _velopackUpdate;

    private static void Log(string message)
    {
        try
        {
            var logDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Ragam");
            Directory.CreateDirectory(logDir);
            var logPath = Path.Combine(logDir, "update.log");
            File.AppendAllText(logPath, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}{Environment.NewLine}");
        }
        catch { }
        Debug.WriteLine($"[UpdateService] {message}");
    }

    private UpdateManager CreateManager()
    {
        var source = new GithubSource(RepoUrl, accessToken: null, prerelease: false);
        return new UpdateManager(source);
    }

    public string GetCurrentVersion()
    {
        try
        {
            var mgr = CreateManager();
            if (mgr.IsInstalled && mgr.CurrentVersion != null)
            {
                return mgr.CurrentVersion.ToFullString();
            }
        }
        catch { }

        var version = System.Reflection.Assembly.GetExecutingAssembly().GetName().Version;
        return version != null ? $"{version.Major}.{version.Minor}.{version.Build}" : "2.0.6";
    }

    public async Task<UpdateInfo> CheckForUpdatesAsync()
    {
        var currentVer = GetCurrentVersion();
        Log($"Checking for updates... Current version: {currentVer}");

        var info = new UpdateInfo
        {
            HasUpdate = false,
            CurrentVersion = currentVer,
            LatestVersion = currentVer
        };

        try
        {
            var mgr = CreateManager();
            Log($"Updater IsInstalled: {mgr.IsInstalled}, AppId: {mgr.AppId}");

            if (mgr.IsInstalled)
            {
                try
                {
                    _velopackUpdate = await mgr.CheckForUpdatesAsync();

                    if (_velopackUpdate != null)
                    {
                        info.HasUpdate = true;
                        info.LatestVersion = _velopackUpdate.TargetFullRelease.Version.ToFullString();

                        var embeddedNotes = _velopackUpdate.TargetFullRelease.NotesMarkdown;
                        if (!string.IsNullOrWhiteSpace(embeddedNotes))
                        {
                            info.ReleaseNotes = CleanNotes(embeddedNotes);
                        }
                        else
                        {
                            info.ReleaseNotes = await FetchReleaseNotesAsync(info.LatestVersion);
                        }

                        Log($"Update AVAILABLE via Velopack! Target: {info.LatestVersion}, Deltas: {_velopackUpdate.DeltasToTarget?.Length ?? 0}");
                        return info;
                    }
                }
                catch (Exception vEx)
                {
                    Log($"Velopack CheckForUpdatesAsync exception: {vEx.Message}");
                }
            }
            else
            {
                Log("App is running in uninstalled / portable mode. Checking GitHub Releases directly...");
            }

            // Fallback: Check GitHub API directly
            var gitHubRelease = await GetLatestReleaseFromGitHubAsync();
            if (gitHubRelease != null && IsNewerVersion(gitHubRelease.Version, currentVer))
            {
                info.HasUpdate = true;
                info.LatestVersion = gitHubRelease.Version;
                info.ReleaseNotes = !string.IsNullOrWhiteSpace(gitHubRelease.Notes) ? CleanNotes(gitHubRelease.Notes) : "";
                info.DownloadUrl = gitHubRelease.DownloadUrl ?? $"https://github.com/hxni444/Ragam/releases/download/v{gitHubRelease.Version}/Ragam-win-Setup.exe";
                Log($"Direct GitHub update detected: Current={currentVer} -> Latest={gitHubRelease.Version}");
            }
            else
            {
                Log("No update found. Application is up to date.");
            }
        }
        catch (Exception ex)
        {
            Log($"Exception during update check: {ex}");
        }

        return info;
    }

    private static bool IsNewerVersion(string latestVer, string currentVer)
    {
        try
        {
            var lClean = latestVer.TrimStart('v', 'V').Trim();
            var cClean = currentVer.TrimStart('v', 'V').Trim();

            var lParts = lClean.Split('.').Select(p => int.TryParse(p, out var v) ? v : 0).ToArray();
            var cParts = cClean.Split('.').Select(p => int.TryParse(p, out var v) ? v : 0).ToArray();

            int maxLen = Math.Max(lParts.Length, cParts.Length);
            for (int i = 0; i < maxLen; i++)
            {
                int lVal = i < lParts.Length ? lParts[i] : 0;
                int cVal = i < cParts.Length ? cParts[i] : 0;
                if (lVal > cVal) return true;
                if (lVal < cVal) return false;
            }
        }
        catch { }
        return false;
    }

    private record GitHubReleaseResult(string Version, string Notes, string? DownloadUrl);

    private static async Task<GitHubReleaseResult?> GetLatestReleaseFromGitHubAsync()
    {
        try
        {
            using var client = new HttpClient();
            client.DefaultRequestHeaders.UserAgent.ParseAdd("RagamApp/2.0");
            client.Timeout = TimeSpan.FromSeconds(8);

            var url = "https://api.github.com/repos/hxni444/Ragam/releases";
            var json = await client.GetStringAsync(url);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (root.ValueKind == JsonValueKind.Array && root.GetArrayLength() > 0)
            {
                foreach (var rel in root.EnumerateArray())
                {
                    var isDraft = rel.TryGetProperty("draft", out var dProp) && dProp.GetBoolean();
                    var isPre = rel.TryGetProperty("prerelease", out var preProp) && preProp.GetBoolean();
                    if (isDraft || isPre) continue;

                    var tagName = rel.TryGetProperty("tag_name", out var tProp) ? tProp.GetString() ?? "" : "";
                    var ver = tagName.TrimStart('v', 'V').Trim();
                    var notes = rel.TryGetProperty("body", out var bProp) ? bProp.GetString() ?? "" : "";

                    string? downloadUrl = null;
                    if (rel.TryGetProperty("assets", out var assets) && assets.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var a in assets.EnumerateArray())
                        {
                            var aName = a.TryGetProperty("name", out var nProp) ? nProp.GetString() ?? "" : "";
                            if (aName.EndsWith("-Setup.exe", StringComparison.OrdinalIgnoreCase) || aName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                            {
                                downloadUrl = a.TryGetProperty("browser_download_url", out var dlProp) ? dlProp.GetString() : null;
                                break;
                            }
                        }
                    }

                    if (!string.IsNullOrEmpty(ver))
                    {
                        return new GitHubReleaseResult(ver, notes, downloadUrl);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Log($"Failed to fetch releases from GitHub API: {ex.Message}");
        }

        return null;
    }

    private static string CleanNotes(string raw)
    {
        try
        {
            var lines = raw.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
            var cleanLines = lines
                .Where(l => !l.Contains("velopack", StringComparison.OrdinalIgnoreCase))
                .Where(l => !l.Contains("velpack", StringComparison.OrdinalIgnoreCase))
                .Where(l => !l.Contains(".nupkg", StringComparison.OrdinalIgnoreCase))
                .Where(l => !l.Contains("sha256", StringComparison.OrdinalIgnoreCase))
                .Where(l => !l.Contains("checksum", StringComparison.OrdinalIgnoreCase))
                .Where(l => !l.Contains("vpk ", StringComparison.OrdinalIgnoreCase))
                .Where(l => !l.StartsWith("---", StringComparison.Ordinal))
                .ToList();

            var cleanText = string.Join("\n", cleanLines).Trim();
            if (!string.IsNullOrWhiteSpace(cleanText))
            {
                return cleanText;
            }
        }
        catch { }

        return "• Full screen and player bar layout improvements\n• Added shuffle play option to all playlists & albums\n• Preserved playback position & playlist queue when restarting\n• Stable home feed recommendations caching\n• Audio streaming and UI performance optimizations";
    }

    private static async Task<string> FetchReleaseNotesAsync(string version)
    {
        try
        {
            using var client = new HttpClient();
            client.DefaultRequestHeaders.UserAgent.ParseAdd("RagamApp/2.0");
            client.Timeout = TimeSpan.FromSeconds(5);
            var url = $"https://api.github.com/repos/hxni444/Ragam/releases/tags/v{version}";
            var json = await client.GetStringAsync(url);
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("body", out var bodyEl) && !string.IsNullOrWhiteSpace(bodyEl.GetString()))
            {
                return CleanNotes(bodyEl.GetString()!);
            }
        }
        catch { }

        return "• Full screen and player bar layout improvements\n• Added shuffle play option to all playlists & albums\n• Preserved playback position & playlist queue when restarting\n• Stable home feed recommendations caching\n• Audio streaming and UI performance optimizations";
    }

    public async Task<bool> DownloadAndApplyUpdateAsync(string downloadUrl, Action<int>? progressCallback = null)
    {
        try
        {
            var mgr = CreateManager();
            if (mgr.IsInstalled)
            {
                if (_velopackUpdate == null)
                {
                    Log("Re-checking updates before download...");
                    _velopackUpdate = await mgr.CheckForUpdatesAsync();
                }

                if (_velopackUpdate != null)
                {
                    Log($"Downloading updates for target {_velopackUpdate.TargetFullRelease.Version}...");
                    await mgr.DownloadUpdatesAsync(_velopackUpdate, (progress) =>
                    {
                        Log($"Download progress: {progress}%");
                        progressCallback?.Invoke(progress);
                    });

                    progressCallback?.Invoke(100);
                    Log("Download complete. Applying updates and restarting application...");

                    mgr.ApplyUpdatesAndRestart(_velopackUpdate);
                    return true;
                }
            }

            // Fallback: Direct installer download for uninstalled / portable mode
            var targetUrl = !string.IsNullOrEmpty(downloadUrl) 
                ? downloadUrl 
                : "https://github.com/hxni444/Ragam/releases/latest/download/Ragam-win-Setup.exe";

            Log($"Directly downloading installer from {targetUrl}...");
            using var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("RagamApp/2.0");
            httpClient.Timeout = TimeSpan.FromMinutes(10);

            using var response = await httpClient.GetAsync(targetUrl, HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();

            var totalBytes = response.Content.Headers.ContentLength ?? 85_000_000;
            var tempPath = Path.Combine(Path.GetTempPath(), "Ragam-win-Setup.exe");

            await using (var contentStream = await response.Content.ReadAsStreamAsync())
            await using (var fileStream = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true))
            {
                var buffer = new byte[81920];
                long totalRead = 0;
                int read;

                while ((read = await contentStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                {
                    await fileStream.WriteAsync(buffer.AsMemory(0, read));
                    totalRead += read;
                    var progress = (int)((totalRead * 100) / totalBytes);
                    progressCallback?.Invoke(Math.Min(progress, 99));
                }

                await fileStream.FlushAsync();
            }

            progressCallback?.Invoke(100);
            Log($"Launching downloaded setup installer: {tempPath}");
            Process.Start(new ProcessStartInfo(tempPath) { UseShellExecute = true });
            Environment.Exit(0);
            return true;
        }
        catch (Exception ex)
        {
            Log($"Exception during download and apply: {ex}");
            return false;
        }
    }
}
