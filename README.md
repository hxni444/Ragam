# 🎵 RAGAM

A modern, fast, subscription-free YouTube Music desktop player built with **.NET 8 (C#)**, **Microsoft WebView2**, and **React 18 (TypeScript)**.

---

## ✨ Key Features

- 🎧 **Ad-Free & High-Fidelity Audio**: Direct Opus/AAC audio stream playback straight from YouTube Music CDNs with zero ads.
- 🎤 **Synchronized Lyrics**: Real-time karaoke-style word highlights and line-by-line scrolling lyrics powered by LRCLIB and YouTube transcripts.
- 🎨 **Sleek Custom UI**: Dark glassmorphic design system in theme orange (`#FF5400`), smooth Framer Motion micro-interactions, and a custom frameless window with native Aero Snap support.
- 📋 **Library & Offline Playlists**: Manage favorites, custom playlists, and local listening history stored in a local-first SQLite database.
- 🎮 **Discord Rich Presence**: Live "Listening to..." activity status on Discord with song titles, artists, and live album art.
- 🚀 **100% Standalone Executable**: Self-contained single-file `.exe` with embedded UI assets — zero installation or dependencies required.

---

## 🏗️ Architecture

```
Ragam/
├── Ragam.App/                  # .NET 8 WPF Host & Core Services
│   ├── Data/                  # Local SQLite DbContext (Favorites, History, Playlists)
│   ├── Interop/               # BridgeHandler (Bidirectional WebMessage IPC between React & C#)
│   ├── Models/                # Track, Playlist, Album, and Lyrics Data Models
│   ├── Services/              # YouTubeService, InnerTubeService, LyricsService, DiscordRpcService
│   ├── MainWindow.xaml        # Borderless WindowChrome host for WebView2
│   └── app.ico                # Custom multi-resolution app icon
│
├── Ragam.UI/                   # React 18 + Vite + TypeScript Frontend
│   ├── src/
│   │   ├── components/        # PlayerBar, SyncedLyricsView, QueueDrawer, Sidebar, TitleBar, AuthModal
│   │   ├── context/           # PlayerContext & State Management
│   │   ├── pages/             # HomePage, SearchPage, LibraryPage, ArtistPage, AlbumPage
│   │   ├── services/          # NativeBridge RPC client & Firebase Authentication
│   │   └── styles/            # Glassmorphic CSS Theme & Design Tokens
│
└── release/
    └── Ragam.exe              # Standalone Windows x64 Executable
```

---

## 💻 Development Setup

### Prerequisites
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 18+](https://nodejs.org/)

### 1. Start the Frontend Dev Server
```bash
cd Ragam.UI
npm install
npm run dev
```

### 2. Launch the Desktop Application
```bash
cd Ragam.App
dotnet run
```
*The app automatically detects `http://localhost:5173` and attaches for instant Hot Module Replacement (HMR).*

---

## 📦 Building the Standalone Release Executable

1. **Build the React Frontend**:
   ```bash
   cd Ragam.UI
   npm run build
   ```

2. **Publish the Self-Contained `.exe`**:
   ```bash
   cd Ragam.App
   dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o ../release
   ```
   *The standalone executable with embedded UI and custom icon will be generated at `release/Ragam.exe`.*

---

## 📄 License & Terms of Use

This project is licensed under the **[PolyForm Noncommercial License 1.0.0](LICENSE)**.

- ✅ **Permitted**: Personal use, learning, research, non-commercial modification, and contributions.
- ❌ **Prohibited**: Any commercial use, selling, monetization, subscription gating, or financial gain derived from this software or its source code.
