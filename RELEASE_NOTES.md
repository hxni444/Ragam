# RAGAM v2.1.2 Release Notes

### What's New
- **🔄 Unified Listening History**:
  - Seamless synchronization between tracks played inside Ragam and remote YouTube Music history.
  - Songs played in Ragam now appear immediately at the top of your History tab.
  - Remote listening activity from YouTube Music web and mobile apps automatically syncs into Ragam.
  - Smart deduplication prevents duplicate plays while preserving chronological playback order.
- **🎵 Click-to-Expand Now Playing**:
  - Clicking anywhere on the floating PlayerBar (album cover, track info, or player bar background) now smoothly expands the full **Now Playing** overlay.
  - Interactive player controls (Play, Next, Prev, Shuffle, Repeat, Radio, Scrubber, Volume, Like, Add to Playlist) remain protected from accidental expansion.
- **🛡️ Resilient Audio Playback**:
  - Fallback title and artist query resolution ensures stream playback never breaks, even for tracks with non-standard or restricted video IDs.
  - Robust thread-safe webview message dispatching.
