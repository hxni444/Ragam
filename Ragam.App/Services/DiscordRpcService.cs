using DiscordRPC;
using DiscordRPC.Logging;
using Velune.Desktop.App.Models;

namespace Velune.Desktop.App.Services;

public class DiscordRpcService : IDisposable
{
    private DiscordRpcClient? _client;
    private const string ClientId = "120000000000000000"; // Generic client ID or customized

    public void Initialize()
    {
        try
        {
            _client = new DiscordRpcClient(ClientId)
            {
                Logger = new ConsoleLogger { Level = LogLevel.Warning }
            };
            _client.Initialize();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to initialize Discord RPC: {ex.Message}");
        }
    }

    public void UpdatePresence(TrackDto track, bool isPlaying)
    {
        if (_client == null || !_client.IsInitialized) return;

        try
        {
            if (isPlaying)
            {
                _client.SetPresence(new RichPresence
                {
                    Details = track.Title,
                    State = $"by {track.Artist}",
                    Assets = new Assets
                    {
                        LargeImageKey = !string.IsNullOrEmpty(track.ThumbnailUrl) ? track.ThumbnailUrl : "app_icon",
                        LargeImageText = track.Album ?? "Velune Desktop",
                        SmallImageKey = "play_icon",
                        SmallImageText = "Playing"
                    },
                    Timestamps = Timestamps.Now
                });
            }
            else
            {
                _client.ClearPresence();
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error setting Discord presence: {ex.Message}");
        }
    }

    public void Clear()
    {
        _client?.ClearPresence();
    }

    public void Dispose()
    {
        _client?.Dispose();
    }
}
