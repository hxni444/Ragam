using System.IO;
using System.Net.Http;
using System.Reflection;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Ragam.App.Data;
using Ragam.App.Interop;
using Ragam.App.Services;

namespace Ragam.App;

public partial class MainWindow : Window
{
    private BridgeHandler? _bridgeHandler;
    private readonly YouTubeService _youTubeService = new();
    private readonly InnerTubeService _innerTubeService = new();
    private readonly LyricsService _lyricsService = new();
    private readonly DatabaseService _databaseService = new();
    private readonly DiscordRpcService _discordService = new();

    public MainWindow()
    {
        InitializeComponent();
        AppDbContext.InitializeDatabase();
        _discordService.Initialize();

        Loaded += MainWindow_Loaded;
        Closing += MainWindow_Closing;
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            var userDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Ragam", "WebViewProfile");
            var env = await CoreWebView2Environment.CreateAsync(userDataFolder: userDataDir);

            await MainWebView.EnsureCoreWebView2Async(env);
            MainWebView.CoreWebView2.NewWindowRequested += (s, args) =>
            {
                args.Handled = true;
                try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(args.Uri) { UseShellExecute = true }); } catch { }
            };

            _bridgeHandler = new BridgeHandler(
                this,
                MainWebView,
                env,
                _youTubeService,
                _innerTubeService,
                _lyricsService,
                _databaseService,
                _discordService
            );

            MainWebView.CoreWebView2.WebMessageReceived += async (s, args) =>
            {
                var json = args.TryGetWebMessageAsString();
                if (!string.IsNullOrEmpty(json) && _bridgeHandler != null)
                {
                    await _bridgeHandler.HandleMessageAsync(json);
                }
            };

            string? targetDistPath = GetUiContentPath();

            if (targetDistPath != null && Directory.Exists(targetDistPath))
            {
                MainWebView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "ragam.local",
                    targetDistPath,
                    CoreWebView2HostResourceAccessKind.Allow
                );
                MainWebView.CoreWebView2.Navigate("https://ragam.local/index.html");
            }
            else
            {
                MainWebView.CoreWebView2.NavigateToString("<body style=\"background:#000;color:#FF5400;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;\"><h1>RAGAM</h1></body>");
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Failed to initialize WebView2: {ex.Message}", "RAGAM Error", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private string? GetUiContentPath()
    {
        // 1. Check folder next to the .exe
        var directPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
        if (Directory.Exists(directPath) && File.Exists(Path.Combine(directPath, "index.html")))
        {
            return directPath;
        }

        // 2. Check dev UI path if in local development
        var devPath = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "Ragam.UI", "dist"));
        if (Directory.Exists(devPath) && File.Exists(Path.Combine(devPath, "index.html")))
        {
            return devPath;
        }

        // 3. Extract embedded resources to LocalAppData/Ragam/wwwroot
        var appDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Ragam", "wwwroot");
        ExtractEmbeddedResources(appDataDir);
        if (Directory.Exists(appDataDir) && File.Exists(Path.Combine(appDataDir, "index.html")))
        {
            return appDataDir;
        }

        return null;
    }

    private void ExtractEmbeddedResources(string targetDir)
    {
        try
        {
            var assembly = Assembly.GetExecutingAssembly();
            var resourceNames = assembly.GetManifestResourceNames();
            var prefix = "Ragam.wwwroot.";

            Directory.CreateDirectory(targetDir);
            Directory.CreateDirectory(Path.Combine(targetDir, "assets"));

            foreach (var name in resourceNames)
            {
                if (!name.StartsWith(prefix)) continue;

                var relative = name.Substring(prefix.Length);
                string filePath;
                if (relative.StartsWith("assets."))
                {
                    var fileName = relative.Substring("assets.".Length);
                    filePath = Path.Combine(targetDir, "assets", fileName);
                }
                else
                {
                    filePath = Path.Combine(targetDir, relative);
                }

                using var stream = assembly.GetManifestResourceStream(name);
                if (stream != null)
                {
                    using var fileStream = File.Create(filePath);
                    stream.CopyTo(fileStream);
                }
            }
        }
        catch
        {
        }
    }

    private void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        _discordService.Dispose();
    }
}
