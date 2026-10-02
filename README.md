# 🌌 Velune Desktop

A modern, subscription-free YouTube Music desktop client built with **.NET Core (C#)**, **Microsoft WebView2**, and **React (TypeScript)**.

---

## ⚡ Features
- 🚫 **Ad-free & Unlocked**: Direct audio stream isolation (Opus ~160kbps & AAC) from YouTube's streaming CDN without ad manifests.
- 🎤 **Real-Time Synced Lyrics**: Synchronized `.lrc` and word-by-word karaoke highlights powered by LRCLIB and YouTube transcripts.
- 🎨 **Material You / Glassmorphism UI**: High-fidelity dark mode with dynamic glows, animated waveform scrubber, and smooth Framer Motion transitions.
- 🎧 **Play Queue & History**: Full queue management, shuffle, repeat modes, and local listening history.
- ❤️ **Local-First SQLite Database**: Offline favorites and library persistence without requiring external servers.
- 🎮 **Discord Rich Presence**: Live "Listening to..." status updates on Discord.
- 📦 **Single Standalone Executable**: Packages both the backend engine and React frontend into a portable `.exe`.

---

## 🏗️ Architecture

```
Velune.Desktop/
├── Velune.Desktop.App/       # .NET 8 WPF Host & Services
│   ├── Data/                 # SQLite DbContext & Entities (Favorites, History, Playlists)
│   ├── Interop/              # BridgeHandler (WebMessage IPC router between React & C#)
│   ├── Models/               # Track, Lyrics, and HomeFeed DTOs
│   ├── Services/             # YouTubeService, LyricsService, DiscordRpcService, DatabaseService
│   ├── MainWindow.xaml       # Modern borderless window with WebView2
│   └── MainWindow.xaml.cs    # Host initialization & Dev/Prod route detection
│
└── Velune.Desktop.UI/        # React 18 + Vite + TypeScript Frontend
    ├── src/
    │   ├── components/       # PlayerBar, SyncedLyricsView, QueueDrawer, Sidebar, TitleBar, TrackCards
    │   ├── context/          # PlayerContext (Audio element, Queue, Volume, State)
    │   ├── pages/            # HomePage (Quick Picks, Trending, Hits), SearchPage, LibraryPage
    │   ├── services/         # NativeBridge (Typed WebMessage RPC client)
    │   └── styles/           # Dark Glassmorphism CSS Design System
```

---

## 🚀 Running in Development Mode (With Hot Reload)

1. **Start the React Vite Dev Server**:
   ```bash
   cd Velune.Desktop/Velune.Desktop.UI
   npm run dev
   ```

2. **Launch the .NET WPF App**:
   ```bash
   cd Velune.Desktop/Velune.Desktop.App
   dotnet run
   ```
   *The app automatically detects `http://localhost:5173` and attaches for instant Hot Module Replacement (HMR).*

---

## 📦 Building Single Standalone `.exe`

1. **Build the React production bundle**:
   ```bash
   cd Velune.Desktop/Velune.Desktop.UI
   npm run build
   ```

2. **Publish the Single `.exe`**:
   ```bash
   cd Velune.Desktop/Velune.Desktop.App
   dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true
   ```
   *Output executable will be generated at:*
   `Velune.Desktop.App/bin/Release/net8.0-windows/win-x64/publish/Velune.Desktop.App.exe`
