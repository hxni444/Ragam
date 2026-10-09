# 🎵 RAGAM

A modern, fast, source-available desktop music player built with **.NET 8 (C#)**, **Microsoft WebView2**, and **React 19 (TypeScript)**.

---

## 📥 Download RAGAM

Get the latest version of RAGAM instantly.

| Platform / Package | Download Link | Description |
| :--- | :--- | :--- |
| **🚀 Windows Setup (Recommended)** | [**`Ragam-win-Setup.exe`**](https://github.com/hxni444/Ragam/raw/main/release/Ragam-win-Setup.exe) | One-click installer with automatic background updates & desktop shortcuts. |
| **📦 Portable Edition (.zip)** | [**`Ragam-win-Portable.zip`**](https://github.com/hxni444/Ragam/raw/main/release/Ragam-win-Portable.zip) | No installation required. Unzip and run `Ragam.exe` anywhere. |
| **📱 Android APK (arm64-v8a)** | [**`app-arm64-release.apk`**](https://github.com/hxni444/Ragam/raw/main/release/app-arm64-release.apk) | Direct APK installer for Android devices (ARM64). |

> 💡 *You can also download individual releases and delta packages directly from the [**GitHub Releases Page**](https://github.com/hxni444/Ragam/releases).*

---

## ✨ Key Features

- 🎧 **Ad-Free & High-Fidelity Audio**: Crystal clear high-fidelity audio playback with zero interruptions or ads.
- 🎤 **Synchronized Lyrics**: Real-time karaoke-style word highlights and line-by-line scrolling lyrics.
- 🎨 **Sleek Glassmorphic UI**: Modern dark design system in theme orange (`#FF5400`), smooth micro-interactions, liquid frosted glass headers, and a custom frameless window with native Aero Snap support.
- 📋 **Library & Offline Playlists**: Manage favorites, custom playlists, and local listening history stored in a local-first SQLite database.
- 🔄 **Seamless Auto-Updates**: Fast delta updates powered by Velopack that download and apply in seconds.
- 🚀 **Fast & Native Windows App**: Lightweight, self-contained desktop experience with instant startup and smooth performance.

---

## 🏗️ Architecture

```
Ragam/
├── Ragam.App/                  # .NET 8 WPF Host & Core Services
│   ├── Data/                  # Local SQLite DbContext (Favorites, History, Playlists)
│   ├── Interop/               # BridgeHandler (Bidirectional WebMessage IPC between React & C#)
│   ├── Models/                # Track, Playlist, Album, and Lyrics Data Models
│   ├── Services/              # Audio, Lyrics, Database, Update, and Discord RPC Services
│   ├── MainWindow.xaml        # Borderless WindowChrome host for WebView2
│   └── app.ico                # Custom multi-resolution app icon
│
├── Ragam.UI/                   # React 19 + Vite + TypeScript Frontend
│   ├── src/
│   │   ├── components/        # PlayerBar, SyncedLyricsView, NowPlayingView, QueueDrawer, Sidebar, TitleBar, AuthModal, AddToLibraryMenu, UpdateModal
│   │   ├── context/           # PlayerContext & State Management
│   │   ├── pages/             # HomePage, SearchPage, LibraryPage, ArtistPage, AlbumPage
│   │   ├── services/          # NativeBridge RPC client & Firebase Authentication
│   │   └── styles/            # Glassmorphic CSS Theme & Design Tokens
│
└── release/
    ├── Ragam-win-Setup.exe    # Velopack Setup Installer
    ├── Ragam-win-Portable.zip # Portable Release Bundle
    └── app-arm64-release.apk  # Android APK Package (ARM64)
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

1. **Install Velopack CLI** (one-time):
   ```bash
   dotnet tool install -g vpk
   ```

2. **Build the React Frontend & Copy Assets**:
   ```bash
   cd Ragam.UI
   npm run build
   # Copy build output to Ragam.App/wwwroot
   ```

3. **Publish the Self-Contained Binary**:
   ```bash
   cd Ragam.App
   dotnet publish -c Release -r win-x64 --self-contained true -o ../bin/publish
   ```

4. **Pack Release with Velopack**:
   ```bash
   vpk pack -u Ragam -v 2.0.5 -p ../bin/publish -e Ragam.exe --packTitle "RAGAM" --packAuthors "Hani" -i app.ico -o ../release
   ```

---

## 📄 License & Terms of Use

This project is licensed under the **[PolyForm Noncommercial License 1.0.0](LICENSE)** (Source-Available with Noncommercial Restrictions).

- ✅ **Permitted**: Personal use, learning, non-commercial research, non-commercial modifications, and open contributions.
- ❌ **Strictly Prohibited**: Any commercial use, business application, selling, paid distribution, monetization, subscription gating, or financial gain derived from this software, its binary distributions, or its source code.
