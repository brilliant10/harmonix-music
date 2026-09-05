/**
 * HarmoniX Music Player - LocalStorage Persistence Module
 */

const STORAGE_KEYS = {
  LIKED: 'harmonix_liked_songs',
  PLAYLISTS: 'harmonix_playlists',
  HISTORY: 'harmonix_history',
  SETTINGS: 'harmonix_settings'
};

export const Storage = {
  // --- Liked Songs ---
  getLikedSongs() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LIKED);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load liked songs:', e);
      return [];
    }
  },

  isLiked(trackId) {
    if (!trackId) return false;
    const liked = this.getLikedSongs();
    return liked.some(t => String(t.id) === String(trackId));
  },

  toggleLike(track) {
    if (!track || !track.id) return false;
    let liked = this.getLikedSongs();
    const index = liked.findIndex(t => String(t.id) === String(track.id));
    let isNowLiked = false;

    if (index >= 0) {
      liked.splice(index, 1);
      isNowLiked = false;
    } else {
      liked.unshift(track);
      isNowLiked = true;
    }

    try {
      localStorage.setItem(STORAGE_KEYS.LIKED, JSON.stringify(liked));
    } catch (e) {
      console.error('Failed to save liked songs:', e);
    }
    return isNowLiked;
  },

  // --- Playlists ---
  getPlaylists() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PLAYLISTS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load playlists:', e);
    }

    // Default starter playlists
    const defaults = [
      {
        id: 'pl-favorites',
        name: 'My Vibes 🎧',
        description: 'Koleksi lagu favorit pilihanmu',
        tracks: []
      },
      {
        id: 'pl-chill',
        name: 'Chill & Relax ☕',
        description: 'Lofi & santai untuk fokus atau istirahat',
        tracks: []
      }
    ];
    this.savePlaylists(defaults);
    return defaults;
  },

  savePlaylists(playlists) {
    try {
      localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
    } catch (e) {
      console.error('Failed to save playlists:', e);
    }
  },

  createPlaylist(name, description = '') {
    if (!name || !name.trim()) return null;
    const playlists = this.getPlaylists();
    const newPlaylist = {
      id: 'pl-' + Date.now(),
      name: name.trim(),
      description: description.trim() || 'Playlist kustom',
      tracks: []
    };
    playlists.push(newPlaylist);
    this.savePlaylists(playlists);
    return newPlaylist;
  },

  deletePlaylist(playlistId) {
    let playlists = this.getPlaylists();
    playlists = playlists.filter(p => p.id !== playlistId);
    this.savePlaylists(playlists);
    return playlists;
  },

  addToPlaylist(playlistId, track) {
    const playlists = this.getPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl || !track) return false;

    // Don't add duplicate
    if (!pl.tracks.some(t => String(t.id) === String(track.id))) {
      pl.tracks.push(track);
      this.savePlaylists(playlists);
      return true;
    }
    return false;
  },

  removeFromPlaylist(playlistId, trackId) {
    const playlists = this.getPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) return false;

    pl.tracks = pl.tracks.filter(t => String(t.id) !== String(trackId));
    this.savePlaylists(playlists);
    return true;
  },

  // --- History ---
  getHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  addToHistory(track) {
    if (!track) return;
    let history = this.getHistory();
    // Remove if already exists to push to front
    history = history.filter(t => String(t.id) !== String(track.id));
    history.unshift({ ...track, playedAt: Date.now() });
    if (history.length > 50) history.pop(); // Max 50 items
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch (e) {}
  },

  // --- Settings ---
  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : {
        volume: 0.8,
        eqPreset: 'flat',
        eqGains: [0, 0, 0, 0, 0],
        visualizerMode: 'bars',
        shuffle: false,
        repeat: 'off' // 'off', 'all', 'one'
      };
    } catch (e) {
      return { volume: 0.8, eqPreset: 'flat', eqGains: [0, 0, 0, 0, 0], visualizerMode: 'bars', shuffle: false, repeat: 'off' };
    }
  },

  saveSettings(settings) {
    try {
      const current = this.getSettings();
      const updated = { ...current, ...settings };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    } catch (e) {}
  }
};
