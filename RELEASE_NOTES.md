# RAGAM v2.1.4 Release Notes

### What's New
- **☁️ Real-Time Mobile Playback & History Synchronization**:
  - Connected desktop playback to Firebase Firestore with zero-polling, event-driven WebSocket streams.
  - Automatically synchronizes currently playing song, playhead timestamps, and playback state for mobile companions.
  - Automatically logs listening history to the cloud with full metadata, timestamps, and guest device fallback.
- **⚡ Streamlined Direct YouTube Music Sign-In**:
  - Removed intermediary authentication popups; clicking "Sign in" directly launches the native YouTube Music sign-in window.
  - Automatic Google User ID derivation and local session caching (`ragam_user_id`) for instant cross-device matching.
  - Silent background Firebase session handling ensuring seamless Firestore security rule validation.
- **🛠️ Automated UI Asset Synchronization**:
  - Added build-time MSBuild synchronization target (`SyncUiDist`) ensuring embedded and local `wwwroot` assets always match the latest UI build.
  - Enhanced multi-level development path resolution in WebView2 host.
- **📱 Android Kotlin Companion Architecture**:
  - Complete Android Kotlin companion implementation guide with anchored playhead interpolation (`ANDROID_SYNC_IMPLEMENTATION.md`).


