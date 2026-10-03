using System;
using System.Diagnostics;
using System.Threading.Tasks;
using Velopack;
using Velopack.Sources;

namespace Ragam.App.Services;

public class UpdateInfo
{
    public bool HasUpdate { get; set; }
    public string CurrentVersion { get; set; } = "2.0.2";
    public string LatestVersion { get; set; } = "2.0.2";
    public string ReleaseNotes { get; set; } = "";
    public string DownloadUrl { get; set; } = "";
    public string PublishedAt { get; set; } = "";
}

public class UpdateService
{
    // Using SimpleWebSource pointing to GitHub Releases latest download avoids GitHub API 60 req/hr rate limits completely.
    private const string DownloadSourceUrl = "https://github.com/hxni444/Ragam/releases/latest/download";
    private UpdateManager? _mgr;
    private Velopack.UpdateInfo? _velopackUpdate;

    private UpdateManager GetManager()
    {
        if (_mgr == null)
        {
            var source = new SimpleWebSource(DownloadSourceUrl);
            _mgr = new UpdateManager(source);
        }
        return _mgr;
    }

    public string GetCurrentVersion()
    {
        try
        {
            var mgr = GetManager();
            if (mgr.IsInstalled && mgr.CurrentVersion != null)
            {
                return mgr.CurrentVersion.ToFullString();
            }
        }
        catch { }

        var version = System.Reflection.Assembly.GetExecutingAssembly().GetName().Version;
        return version != null ? $"{version.Major}.{version.Minor}.{version.Build}" : "2.0.2";
    }

    public async Task<UpdateInfo> CheckForUpdatesAsync()
    {
        var currentVer = GetCurrentVersion();
        var info = new UpdateInfo
        {
            HasUpdate = false,
            CurrentVersion = currentVer,
            LatestVersion = currentVer
        };

        try
        {
            var mgr = GetManager();
            if (!mgr.IsInstalled)
            {
                Debug.WriteLine("[UpdateService] Application is not running from installed directory (dev mode).");
                return info;
            }

            _velopackUpdate = await mgr.CheckForUpdatesAsync();

            if (_velopackUpdate != null)
            {
                info.HasUpdate = true;
                info.LatestVersion = _velopackUpdate.TargetFullRelease.Version.ToFullString();
                info.ReleaseNotes = "RAGAM v" + info.LatestVersion + " is ready to install.";
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[UpdateService] Update check exception: {ex.Message}");
        }

        return info;
    }

    public async Task<bool> DownloadAndApplyUpdateAsync(string downloadUrl, Action<int>? progressCallback = null)
    {
        try
        {
            var mgr = GetManager();
            if (!mgr.IsInstalled)
            {
                Debug.WriteLine("[UpdateService] Cannot update in dev mode.");
                return false;
            }

            if (_velopackUpdate == null)
            {
                _velopackUpdate = await mgr.CheckForUpdatesAsync();
            }

            if (_velopackUpdate == null) return false;

            await mgr.DownloadUpdatesAsync(_velopackUpdate, (progress) =>
            {
                progressCallback?.Invoke(progress);
            });

            progressCallback?.Invoke(100);

            mgr.ApplyUpdatesAndRestart(_velopackUpdate);
            return true;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[UpdateService] Velopack apply updates error: {ex.Message}");
            return false;
        }
    }
}
