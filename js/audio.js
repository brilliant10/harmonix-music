/**
 * HarmoniX Music Player - Unified Audio Engine (YouTube IFrame + HTML5 Audio)
 * Menjamin suara selalu keluar dengan kualitas terbaik dan bebas masalah CORS
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
    // HTML5 Audio untuk file lokal & streaming radio
    this.audio = new Audio();
    this.audio.preload = 'metadata';

    // State pemutar
    this.currentTrack = null;
    this.queue = [];
    this.queueIndex = -1;
    this.isPlaying = false;
    this.isMuted = false;
    this.volume = 0.8;
    this.shuffle = false;
    this.repeat = 'off'; // 'off' | 'all' | 'one'

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
      error: []
    };

    this.loadSavedState();
    this.initHtml5AudioEvents();
    this.initYouTubeAPI();
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
                this.emit('playState', true);
              } else if (event.data === YT.PlayerState.PAUSED) {
                this.isPlaying = false;
                this.emit('playState', false);
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
      if (!this.isCurrentTrackYouTube()) {
        this.isPlaying = true;
        this.emit('playState', true);
      }
    });

    this.audio.addEventListener('pause', () => {
      if (!this.isCurrentTrackYouTube()) {
        this.isPlaying = false;
        this.emit('playState', false);
      }
    });

    this.audio.addEventListener('ended', () => {
      if (!this.isCurrentTrackYouTube()) {
        this.handleTrackEnded();
      }
    });

    this.audio.addEventListener('error', (e) => {
      if (!this.isCurrentTrackYouTube()) {
        console.warn('Audio playback error:', e);
        this.emit('error', 'Gagal memutar audio lokal.');
      }
    });
  }

  // Timer reguler untuk update posisi seekbar & durasi
  startTimeTracker() {
    if (this.timeTrackerInterval) clearInterval(this.timeTrackerInterval);

    this.timeTrackerInterval = setInterval(() => {
      if (!this.isPlaying || !this.currentTrack) return;

      if (this.isCurrentTrackYouTube() && this.ytPlayer && this.isYtReady) {
        try {
          const cur = this.ytPlayer.getCurrentTime() || 0;
          const dur = this.ytPlayer.getDuration() || (this.currentTrack ? this.currentTrack.duration : 0);
          this.emit('timeUpdate', { currentTime: cur, duration: dur });
        } catch (e) {}
      } else if (!this.isCurrentTrackYouTube() && this.audio) {
        this.emit('timeUpdate', {
          currentTime: this.audio.currentTime || 0,
          duration: this.audio.duration || (this.currentTrack ? this.currentTrack.duration : 0)
        });
      }
    }, 250);
  }

  isCurrentTrackYouTube() {
    return this.currentTrack && (this.currentTrack.source === 'youtube' || !!this.currentTrack.videoId);
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
    Storage.addToHistory(track);
    this.emit('trackChange', track);

    // 1. Jika lagu dari YouTube
    if (this.isCurrentTrackYouTube()) {
      // Hentikan audio HTML5 jika sedang berjalan
      this.audio.pause();
      this.audio.currentTime = 0;

      const videoId = track.videoId || track.id.replace('yt-', '');

      if (this.isYtReady && this.ytPlayer) {
        try {
          this.ytPlayer.unMute();
          this.ytPlayer.setVolume(this.volume * 100);
          this.ytPlayer.loadVideoById(videoId);
          this.ytPlayer.playVideo();
          this.isPlaying = true;
          this.emit('playState', true);
        } catch (e) {
          console.warn('YT loadVideoById error:', e);
        }
      } else {
        this.pendingYtVideoId = videoId;
      }
    } 
    // 2. Jika lagu lokal atau radio internet
    else {
      // Hentikan YouTube player jika sedang berjalan
      if (this.isYtReady && this.ytPlayer) {
        try {
          this.ytPlayer.stopVideo();
        } catch (e) {}
      }

      try {
        this.audio.src = track.streamUrl;
        this.audio.volume = this.volume;
        this.audio.muted = this.isMuted;
        await this.audio.play();
        this.isPlaying = true;
        this.emit('playState', true);
      } catch (e) {
        console.warn('HTML5 audio play error:', e);
      }
    }
  }

  play() {
    if (this.isCurrentTrackYouTube()) {
      if (this.ytPlayer && this.isYtReady) {
        this.ytPlayer.playVideo();
      }
    } else {
      this.audio.play();
    }
  }

  pause() {
    if (this.isCurrentTrackYouTube()) {
      if (this.ytPlayer && this.isYtReady) {
        this.ytPlayer.pauseVideo();
      }
    } else {
      this.audio.pause();
    }
    this.isPlaying = false;
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
        return;
      }
    }

    this.playTrack(this.queue[this.queueIndex]);
  }

  prev() {
    if (this.queue.length === 0) return;

    // Jika lagu sudah jalan > 3 detik, ulang dari awal
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

    if (this.isCurrentTrackYouTube() && this.ytPlayer && this.isYtReady) {
      this.ytPlayer.seekTo(seconds, true);
    } else if (this.audio && this.audio.duration) {
      this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration));
    }
  }

  setVolume(fraction) {
    const val = Math.max(0, Math.min(1, fraction));
    this.volume = val;
    this.isMuted = val === 0;

    // Update HTML5 audio
    this.audio.volume = val;
    this.audio.muted = this.isMuted;

    // Update YouTube audio
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

  // Equalizer presets (untuk local audio)
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
