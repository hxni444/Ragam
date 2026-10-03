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

            if (!mgr.IsInstalled)
            {
                Log("App is running in dev / uninstalled mode. Skipping update check.");
                return info;
            }

            _velopackUpdate = await mgr.CheckForUpdatesAsync();

            if (_velopackUpdate != null)
            {
                info.HasUpdate = true;
                info.LatestVersion = _velopackUpdate.TargetFullRelease.Version.ToFullString();
                info.ReleaseNotes = await FetchReleaseNotesAsync(info.LatestVersion);
                Log($"Update AVAILABLE! Target: {info.LatestVersion}, Deltas: {_velopackUpdate.DeltasToTarget?.Length ?? 0}");
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
                var raw = bodyEl.GetString()!;
                // Filter out any Velopack / packaging / checksum lines
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
        }
        catch { }

        return "• Full screen and player bar layout improvements\n• Added shuffle play option to all playlists & albums\n• Preserved playback position & playlist queue when restarting\n• Stable home feed recommendations caching\n• Audio streaming and UI performance optimizations";
    }

    public async Task<bool> DownloadAndApplyUpdateAsync(string downloadUrl, Action<int>? progressCallback = null)
    {
        try
        {
            var mgr = CreateManager();
            if (!mgr.IsInstalled)
            {
                Log("Cannot apply update: not running from installed directory.");
                return false;
            }

            if (_velopackUpdate == null)
            {
                Log("Re-checking updates before download...");
                _velopackUpdate = await mgr.CheckForUpdatesAsync();
            }

            if (_velopackUpdate == null)
            {
                Log("No update package available to download.");
                return false;
            }

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
        catch (Exception ex)
        {
            Log($"Exception during download and apply: {ex}");
            return false;
        }
    }
}
