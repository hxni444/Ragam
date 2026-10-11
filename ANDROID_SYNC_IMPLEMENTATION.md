# 📱 Android (Kotlin) Real-Time Music Sync Guide

This document provides a production-ready implementation for synchronizing **Current Playing Song** and **Listening History** between the **Ragam Desktop App** and an **Android (Kotlin)** mobile application using Firebase Firestore.

---

## 🏗️ 1. Architecture Overview

### Real-Time Event-Driven Sync (No Polling)
- **Zero HTTP Polling**: The Android app uses Firestore's real-time snapshot listeners over WebSockets (`Flow` / `addSnapshotListener`).
- **Anchored Playhead Interpolation**:
  Desktop updates Firestore **only on events** (Song change, Play/Pause, Seek, Stop). Android computes the live playhead progress locally without spamming database reads:
  $$\text{currentPositionSec} = \text{isPlaying} ? \left(\text{positionSec} + \frac{\text{System.currentTimeMillis}() - \text{timestampMs}}{1000.0}\right) : \text{positionSec}$$

### Account Identification (`syncId`)
Desktop signs in with **YouTube Music**, extracting the user's Google Email (`user@gmail.com`). Android signs in with **Google**. Both devices normalize the email into the exact same document ID:
```kotlin
fun getSyncId(email: String?, uid: String): String {
    return if (!email.isNullOrBlank()) {
        "u_" + email.trim().lowercase().replace(Regex("[^a-z0-9]"), "_")
    } else {
        uid
    }
}
```
*Example*: `john.doe@gmail.com` $\to$ `u_john_doe_gmail_com`.

---

## 📦 2. Gradle Setup

Add Firebase and Coroutines dependencies to your `app/build.gradle.kts`:

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    id("com.google.gms.google-services")
}

dependencies {
    // Firebase BoM
    implementation(platform("com.google.firebase:firebase-bom:33.9.0"))
    implementation("com.google.firebase:firebase-firestore-ktx")
    implementation("com.google.firebase:firebase-auth-ktx")

    // Google Sign-In
    implementation("com.google.android.gms:play-services-auth:21.3.0")

    // Coroutines & Lifecycle
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")

    // Image Loading (Coil for Jetpack Compose)
    implementation("io.coil-kt:coil-compose:2.7.0")
}
```

Make sure your `google-services.json` downloaded from your Firebase project (`layam-7b80f`) is placed in the `app/` folder.

---

## 🧱 3. Data Models (`SyncModels.kt`)

Create `SyncModels.kt`:

```kotlin
package com.ragam.music.sync

import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName

@IgnoreExtraProperties
data class TrackDto(
    val id: String = "",
    val title: String = "",
    val artist: String = "",
    val album: String = "",
    val duration: Long = 0L, // in seconds
    val thumbnailUrl: String = ""
)

@IgnoreExtraProperties
data class CloudNowPlayingState(
    val userId: String = "",
    val track: TrackDto? = null,
    @get:PropertyName("isPlaying")
    @set:PropertyName("isPlaying")
    var isPlaying: Boolean = false,
    val positionSec: Double = 0.0,
    val timestampMs: Long = 0L,
    val deviceName: String = "",
    val volume: Double = 1.0,
    val repeatMode: String = "off",
    @get:PropertyName("isShuffle")
    @set:PropertyName("isShuffle")
    var isShuffle: Boolean = false
)

@IgnoreExtraProperties
data class CloudHistoryItem(
    var docId: String = "",
    val userId: String = "",
    val track: TrackDto? = null,
    val playedAtMs: Long = 0L,
    val device: String = ""
)
```

---

## 🛰️ 4. Repository Layer (`MusicSyncRepository.kt`)

Create `MusicSyncRepository.kt` to expose reactive Kotlin `Flow`s from Firestore:

```kotlin
package com.ragam.music.sync

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

class MusicSyncRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance()
) {

    /**
     * Resolves the deterministic sync ID matching Ragam Desktop
     */
    fun getActiveSyncId(): String? {
        val user = auth.currentUser ?: return null
        val email = user.email
        return if (!email.isNullOrBlank()) {
            "u_" + email.trim().lowercase().replace(Regex("[^a-z0-9]"), "_")
        } else {
            user.uid
        }
    }

    /**
     * Observes real-time Now Playing changes for the current user
     */
    fun observeNowPlaying(): Flow<CloudNowPlayingState?> = callbackFlow {
        val syncId = getActiveSyncId()
        if (syncId == null) {
            trySend(null)
            close()
            return@callbackFlow
        }

        val docRef = firestore.collection("users")
            .document(syncId)
            .collection("playback")
            .document("current")

        val listener = docRef.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }

            if (snapshot != null && snapshot.exists()) {
                val state = snapshot.toObject(CloudNowPlayingState::class.java)
                trySend(state)
            } else {
                trySend(null)
            }
        }

        awaitClose { listener.remove() }
    }

    /**
     * Observes real-time Listening History in descending order
     */
    fun observeHistory(limit: Long = 50): Flow<List<CloudHistoryItem>> = callbackFlow {
        val syncId = getActiveSyncId()
        if (syncId == null) {
            trySend(emptyList())
            close()
            return@callbackFlow
        }

        val colRef = firestore.collection("users")
            .document(syncId)
            .collection("history")
            .orderBy("playedAtMs", Query.Direction.DESCENDING)
            .limit(limit)

        val listener = colRef.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }

            if (snapshot != null) {
                val items = snapshot.documents.mapNotNull { doc ->
                    doc.toObject(CloudHistoryItem::class.java)?.apply {
                        this.docId = doc.id
                    }
                }
                trySend(items)
            } else {
                trySend(emptyList())
            }
        }

        awaitClose { listener.remove() }
    }
}
```

---

## 🧠 5. ViewModel Layer (`SyncPlayerViewModel.kt`)

Handles playhead interpolation (progress bar progression) locally:

```kotlin
package com.ragam.music.sync

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class SyncPlayerViewModel(
    private val repository: MusicSyncRepository = MusicSyncRepository()
) : ViewModel() {

    private val _nowPlaying = MutableStateFlow<CloudNowPlayingState?>(null)
    val nowPlaying: StateFlow<CloudNowPlayingState?> = _nowPlaying.asStateFlow()

    private val _currentPositionSec = MutableStateFlow(0.0)
    val currentPositionSec: StateFlow<Double> = _currentPositionSec.asStateFlow()

    private val _history = MutableStateFlow<List<CloudHistoryItem>>(emptyList())
    val history: StateFlow<List<CloudHistoryItem>> = _history.asStateFlow()

    private var interpolatorJob: Job? = null

    init {
        // Collect real-time Now Playing updates
        viewModelScope.launch {
            repository.observeNowPlaying().collect { state ->
                _nowPlaying.value = state
                startPlayheadInterpolator(state)
            }
        }

        // Collect real-time History updates
        viewModelScope.launch {
            repository.observeHistory().collect { list ->
                _history.value = list
            }
        }
    }

    /**
     * Interpolates playback position locally every 500ms when song is playing
     */
    private fun startPlayheadInterpolator(state: CloudNowPlayingState?) {
        interpolatorJob?.cancel()

        if (state == null || state.track == null) {
            _currentPositionSec.value = 0.0
            return
        }

        val basePosition = state.positionSec
        val timestamp = state.timestampMs
        val duration = state.track.duration.toDouble()
        val isPlaying = state.isPlaying

        if (!isPlaying) {
            _currentPositionSec.value = basePosition
            return
        }

        interpolatorJob = viewModelScope.launch {
            while (isActive) {
                val now = System.currentTimeMillis()
                val elapsedSec = (now - timestamp) / 1000.0
                val calculated = (basePosition + elapsedSec).coerceIn(0.0, if (duration > 0) duration else 99999.0)
                _currentPositionSec.value = calculated
                delay(500)
            }
        }
    }
}
```

---

## 🎨 6. Jetpack Compose UI (`SyncScreen.kt`)

A modern dark glassmorphic UI displaying the desktop track in real time:

```kotlin
package com.ragam.music.sync

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Laptop
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage

