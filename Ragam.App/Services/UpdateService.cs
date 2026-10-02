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
    public string CurrentVersion { get; set; } = "1.0.0";
    public string LatestVersion { get; set; } = "1.0.0";
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
        _httpClient.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("Ragam-Desktop", "1.0.5"));
    }

    public string GetCurrentVersion()
    {
        var version = Assembly.GetExecutingAssembly().GetName().Version;
        return version != null ? $"{version.Major}.{version.Minor}.{version.Build}" : "1.0.4";
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
            string highestTag = "";
            string releaseNotes = "";
            string publishedAt = "";
            string downloadUrl = "";

            // 1. Check raw version.json & package.json (100% immune to GitHub API rate limits)
            try
            {
                var rawVersionUrl = $"https://raw.githubusercontent.com/{RepoOwner}/{RepoName}/main/version.json?t={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
                using var rawResponse = await _httpClient.GetAsync(rawVersionUrl);
                if (rawResponse.IsSuccessStatusCode)
                {
                    var rawJson = await rawResponse.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(rawJson);
                    var root = doc.RootElement;
                    var ver = root.TryGetProperty("version", out var vEl) ? vEl.GetString() ?? "" : "";
                    var cleanVer = ver.TrimStart('v', 'V').Trim();

                    if (!string.IsNullOrEmpty(cleanVer))
                    {
                        highestTag = cleanVer;
                        releaseNotes = root.TryGetProperty("notes", out var nEl) ? nEl.GetString() ?? "" : "";
                        downloadUrl = root.TryGetProperty("downloadUrl", out var dEl) ? dEl.GetString() ?? "" : "";
                        publishedAt = root.TryGetProperty("publishedAt", out var pEl) ? pEl.GetString() ?? "" : "";
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error checking raw version.json: {ex.Message}");
            }

            // 1b. Fallback to raw package.json if version.json wasn't found
            if (string.IsNullOrEmpty(highestTag))
            {
                try
                {
                    var rawPkgUrl = $"https://raw.githubusercontent.com/{RepoOwner}/{RepoName}/main/Ragam.UI/package.json?t={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
                    using var pkgResponse = await _httpClient.GetAsync(rawPkgUrl);
                    if (pkgResponse.IsSuccessStatusCode)
                    {
                        var pkgJson = await pkgResponse.Content.ReadAsStringAsync();
                        using var doc = JsonDocument.Parse(pkgJson);
                        var ver = doc.RootElement.TryGetProperty("version", out var vEl) ? vEl.GetString() ?? "" : "";
                        var cleanVer = ver.TrimStart('v', 'V').Trim();
                        if (!string.IsNullOrEmpty(cleanVer))
                        {
                            highestTag = cleanVer;
                        }
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"Error checking raw package.json: {ex.Message}");
                }
            }

            // 2. Check Git Tags via API if available
            try
            {
                var tagsUrl = $"https://api.github.com/repos/{RepoOwner}/{RepoName}/tags";
                using var tagsResponse = await _httpClient.GetAsync(tagsUrl);
                if (tagsResponse.IsSuccessStatusCode)
                {
                    var tagsJson = await tagsResponse.Content.ReadAsStringAsync();
                    using var tagsDoc = JsonDocument.Parse(tagsJson);
                    if (tagsDoc.RootElement.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var tagItem in tagsDoc.RootElement.EnumerateArray())
                        {
                            var tagName = tagItem.TryGetProperty("name", out var nameEl) ? nameEl.GetString() ?? "" : "";
                            var cleanTag = tagName.TrimStart('v', 'V').Trim();
                            if (!string.IsNullOrEmpty(cleanTag))
                            {
                                if (string.IsNullOrEmpty(highestTag) || IsVersionNewer(cleanTag, highestTag))
                                {
                                    highestTag = cleanTag;
                                }
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error checking tags: {ex.Message}");
            }

            // 3. Check official GitHub Release for notes & assets
            try
            {
                var releasesUrl = $"https://api.github.com/repos/{RepoOwner}/{RepoName}/releases/latest";
                using var response = await _httpClient.GetAsync(releasesUrl);
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;

                    var relTag = root.TryGetProperty("tag_name", out var tagEl) ? tagEl.GetString() ?? "" : "";
                    var cleanRelTag = relTag.TrimStart('v', 'V').Trim();
                    
                    if (!string.IsNullOrEmpty(cleanRelTag))
                    {
                        if (string.IsNullOrEmpty(highestTag) || IsVersionNewer(cleanRelTag, highestTag))
                        {
                            highestTag = cleanRelTag;
                        }
                    }

                    if (string.IsNullOrEmpty(releaseNotes))
                    {
                        releaseNotes = root.TryGetProperty("body", out var bodyEl) ? bodyEl.GetString() ?? "" : "";
                    }
                    if (string.IsNullOrEmpty(publishedAt))
                    {
                        publishedAt = root.TryGetProperty("published_at", out var pubEl) ? pubEl.GetString() ?? "" : "";
                    }

                    if (root.TryGetProperty("assets", out var assetsEl) && assetsEl.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var asset in assetsEl.EnumerateArray())
                        {
                            var name = asset.TryGetProperty("name", out var nameEl) ? nameEl.GetString() ?? "" : "";
                            if (name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                            {
                                var assetDl = asset.TryGetProperty("browser_download_url", out var dlEl) ? dlEl.GetString() ?? "" : "";
                                if (!string.IsNullOrEmpty(assetDl)) downloadUrl = assetDl;
                                break;
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error checking releases: {ex.Message}");
            }

            if (string.IsNullOrEmpty(downloadUrl))
            {
                downloadUrl = $"https://github.com/{RepoOwner}/{RepoName}/raw/main/release/Ragam.exe";
            }

            if (!string.IsNullOrEmpty(highestTag) && IsVersionNewer(highestTag, currentVerStr))
            {
                updateInfo.HasUpdate = true;
                updateInfo.LatestVersion = highestTag;
                updateInfo.ReleaseNotes = string.IsNullOrWhiteSpace(releaseNotes)
                    ? $"RAGAM v{highestTag} is ready with the latest audio engine enhancements and bug fixes."
                    : releaseNotes;
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
