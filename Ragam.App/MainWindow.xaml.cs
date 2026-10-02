using System.IO;
using System.Net.Http;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Velune.Desktop.App.Data;
using Velune.Desktop.App.Interop;
using Velune.Desktop.App.Services;

namespace Velune.Desktop.App;

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
            var env = await CoreWebView2Environment.CreateAsync(
                userDataFolder: Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "VeluneDesktop", "WebViewProfile")
            );

            await MainWebView.EnsureCoreWebView2Async(env);

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

            // Check if Vite Dev Server is running
            bool isDevServerRunning = await CheckDevServerAsync("http://localhost:5173");

            if (isDevServerRunning)
            {
                MainWebView.CoreWebView2.Navigate("http://localhost:5173");
            }
            else
            {
                // In production, map local folder to virtual host
                var distPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
                if (!Directory.Exists(distPath))
                {
                    // Fallback to dev UI folder if not yet published
                    distPath = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "Velune.Desktop.UI", "dist"));
                }

                if (Directory.Exists(distPath))
                {
                    MainWebView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                        "velune.local",
                        distPath,
                        CoreWebView2HostResourceAccessKind.Allow
                    );
                    MainWebView.CoreWebView2.Navigate("https://velune.local/index.html");
                }
                else
                {
                    MainWebView.CoreWebView2.NavigateToString("<h1>Velune Desktop</h1><p>Starting UI...</p>");
                }
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Failed to initialize WebView2: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private static async Task<bool> CheckDevServerAsync(string url)
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(500) };
            var response = await client.GetAsync(url);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        _discordService.Dispose();
    }
}