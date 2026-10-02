using System.Text;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Velune.Desktop.App.Services;

namespace Velune.Desktop.App;

public partial class YouTubeLoginWindow : Window
{
    private readonly CoreWebView2Environment _env;
    private readonly InnerTubeService _innerTubeService;
    public bool LoginSuccessful { get; private set; }
    public event Action<bool>? LoginCompleted;

    public YouTubeLoginWindow(CoreWebView2Environment env, InnerTubeService innerTubeService)
    {
        InitializeComponent();
        _env = env;
        _innerTubeService = innerTubeService;
        Loaded += YouTubeLoginWindow_Loaded;
        Closed += (s, e) =>
        {
            if (!LoginSuccessful)
            {
                LoginCompleted?.Invoke(false);
            }
        };
    }

    private async void YouTubeLoginWindow_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            await AuthWebView.EnsureCoreWebView2Async(_env);

            // Use standard Google Chrome desktop user-agent
            AuthWebView.CoreWebView2.Settings.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
            AuthWebView.CoreWebView2.Settings.IsStatusBarEnabled = false;

            AuthWebView.CoreWebView2.NavigationCompleted += CoreWebView2_NavigationCompleted;
            AuthWebView.CoreWebView2.SourceChanged += CoreWebView2_SourceChanged;

            AuthWebView.CoreWebView2.Navigate("https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fmusic.youtube.com");
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Failed to initialize login browser: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            Close();
        }
    }

    private void CoreWebView2_SourceChanged(object? sender, CoreWebView2SourceChangedEventArgs e)
    {
        CheckForSuccessfulLogin();
    }

    private void CoreWebView2_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        CheckForSuccessfulLogin();
    }

    private async void CheckForSuccessfulLogin()
    {
        if (AuthWebView.CoreWebView2 == null) return;

        var currentUri = AuthWebView.CoreWebView2.Source;
        if (string.IsNullOrEmpty(currentUri)) return;

        if (currentUri.StartsWith("https://music.youtube.com", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var cookieManager = AuthWebView.CoreWebView2.CookieManager;
                var cookies = await cookieManager.GetCookiesAsync("https://music.youtube.com");

                var sb = new StringBuilder();
                bool hasAuthCookie = false;

                foreach (var c in cookies)
                {
                    sb.Append($"{c.Name}={c.Value}; ");
                    if (c.Name == "SAPISID" || c.Name == "__Secure-3PAPISID" || c.Name == "SSID")
                    {
                        hasAuthCookie = true;
                    }
                }

                if (hasAuthCookie)
                {
                    var cookieString = sb.ToString().TrimEnd(' ', ';');

                    string? visitorData = null;
                    string? dataSyncId = null;

                    try
                    {
                        var vdRaw = await AuthWebView.CoreWebView2.ExecuteScriptAsync("window.yt && window.yt.config_ ? window.yt.config_.VISITOR_DATA : null");
                        if (!string.IsNullOrEmpty(vdRaw) && vdRaw != "null")
                        {
                            visitorData = vdRaw.Trim('"');
                        }

                        var dsRaw = await AuthWebView.CoreWebView2.ExecuteScriptAsync("window.yt && window.yt.config_ ? window.yt.config_.DATASYNC_ID : null");
                        if (!string.IsNullOrEmpty(dsRaw) && dsRaw != "null")
                        {
                            dataSyncId = dsRaw.Trim('"');
                        }
                    }
                    catch { }

                    await _innerTubeService.SaveSessionAsync(cookieString, visitorData, dataSyncId);

                    LoginSuccessful = true;
                    LoginCompleted?.Invoke(true);
                    Close();
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error capturing YTM login cookies: {ex.Message}");
            }
        }
    }
}
