using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Reflection;
using System.Text.Json;
using System.Windows;

namespace Ragam.App.Services;

public class UpdateInfo
{
    public bool HasUpdate { get; set; }
    public string CurrentVersion { get; set; } = "1.0.1";
    public string LatestVersion { get; set; } = "1.0.1";
    public string ReleaseNotes { get; set; } = "";
    public string DownloadUrl { get; set; } = "";
    public string PublishedAt { get; set; } = "";
}

public class UpdateService
{
    private readonly HttpClient _httpClient;
    private const string RepoOwner = "hxni444";
    private const string RepoName = "Ragam";

    public UpdateService()
    {
        _httpClient = new HttpClient();
        _httpClient.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("Ragam-Desktop", "1.0.1"));
    }

    public string GetCurrentVersion()
    {
        var version = Assembly.GetExecutingAssembly().GetName().Version;
        return version != null ? $"{version.Major}.{version.Minor}.{version.Build}" : "1.0.1";
    }

    public async Task<UpdateInfo> CheckForUpdatesAsync()
    {
        var currentVerStr = GetCurrentVersion();
        var updateInfo = new UpdateInfo
        {
            HasUpdate = false,
            CurrentVersion = currentVerStr,
            LatestVersion = currentVerStr
        };

        try
        {
            var url = $"https://api.github.com/repos/{RepoOwner}/{RepoName}/releases/latest";
            using var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                return updateInfo;
            }

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var tagName = root.TryGetProperty("tag_name", out var tagEl) ? tagEl.GetString() ?? "" : "";
            var cleanLatestVer = tagName.TrimStart('v', 'V');
            var body = root.TryGetProperty("body", out var bodyEl) ? bodyEl.GetString() ?? "" : "";
            var publishedAt = root.TryGetProperty("published_at", out var pubEl) ? pubEl.GetString() ?? "" : "";

            string downloadUrl = "";
            if (root.TryGetProperty("assets", out var assetsEl) && assetsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var asset in assetsEl.EnumerateArray())
                {
                    var name = asset.TryGetProperty("name", out var nameEl) ? nameEl.GetString() ?? "" : "";
                    if (name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                    {
                        downloadUrl = asset.TryGetProperty("browser_download_url", out var dlEl) ? dlEl.GetString() ?? "" : "";
                        break;
                    }
                }
            }

            if (string.IsNullOrEmpty(downloadUrl))
            {
                downloadUrl = $"https://github.com/{RepoOwner}/{RepoName}/raw/main/release/Ragam.exe";
            }

            if (IsVersionNewer(cleanLatestVer, currentVerStr))
            {
                updateInfo.HasUpdate = true;
                updateInfo.LatestVersion = cleanLatestVer;
                updateInfo.ReleaseNotes = body;
                updateInfo.DownloadUrl = downloadUrl;
                updateInfo.PublishedAt = publishedAt;
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Error checking updates: {ex.Message}");
        }

        return updateInfo;
    }

    private static bool IsVersionNewer(string latest, string current)
    {
        if (Version.TryParse(latest, out var lVer) && Version.TryParse(current, out var cVer))
        {
            return lVer > cVer;
        }
        return string.Compare(latest, current, StringComparison.OrdinalIgnoreCase) > 0;
    }

    public async Task<bool> DownloadAndApplyUpdateAsync(string downloadUrl, Action<int>? progressCallback = null)
    {
        try
        {
            var tempDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Ragam", "updates");
            Directory.CreateDirectory(tempDir);

            var tempExePath = Path.Combine(tempDir, "Ragam_new.exe");
            if (File.Exists(tempExePath))
            {
                try { File.Delete(tempExePath); } catch { }
            }

            using (var response = await _httpClient.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead))
            {
                response.EnsureSuccessStatusCode();
                var totalBytes = response.Content.Headers.ContentLength ?? -1L;

                using var stream = await response.Content.ReadAsStreamAsync();
                using var fileStream = File.Create(tempExePath);

                var buffer = new byte[81920];
                long totalRead = 0;
                int read;

                while ((read = await stream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                {
                    await fileStream.WriteAsync(buffer, 0, read);
                    totalRead += read;

                    if (totalBytes > 0 && progressCallback != null)
                    {
                        var percentage = (int)((totalRead * 100) / totalBytes);
                        progressCallback(percentage);
                    }
                }
            }

            progressCallback?.Invoke(100);

            // Execute updater script
            var currentExePath = Process.GetCurrentProcess().MainModule?.FileName;
            if (string.IsNullOrEmpty(currentExePath)) return false;

            var currentPid = Process.GetCurrentProcess().Id;
            var scriptPath = Path.Combine(tempDir, "updater.bat");

            var scriptContent = $@"@echo off
timeout /t 1 /nobreak >nul
:waitprocess
tasklist /fi ""PID eq {currentPid}"" 2>nul | find ""{currentPid}"" >nul
if errorlevel 1 (
    copy /y ""{tempExePath}"" ""{currentExePath}"" >nul
    del /f /q ""{tempExePath}"" >nul
    start """" ""{currentExePath}""
    del /f /q ""%~f0"" >nul
    exit /b
)
timeout /t 1 /nobreak >nul
goto waitprocess
";
            File.WriteAllText(scriptPath, scriptContent);

            var psi = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = $"/c \"{scriptPath}\"",
                CreateNoWindow = true,
                UseShellExecute = false,
                WindowStyle = ProcessWindowStyle.Hidden
            };

            Process.Start(psi);

            Application.Current.Dispatcher.Invoke(() =>
            {
                Application.Current.Shutdown();
            });

            return true;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Failed to download and apply update: {ex.Message}");
            return false;
        }
    }
}
