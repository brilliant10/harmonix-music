/**
 * HarmoniX Music Player - Unified Audio Engine (YouTube IFrame + HTML5 Audio + Offline IndexedDB)
 * Menjamin suara selalu keluar dengan kualitas terbaik, bebas CORS, dan mendukung mode offline tanpa internet
 */

import { Storage } from './storage.js';

export const EQ_PRESETS = {
  flat: { name: 'Flat', gains: [0, 0, 0, 0, 0] },
  bass: { name: 'Bass Boost 🔥', gains: [8, 5, 1, 0, -1] },
  pop: { name: 'Pop 🎤', gains: [-1, 2, 4, 3, 2] },
  rock: { name: 'Rock 🎸', gains: [5, 3, -2, 3, 6] },
  electronic: { name: 'Electronic ⚡', gains: [6, 4, 0, 3, 5] },
  vocal: { name: 'Vocal Booster 🎙️', gains: [-3, 0, 6, 4, 1] },
  chill: { name: 'Chill & Lo-Fi ☕', gains: [4, 3, 0, -1, 2] }
};

class AudioEngine {
  constructor() {
    // HTML5 Audio untuk streaming langsung, file lokal, radio, dan offline
    this.audio = document.createElement('audio');
    this.audio.setAttribute('playsinline', 'true');
    this.audio.setAttribute('webkit-playsinline', 'true');
    this.audio.preload = 'auto';
    this.audio.style.display = 'none';
    if (document.body) document.body.appendChild(this.audio);
    else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(this.audio));

    // State pemutar
    this.currentTrack = null;
    this.currentBlobUrl = null;
    this.queue = [];
    this.queueIndex = -1;
    this.isPlaying = false;
    this.isMuted = false;
    this.volume = 0.8;
    this.shuffle = false;
    this.repeat = 'off'; // 'off' | 'all' | 'one'
    this.autoPlayRecommendations = true; // Mode putar otomatis saat antrean habis

    // YouTube IFrame Player instance & status
    this.ytPlayer = null;
    this.isYtReady = false;
    this.pendingYtVideoId = null;
    this.timeTrackerInterval = null;

    // Web Audio API untuk file lokal
    this.audioCtx = null;
    this.analyser = null;
    this.sourceNode = null;
    this.eqFilters = [];

    // Listener callbacks
    this.listeners = {
      trackChange: [],
      playState: [],
      timeUpdate: [],
      durationChange: [],
      queueChange: [],
      volumeChange: [],
      error: [],
      queueEnded: [],
      networkChange: []
    };

    this.isDirectAudioActive = true;
    this.keepaliveAudio = null;

