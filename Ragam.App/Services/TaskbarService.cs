using System;
using System.Windows;
using System.Windows.Media;
using System.Windows.Shell;

namespace Ragam.App.Services;

public class TaskbarService
{
    private readonly MainWindow _window;
    private TaskbarItemInfo? _taskbarInfo;
    private ThumbButtonInfo? _prevButton;
    private ThumbButtonInfo? _playPauseButton;
    private ThumbButtonInfo? _nextButton;

    private ImageSource? _playIcon;
    private ImageSource? _pauseIcon;
    private ImageSource? _prevIcon;
    private ImageSource? _nextIcon;

    private bool _isPlaying;
    private bool _hasTrack;

    public event Action? OnPrevious;
    public event Action? OnTogglePlay;
    public event Action? OnNext;

    public TaskbarService(MainWindow window)
    {
        _window = window;
    }

    public void Initialize()
    {
        _window.Dispatcher.Invoke(() =>
        {
            try
            {
                _prevIcon = CreateVectorDrawingIcon("M 6,5 H 8.5 V 19 H 6 Z M 18.5,5.5 V 18.5 L 9.5,12 Z");
                _playIcon = CreateVectorDrawingIcon("M 8,5.5 V 18.5 L 19,12 Z");
                _pauseIcon = CreateVectorDrawingIcon("M 6.5,5.5 H 9.5 V 18.5 H 6.5 Z M 14.5,5.5 H 17.5 V 18.5 H 14.5 Z");
                _nextIcon = CreateVectorDrawingIcon("M 5.5,5.5 V 18.5 L 14.5,12 Z M 15.5,5.5 H 18 V 18.5 H 15.5 Z");

                _taskbarInfo = _window.AppTaskbarInfo ?? _window.TaskbarItemInfo;
                _prevButton = _window.ThumbPrev;
                _playPauseButton = _window.ThumbPlayPause;
                _nextButton = _window.ThumbNext;

                if (_prevButton != null)
                {
                    _prevButton.ImageSource = _prevIcon;
                    _prevButton.Description = "Previous Track";
                    _prevButton.IsEnabled = false;
                    _prevButton.Click += (s, e) => OnPrevious?.Invoke();
                }

                if (_playPauseButton != null)
                {
                    _playPauseButton.ImageSource = _playIcon;
                    _playPauseButton.Description = "Play";
                    _playPauseButton.IsEnabled = false;
                    _playPauseButton.Click += (s, e) => OnTogglePlay?.Invoke();
                }

                if (_nextButton != null)
                {
                    _nextButton.ImageSource = _nextIcon;
                    _nextButton.Description = "Next Track";
                    _nextButton.IsEnabled = false;
                    _nextButton.Click += (s, e) => OnNext?.Invoke();
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"TaskbarService init failed: {ex.Message}");
            }
        });
    }

    public void UpdatePlaybackState(bool hasTrack, bool isPlaying, string? title = null, string? artist = null, string? thumbnailUrl = null, double progress = 0)
    {
        _hasTrack = hasTrack;
        _isPlaying = isPlaying;

        _window.Dispatcher.Invoke(() =>
        {
            try
            {
                if (_playPauseButton != null)
                {
                    _playPauseButton.IsEnabled = hasTrack;
                    _playPauseButton.ImageSource = isPlaying ? _pauseIcon : _playIcon;
                    _playPauseButton.Description = isPlaying ? "Pause" : "Play";
                }

                if (_prevButton != null)
                {
                    _prevButton.IsEnabled = hasTrack;
                }

                if (_nextButton != null)
                {
                    _nextButton.IsEnabled = hasTrack;
                }

                if (hasTrack && !string.IsNullOrWhiteSpace(title))
                {
                    var trackDesc = !string.IsNullOrWhiteSpace(artist) ? $"{title} • {artist}" : title;
                    _window.Title = $"{trackDesc} - RAGAM";
                }
                else
                {
                    _window.Title = "RAGAM";
                }

                if (_taskbarInfo != null)
                {
                    if (hasTrack && progress > 0)
                    {
                        _taskbarInfo.ProgressState = isPlaying ? TaskbarItemProgressState.Normal : TaskbarItemProgressState.Paused;
                        _taskbarInfo.ProgressValue = Math.Clamp(progress, 0.0, 1.0);
                    }
                    else
                    {
                        _taskbarInfo.ProgressState = TaskbarItemProgressState.None;
                        _taskbarInfo.ProgressValue = 0;
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"TaskbarService update failed: {ex.Message}");
            }
        });
    }

    private static ImageSource CreateVectorDrawingIcon(string pathData)
    {
        var geometry = Geometry.Parse(pathData);
        var group = new DrawingGroup();
        group.Children.Add(new GeometryDrawing
        {
            Geometry = new RectangleGeometry(new Rect(0, 0, 24, 24)),
            Brush = Brushes.Transparent
        });

        group.Children.Add(new GeometryDrawing
        {
            Geometry = geometry,
            Brush = new SolidColorBrush(Color.FromRgb(255, 255, 255))
        });

        var drawingImage = new DrawingImage(group);
        drawingImage.Freeze();
        return drawingImage;
    }
}
