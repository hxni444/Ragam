# RAGAM v2.1.3 Release Notes

### What's New
- **☁️ Real-Time Mobile Playback & History Synchronization**:
  - Connected desktop playback to Firebase Firestore with zero-polling, event-driven WebSocket streams.
  - Automatically synchronizes currently playing song, playhead timestamps, and playback state for mobile companions.
  - Automatically logs listening history to the cloud with full metadata and timestamps.
- **⚡ Direct YouTube Music Sign-In**:
  - Streamlined authentication: clicking "Sign in" directly launches the native YouTube Music sign-in window without intermediary modal dialogs.
  - Automatic Google User ID derivation and local session caching (`ragam_user_id`) for instant cross-device matching.
  - Silent background Firebase session handling ensuring seamless Firestore security rule validation.
- **📱 Android Companion Architecture**:
  - Added complete Kotlin Android sync specification with anchored playhead interpolation (`ANDROID_SYNC_IMPLEMENTATION.md`).