    this.loadSavedState();
    this.initHtml5AudioEvents();
    this.initYouTubeAPI();
    this.initSafariBackgroundKeepalive();
    this.initMediaSession();
    this.initVisibilityListener();
    this.initNetworkListener();
    this.startTimeTracker();
  }

  loadSavedState() {
    const saved = Storage.getSettings();
    if (saved) {
      this.volume = saved.volume !== undefined ? saved.volume : 0.8;
      this.audio.volume = this.volume;
      this.shuffle = !!saved.shuffle;
      this.repeat = saved.repeat || 'off';
    }
  }

  initNetworkListener() {
    window.addEventListener('online', () => {
      this.emit('networkChange', { isOnline: true });
    });
    window.addEventListener('offline', () => {
      this.emit('networkChange', { isOnline: false });
    });
  }

  // --- Inisialisasi YouTube IFrame API ---
  initYouTubeAPI() {
    const initPlayer = () => {
      try {
        this.ytPlayer = new YT.Player('yt-player-frame', {
          height: '100%',
          width: '100%',
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3
          },
          events: {
            onReady: () => {
              this.isYtReady = true;
              this.ytPlayer.setVolume(this.volume * 100);
              this.ytPlayer.unMute();
              if (this.pendingYtVideoId) {
                this.ytPlayer.loadVideoById(this.pendingYtVideoId);
                this.ytPlayer.playVideo();
                this.pendingYtVideoId = null;
              }
            },
            onStateChange: (event) => {
              // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
              if (event.data === YT.PlayerState.PLAYING) {
                this.isPlaying = true;
                this.startSafariKeepalive();
                if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
                this.emit('playState', true);
              } else if (event.data === YT.PlayerState.PAUSED) {
                if (!document.hidden) {
                  this.isPlaying = false;
                  this.stopSafariKeepalive();
                  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
                  this.emit('playState', false);
                }
              } else if (event.data === YT.PlayerState.ENDED) {
                this.handleTrackEnded();
              }
            },
            onError: (err) => {
              console.warn('YouTube playback error, trying next track:', err);
              setTimeout(() => this.next(), 2000);
            }
          }
        });
      } catch (e) {
        console.warn('YT Player init deferred:', e);
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = () => initPlayer();
    }
  }

  // --- Inisialisasi HTML5 Audio ---
  initHtml5AudioEvents() {
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.startSafariKeepalive();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      this.emit('playState', true);
    });

    this.audio.addEventListener('pause', () => {
      if (!this.isCurrentTrackYouTube() || this.isDirectAudioActive) {
        if (!document.hidden) {
          this.isPlaying = false;
          this.stopSafariKeepalive();
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
          this.emit('playState', false);
        }
      }
    });

    this.audio.addEventListener('ended', () => {
      if (!this.isCurrentTrackYouTube() || this.isDirectAudioActive) {
        this.handleTrackEnded();
      }
    });

    this.audio.addEventListener('error', (e) => {
      if (!this.isCurrentTrackYouTube() || this.isDirectAudioActive) {
        console.warn('Audio playback error:', e);
        if (this.isDirectAudioActive && this.currentTrack && this.currentTrack.videoId) {
          this.isDirectAudioActive = false;
          if (this.ytPlayer && this.isYtReady) {
            this.ytPlayer.loadVideoById(this.currentTrack.videoId);
            this.ytPlayer.playVideo();
            return;
          }
        }
        this.emit('error', 'Gagal memutar audio.');
      }
    });
  }

  // --- Safari iOS Background Audio & MediaSession Handlers ---
  initSafariBackgroundKeepalive() {
    const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    try {
      this.keepaliveAudio = document.createElement('audio');
      this.keepaliveAudio.setAttribute('playsinline', 'true');
      this.keepaliveAudio.setAttribute('webkit-playsinline', 'true');
      this.keepaliveAudio.src = SILENT_WAV;
      this.keepaliveAudio.loop = true;
      this.keepaliveAudio.volume = 0.01;
      this.keepaliveAudio.style.display = 'none';
      if (document.body) document.body.appendChild(this.keepaliveAudio);
      else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(this.keepaliveAudio));
    } catch (e) {
      console.warn('Keepalive audio init error:', e);
    }
  }

  startSafariKeepalive() {
    if (this.keepaliveAudio) {
      this.keepaliveAudio.play().catch(() => {});
    }
  }

  stopSafariKeepalive() {
    if (this.keepaliveAudio) {
      try { this.keepaliveAudio.pause(); } catch (e) {}
    }
  }

  initMediaSession() {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) this.seek(details.seekTime);
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        this.seek(Math.max(0, this.getCurrentTime() - offset));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10;
        this.seek(this.getCurrentTime() + offset);
      });
      navigator.mediaSession.setActionHandler('stop', () => this.pause());
    } catch (e) {
      console.warn('MediaSession handler error:', e);
    }
  }

  updateMediaSessionMetadata() {
    if (!('mediaSession' in navigator) || !this.currentTrack) return;
    const track = this.currentTrack;
    const art = track.artwork || 'icons/icon-192.png';

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'HarmoniX Music',
        artist: track.artist || 'HarmoniX',
        album: 'HarmoniX Music Universe',
        artwork: [
          { src: art, sizes: '96x96', type: 'image/png' },
          { src: art, sizes: '128x128', type: 'image/png' },
          { src: art, sizes: '192x192', type: 'image/png' },
          { src: art, sizes: '256x256', type: 'image/png' },
          { src: art, sizes: '512x512', type: 'image/png' }
        ]
      });
      navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
    } catch (e) {
      console.warn('MediaSession metadata error:', e);
    }
  }

  updateMediaSessionPosition(cur, dur) {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    if (dur && dur > 0 && !isNaN(cur) && !isNaN(dur)) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(dur, 1),
          playbackRate: 1,
          position: Math.min(Math.max(0, cur), dur)
        });
      } catch (e) {}
    }
  }

  initVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.isPlaying) {
          this.startSafariKeepalive();
        }
      } else {
        if (this.isPlaying) {
          this.startSafariKeepalive();
        }
      }
    });
  }

  getCurrentTime() {
    if (this.isCurrentTrackYouTube() && !this.isDirectAudioActive && this.ytPlayer && this.isYtReady) {
      try { return this.ytPlayer.getCurrentTime() || 0; } catch (e) { return 0; }
    }
    return this.audio ? (this.audio.currentTime || 0) : 0;
  }

  getDuration() {
    if (this.isCurrentTrackYouTube() && !this.isDirectAudioActive && this.ytPlayer && this.isYtReady) {
      try { return this.ytPlayer.getDuration() || (this.currentTrack ? this.currentTrack.duration : 0); } catch (e) { return 0; }
    }
    return this.audio && this.audio.duration ? this.audio.duration : (this.currentTrack ? this.currentTrack.duration : 0);
  }

  // Timer reguler untuk update posisi seekbar & durasi
  startTimeTracker() {
    if (this.timeTrackerInterval) clearInterval(this.timeTrackerInterval);

    this.timeTrackerInterval = setInterval(() => {
      if (!this.isPlaying || !this.currentTrack) return;

      const cur = this.getCurrentTime();
      const dur = this.getDuration();

      this.emit('timeUpdate', { currentTime: cur, duration: dur });
      this.updateMediaSessionPosition(cur, dur);
    }, 250);
  }

  isCurrentTrackYouTube() {
    if (this.currentTrack && this.currentTrack.audioBlob && (this.currentTrack.source === 'local' || !this.currentTrack.videoId)) {
      return false;
    }
    return !!(this.currentTrack && (
      this.currentTrack.source === 'youtube' ||
      this.currentTrack.videoId ||
      (typeof this.currentTrack.id === 'string' && this.currentTrack.id.startsWith('yt-'))
    ));
  }

  // --- Playback Control ---

  async playTrack(track, newQueue = null) {
    if (!track) return;

    // Kelola Antrean
    if (newQueue && Array.isArray(newQueue)) {
      this.queue = [...newQueue];
      this.queueIndex = this.queue.findIndex(t => String(t.id) === String(track.id));
      if (this.queueIndex === -1) {
        this.queue.unshift(track);
        this.queueIndex = 0;
      }
      this.emit('queueChange', this.queue);
    } else if (!this.queue.some(t => String(t.id) === String(track.id))) {
      this.queue.push(track);
      this.queueIndex = this.queue.length - 1;
      this.emit('queueChange', this.queue);
    } else {
      this.queueIndex = this.queue.findIndex(t => String(t.id) === String(track.id));
    }

    this.currentTrack = track;
    this.isDirectAudioActive = false;
    Storage.addToHistory(track);
    this.emit('trackChange', track);
    this.updateMediaSessionMetadata();

    // 1. Jika lagu berkas lokal (memiliki audioBlob nyata dari unggahan perangkat)
    if (track.audioBlob && (track.source === 'local' || !track.videoId)) {
      if (this.isYtReady && this.ytPlayer) {
        try { this.ytPlayer.stopVideo(); } catch (e) {}
      }

      if (this.currentBlobUrl) {
        URL.revokeObjectURL(this.currentBlobUrl);
        this.currentBlobUrl = null;
      }

      try {
        this.currentBlobUrl = URL.createObjectURL(track.audioBlob);
        this.audio.src = this.currentBlobUrl;
        this.audio.volume = this.volume;
        this.audio.muted = this.isMuted;
        await this.audio.play();
        this.isPlaying = true;
        this.startSafariKeepalive();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
        this.emit('playState', true);
      } catch (e) {
        console.warn('Pemutaran offline berkas lokal gagal:', e);
      }
    }
    // 2. Jika lagu YouTube (Search, Trending, Rekomendasi, maupun Lagu Tersimpan PWA)
    // Memutar 100% FULL lagu menggunakan YouTube IFrame Player (bebas batas 30 detik & bebas blokir)
    else if (this.isCurrentTrackYouTube()) {
      const rawId = track.videoId || track.id;
      const videoId = typeof rawId === 'string' && rawId.startsWith('yt-') ? rawId.replace('yt-', '') : String(rawId);

      this.startSafariKeepalive();
      this.audio.pause();
      this.isDirectAudioActive = false;

      if (this.isYtReady && this.ytPlayer) {
        try {
          this.ytPlayer.unMute();
          this.ytPlayer.setVolume(this.volume * 100);
          this.ytPlayer.loadVideoById(videoId);
          this.ytPlayer.playVideo();
          this.isPlaying = true;
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
          this.emit('playState', true);
        } catch (e) {
          console.warn('YT loadVideoById error:', e);
        }
      } else {
        this.pendingYtVideoId = videoId;
      }
    } 
    // 3. Jika streamUrl biasa (misal Radio internet)
    else if (track.streamUrl) {
      if (this.isYtReady && this.ytPlayer) {
        try { this.ytPlayer.stopVideo(); } catch (e) {}
      }

      try {
        this.audio.src = track.streamUrl;
        this.audio.volume = this.volume;
        this.audio.muted = this.isMuted;
        await this.audio.play();
        this.isPlaying = true;
        this.startSafariKeepalive();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
        this.emit('playState', true);
      } catch (e) {
        console.warn('HTML5 audio play error:', e);
      }
    }
  }

  play() {
    if (this.isCurrentTrackYouTube() && !this.isDirectAudioActive) {
      if (this.ytPlayer && this.isYtReady) {
        this.ytPlayer.playVideo();
      }
    } else {
      this.audio.play().catch(() => {});
    }
    this.startSafariKeepalive();
    this.isPlaying = true;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    this.emit('playState', true);
  }

  pause() {
    if (this.isCurrentTrackYouTube() && !this.isDirectAudioActive) {
      if (this.ytPlayer && this.isYtReady) {
        this.ytPlayer.pauseVideo();
      }
    } else {
      this.audio.pause();
    }
    this.stopSafariKeepalive();
    this.isPlaying = false;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    this.emit('playState', false);
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  handleTrackEnded() {
    if (this.repeat === 'one') {
      this.seek(0);
      this.play();
    } else if (this.repeat === 'all' || this.queueIndex < this.queue.length - 1) {
      this.next();
    } else {
      this.isPlaying = false;
      this.emit('playState', false);
      // Notifikasi antrean habis untuk autoplay rekomendasi
      this.emit('queueEnded', { lastTrack: this.currentTrack, queue: this.queue });
    }
  }

  next() {
    if (this.queue.length === 0) return;

    if (this.shuffle) {
      let nextIndex = Math.floor(Math.random() * this.queue.length);
      if (this.queue.length > 1 && nextIndex === this.queueIndex) {
        nextIndex = (nextIndex + 1) % this.queue.length;
      }
      this.queueIndex = nextIndex;
    } else {
      if (this.queueIndex < this.queue.length - 1) {
        this.queueIndex++;
      } else if (this.repeat === 'all') {
        this.queueIndex = 0;
      } else {
        this.emit('queueEnded', { lastTrack: this.currentTrack, queue: this.queue });
        return;
      }
    }

    this.playTrack(this.queue[this.queueIndex]);
  }

  prev() {
    if (this.queue.length === 0) return;

    let currentSecs = 0;
    if (this.isCurrentTrackYouTube() && this.ytPlayer && this.isYtReady) {
      currentSecs = this.ytPlayer.getCurrentTime() || 0;
    } else {
      currentSecs = this.audio.currentTime || 0;
    }

    if (currentSecs > 3) {
      this.seek(0);
      return;
    }

    if (this.queueIndex > 0) {
      this.queueIndex--;
    } else {
      this.queueIndex = this.queue.length - 1;
    }

    this.playTrack(this.queue[this.queueIndex]);
  }

  seek(seconds) {
    if (isNaN(seconds)) return;

    if (this.isCurrentTrackYouTube() && !this.isDirectAudioActive && this.ytPlayer && this.isYtReady) {
      this.ytPlayer.seekTo(seconds, true);
    } else if (this.audio && this.audio.duration) {
      this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration));
    }
    this.updateMediaSessionPosition(seconds, this.getDuration());
  }

  setVolume(fraction) {
    const val = Math.max(0, Math.min(1, fraction));
    this.volume = val;
    this.isMuted = val === 0;

    this.audio.volume = val;
    this.audio.muted = this.isMuted;

    if (this.ytPlayer && this.isYtReady) {
      this.ytPlayer.setVolume(val * 100);
      if (this.isMuted) this.ytPlayer.mute();
      else this.ytPlayer.unMute();
    }

    Storage.saveSettings({ volume: val });
    this.emit('volumeChange', { volume: val, isMuted: this.isMuted });
  }

  toggleMute() {
    this.isMuted = !this.isMuted;

    if (this.isMuted) {
      this.audio.muted = true;
      if (this.ytPlayer && this.isYtReady) this.ytPlayer.mute();
    } else {
      this.audio.muted = false;
      this.audio.volume = this.volume > 0 ? this.volume : 0.8;
      if (this.ytPlayer && this.isYtReady) {
        this.ytPlayer.unMute();
        this.ytPlayer.setVolume((this.volume > 0 ? this.volume : 0.8) * 100);
      }
    }

    this.emit('volumeChange', { volume: this.volume, isMuted: this.isMuted });
  }

  toggleShuffle() {
    this.shuffle = !this.shuffle;
    Storage.saveSettings({ shuffle: this.shuffle });
    return this.shuffle;
  }

  toggleRepeat() {
    if (this.repeat === 'off') this.repeat = 'all';
    else if (this.repeat === 'all') this.repeat = 'one';
    else this.repeat = 'off';

    Storage.saveSettings({ repeat: this.repeat });
    return this.repeat;
  }

  setEqualizerGains(gains) {
    Storage.saveSettings({ eqGains: gains });
  }

  setEqualizerPreset(presetKey) {
    const preset = EQ_PRESETS[presetKey];
    if (preset) {
      this.setEqualizerGains(preset.gains);
      Storage.saveSettings({ eqPreset: presetKey });
      return preset.gains;
    }
    return null;
  }

  getAnalyser() {
    return this.analyser;
  }

  // --- Event Emitter ---
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(fn => fn(data));
    }
  }
}

export const Player = new AudioEngine();
