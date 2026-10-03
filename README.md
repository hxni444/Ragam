# 🎵 RAGAM

A modern, fast, subscription-free desktop music player built with **.NET 8 (C#)**, **Microsoft WebView2**, and **React 19 (TypeScript)**.

---

## 📥 Download RAGAM for Windows

Get the latest version of RAGAM instantly. Built-in auto-updates will keep your player fresh automatically.

| Package | Download Link | Description |
| :--- | :--- | :--- |
| **🚀 Windows Setup (Recommended)** | [**Download `Ragam-win-Setup.exe`**](https://github.com/hxni444/Ragam/raw/main/release/Ragam-win-Setup.exe) | One-click installer with automatic background updates & desktop shortcuts. |
| **📦 Portable Edition (.zip)** | [**Download `Ragam-win-Portable.zip`**](https://github.com/hxni444/Ragam/raw/main/release/Ragam-win-Portable.zip) | No installation required. Unzip and run `Ragam.exe` anywhere. |

> 💡 *You can also download individual releases from the [**GitHub Releases Page**](https://github.com/hxni444/Ragam/releases).*

---

## ✨ Key Features

- 🎧 **Ad-Free & High-Fidelity Audio**: Crystal clear high-fidelity audio playback with zero interruptions or ads.
- 🎤 **Synchronized Lyrics**: Real-time karaoke-style word highlights and line-by-line scrolling lyrics.
- 🎨 **Sleek Custom UI**: Dark glassmorphic design system in theme orange (`#FF5400`), smooth Framer Motion micro-interactions, and a custom frameless window with native Aero Snap support.
- 📋 **Library & Offline Playlists**: Manage favorites, custom playlists, and local listening history stored in a local-first SQLite database.
- 🔄 **Automatic Self-Updates**: Built-in delta updates powered by Velopack that download in seconds without manual reinstalls.
- 🎮 **Discord Rich Presence**: Live "Listening to..." activity status on Discord with song titles, artists, and live album art.
- 🚀 **Fast & Native Windows App**: Lightweight, self-contained desktop experience with instant startup and smooth performance.

---

## 🏗️ Architecture

```
Ragam/
├── Ragam.App/                  # .NET 8 WPF Host & Core Services
│   ├── Data/                  # Local SQLite DbContext (Favorites, History, Playlists)
│   ├── Interop/               # BridgeHandler (Bidirectional WebMessage IPC between React & C#)
│   ├── Models/                # Track, Playlist, Album, and Lyrics Data Models
│   ├── Services/              # Audio, Lyrics, Update, and Discord RPC Services
│   ├── MainWindow.xaml        # Borderless WindowChrome host for WebView2
│   └── app.ico                # Custom multi-resolution app icon
│
├── Ragam.UI/                   # React 19 + Vite + TypeScript Frontend
│   ├── src/
│   │   ├── components/        # PlayerBar, SyncedLyricsView, QueueDrawer, Sidebar, TitleBar, AuthModal
│   │   ├── context/           # PlayerContext & State Management
│   │   ├── pages/             # HomePage, SearchPage, LibraryPage, ArtistPage, AlbumPage
│   │   ├── services/          # NativeBridge RPC client & Firebase Authentication
│   │   └── styles/            # Glassmorphic CSS Theme & Design Tokens
│
└── release/
    ├── Ragam-win-Setup.exe    # Velopack Setup Installer
    └── Ragam-win-Portable.zip # Portable Release Bundle
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

## 📦 Building Releases with Velopack

1. **Build the React Frontend**:
   ```bash
   cd Ragam.UI
   npm run build
   ```

2. **Publish the Self-Contained Binary**:
   ```bash
   cd Ragam.App
   dotnet publish -c Release -r win-x64 --self-contained true -o ../bin/publish
   ```

3. **Pack with Velopack**:
   ```bash
   vpk pack -u Ragam -v 2.0.5 -p ../bin/publish -e Ragam.exe --packTitle "RAGAM" --packAuthors "Hani" -i app.ico -o ../release
   ```

---

## 📄 License & Terms of Use

This project is licensed under the **[PolyForm Noncommercial License 1.0.0](LICENSE)**.

- ✅ **Permitted**: Personal use, learning, research, non-commercial modification, and contributions.
- ❌ **Prohibited**: Any commercial use, selling, monetization, subscription gating, or financial gain derived from this software or its source code.
