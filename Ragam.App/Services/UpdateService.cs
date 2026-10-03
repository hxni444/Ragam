using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using Velopack;
using Velopack.Sources;

namespace Ragam.App.Services;

public class UpdateInfo
{
    public bool HasUpdate { get; set; }
    public string CurrentVersion { get; set; } = "2.0.3";
    public string LatestVersion { get; set; } = "2.0.3";
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
        return version != null ? $"{version.Major}.{version.Minor}.{version.Build}" : "2.0.3";
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
            Log($"Velopack IsInstalled: {mgr.IsInstalled}, AppId: {mgr.AppId}");

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
                info.ReleaseNotes = "RAGAM v" + info.LatestVersion + " is ready to install via Velopack.";
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
