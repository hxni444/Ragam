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
    private readonly UpdateService _updateService = new();

    public MainWindow()
    {
        InitializeComponent();
        AppDbContext.InitializeDatabase();
        _discordService.Initialize();

        Loaded += MainWindow_Loaded;
        StateChanged += MainWindow_StateChanged;
        Closing += MainWindow_Closing;
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            var userDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Ragam", "WebViewProfile");
            var env = await CoreWebView2Environment.CreateAsync(userDataFolder: userDataDir);

            await MainWebView.EnsureCoreWebView2Async(env);
            MainWebView.CoreWebView2.Settings.IsSwipeNavigationEnabled = true;
            MainWebView.CoreWebView2.Settings.IsPinchZoomEnabled = true;
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
                _discordService,
                _updateService
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

    private const int WM_GETMINMAXINFO = 0x0024;
    private const int MONITOR_DEFAULTTONEAREST = 0x00000002;

    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
    public struct POINT
    {
        public int x;
        public int y;
    }

    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
    public struct MINMAXINFO
    {
        public POINT ptReserved;
        public POINT ptMaxSize;
        public POINT ptMaxPosition;
        public POINT ptMinTrackSize;
        public POINT ptMaxTrackSize;
    }

    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential, CharSet = System.Runtime.InteropServices.CharSet.Auto)]
    public class MONITORINFO
    {
        public int cbSize = System.Runtime.InteropServices.Marshal.SizeOf(typeof(MONITORINFO));
        public RECT rcMonitor = new RECT();
        public RECT rcWork = new RECT();
        public int dwFlags = 0;
    }

    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [System.Runtime.InteropServices.DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr MonitorFromWindow(IntPtr hwnd, int dwFlags);

    [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Auto)]
    private static extern bool GetMonitorInfo(IntPtr hMonitor, MONITORINFO lpmi);

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);
        var handle = new System.Windows.Interop.WindowInteropHelper(this).Handle;
        var source = System.Windows.Interop.HwndSource.FromHwnd(handle);
        source?.AddHook(WindowProc);
    }

    private IntPtr WindowProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg == WM_GETMINMAXINFO)
        {
            WmGetMinMaxInfo(hwnd, lParam);
            handled = true;
        }
        return IntPtr.Zero;
    }

    private void WmGetMinMaxInfo(IntPtr hwnd, IntPtr lParam)
    {
        var mmi = (MINMAXINFO)System.Runtime.InteropServices.Marshal.PtrToStructure(lParam, typeof(MINMAXINFO))!;
        var hMonitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        if (hMonitor != IntPtr.Zero)
        {
            var mi = new MONITORINFO();
            GetMonitorInfo(hMonitor, mi);

            var rcWorkArea = mi.rcWork;
            var rcMonitorArea = mi.rcMonitor;

            mmi.ptMaxPosition.x = Math.Abs(rcWorkArea.Left - rcMonitorArea.Left);
            mmi.ptMaxPosition.y = Math.Abs(rcWorkArea.Top - rcMonitorArea.Top);
            mmi.ptMaxSize.x = Math.Abs(rcWorkArea.Right - rcWorkArea.Left);
            mmi.ptMaxSize.y = Math.Abs(rcWorkArea.Bottom - rcWorkArea.Top);
        }
        System.Runtime.InteropServices.Marshal.StructureToPtr(mmi, lParam, true);
    }

    private void MainWindow_StateChanged(object? sender, EventArgs e)
    {
        MainGrid.Margin = new Thickness(0);
    }

    private void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        _discordService.Dispose();
    }
}