@Composable
fun SyncScreen(
    viewModel: SyncPlayerViewModel,
    modifier: Modifier = Modifier
) {
    val nowPlaying by viewModel.nowPlaying.collectAsStateWithLifecycle()
    val positionSec by viewModel.currentPositionSec.collectAsStateWithLifecycle()
    val history by viewModel.history.collectAsStateWithLifecycle()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF0F0F0F))
            .padding(16.dp)
    ) {
        Text(
            text = "Connected Playback",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            modifier = Modifier.padding(bottom = 16.dp)
        )

        // Now Playing Card
        AnimatedVisibility(visible = nowPlaying?.track != null) {
            nowPlaying?.track?.let { track ->
                NowPlayingCard(
                    track = track,
                    isPlaying = nowPlaying?.isPlaying == true,
                    deviceName = nowPlaying?.deviceName ?: "Desktop",
                    currentPositionSec = positionSec
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Listening History",
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color(0xFFE0E0E0),
            modifier = Modifier.padding(bottom = 8.dp)
        )

        // History List
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            items(history, key = { it.docId }) { item ->
                item.track?.let { historyTrack ->
                    HistoryItemRow(track = historyTrack)
                }
            }
        }
    }
}

@Composable
fun NowPlayingCard(
    track: TrackDto,
    isPlaying: Boolean,
    deviceName: String,
    currentPositionSec: Double
) {
    val duration = track.duration.coerceAtLeast(1L).toFloat()
    val progress = (currentPositionSec.toFloat() / duration).coerceIn(0f, 1f)

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E1E1E)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Device Indicator
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(bottom = 12.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Laptop,
                    contentDescription = null,
                    tint = Color(0xFFFF5400),
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "Playing on $deviceName",
                    fontSize = 12.sp,
                    color = Color(0xFFFF5400),
                    fontWeight = FontWeight.Medium
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                AsyncImage(
                    model = track.thumbnailUrl,
                    contentDescription = track.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(64.dp)
                        .clip(RoundedCornerShape(8.dp))
                )

                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = track.title,
                        color = Color.White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = track.artist,
                        color = Color(0xFFAAAAAA),
                        fontSize = 13.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Icon(
                    imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                    contentDescription = if (isPlaying) "Playing" else "Paused",
                    tint = Color(0xFFFF5400),
                    modifier = Modifier.size(36.dp)
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Progress Bar
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp)),
                color = Color(0xFFFF5400),
                trackColor = Color(0xFF333333)
            )

            Spacer(modifier = Modifier.height(6.dp))

            // Timestamps
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(text = formatSeconds(currentPositionSec.toLong()), fontSize = 11.sp, color = Color(0xFF888888))
                Text(text = formatSeconds(track.duration), fontSize = 11.sp, color = Color(0xFF888888))
            }
        }
    }
}

@Composable
fun HistoryItemRow(track: TrackDto) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Color(0xFF181818))
            .padding(10.dp)
    ) {
        AsyncImage(
            model = track.thumbnailUrl,
            contentDescription = track.title,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(6.dp))
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = track.title,
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = track.artist,
                color = Color(0xFF888888),
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Text(
            text = formatSeconds(track.duration),
            color = Color(0xFF666666),
            fontSize = 12.sp
        )
    }
}

fun formatSeconds(seconds: Long): String {
    val m = seconds / 60
    val s = seconds % 60
    return String.format("%d:%02d", m, s)
}
```

---

## 🔒 7. Firestore Security Rules Reminder

In your Firebase Console, make sure your security rules allow the authenticated mobile user to access their corresponding sync documents:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 💡 Summary of Sync Flow
1. **Desktop Player Starts Track**: Writes once to `users/{u_email}/playback/current` and `users/{u_email}/history/{id}`.
2. **Android Receives Push via Firestore WebSocket**: `observeNowPlaying()` emits immediately with zero lag.
3. **Android Interpolates Progress Locally**: The progress bar updates every 500ms using Coroutines without executing any database reads or incurring Firestore costs.
