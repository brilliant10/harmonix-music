/**
 * HarmoniX Music Player - Lyrics Manager
 * Integrasi lirik lagu sinkron (LRC / Karaoke Mode) & teks lirik penuh (Plain Lyrics)
 * Sumber: lrclib.net (100% Free Open-Source API) dengan fallback serverless /api/lyrics
 */

class LyricsManager {
  constructor() {
    this.cacheKey = 'HarmoniX_Lyrics_Cache';
    this.currentTrackId = null;
    this.currentLyrics = null;
    this.activeLineIndex = -1;
    this.isFetching = false;
  }

  cleanQuery(title, artist = '') {
    if (!title) return '';
    let t = title;
    // Hapus tag tambahan umum pada YouTube: (Official Music Video), [Official Audio], (Lyric Video), dll.
    t = t.replace(/[\(\[\{].*?(official|music video|video|lyric|audio|visualizer|mv|lirik|remastered|hd|4k|hq|cover).*?[\)\]\}]/gi, '');
    t = t.replace(/\|\s*(official|music video|video|audio|lyric).*/gi, '');
    t = t.replace(/\s+/g, ' ').trim();
    if (artist && t.toLowerCase().includes(artist.toLowerCase())) {
      t = t.replace(new RegExp(artist, 'gi'), '').replace(/^[\s\-:|]+|[\s\-:|]+$/g, '').trim();
    }
    return t || title;
  }

  // Parse format LRC menjadi array [{ time: seconds, text: string }]
  parseLRC(lrcText) {
    if (!lrcText || typeof lrcText !== 'string') return [];
    const lines = lrcText.split(/\r?\n/);
    const parsed = [];
    const timeRegex = /\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\]/g;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      let match;
      const timestamps = [];
      while ((match = timeRegex.exec(line)) !== null) {
        const mins = parseInt(match[1], 10);
        const secs = parseFloat(match[2]);
        timestamps.push(mins * 60 + secs);
      }

      const text = line.replace(/\[\d{2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim();
      for (const time of timestamps) {
        parsed.push({ time, text });
      }
    }

    parsed.sort((a, b) => a.time - b.time);
    return parsed;
  }

  // Cari indeks baris lirik aktif berdasarkan currentTime pemutar lagu
  getActiveLineIndex(currentTime, offset = 0.2) {
    if (!this.currentLyrics || !this.currentLyrics.parsedLines || this.currentLyrics.parsedLines.length === 0) {
      return -1;
    }
    const lines = this.currentLyrics.parsedLines;
    const time = currentTime + offset;

    let low = 0;
    let high = lines.length - 1;
    let found = -1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lines[mid].time <= time) {
        found = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return found;
  }

  // Ambil lirik dari cache lokal
  getCachedLyrics(trackId) {
    try {
      const cache = JSON.parse(localStorage.getItem(this.cacheKey) || '{}');
      return cache[trackId] || null;
    } catch (e) {
      return null;
    }
  }

  // Simpan lirik ke cache lokal
  setCachedLyrics(trackId, data) {
    try {
      const cache = JSON.parse(localStorage.getItem(this.cacheKey) || '{}');
      const keys = Object.keys(cache);
      if (keys.length > 120) {
        delete cache[keys[0]];
      }
      cache[trackId] = data;
      localStorage.setItem(this.cacheKey, JSON.stringify(cache));
    } catch (e) {
      console.warn('Gagal menyimpan cache lirik:', e);
    }
  }

  // Ambil lirik lagu dari API atau cache
  async fetchLyrics(track, customQuery = '') {
    if (!track) return null;
    const trackId = track.id || track.youtubeId || `${track.title}_${track.artist}`;
    this.currentTrackId = trackId;

    if (!customQuery) {
      const cached = this.getCachedLyrics(trackId);
      if (cached) {
        this.currentLyrics = cached;
        return cached;
      }
    }

    this.isFetching = true;
    let result = null;

    const cleanTitle = this.cleanQuery(track.title, track.artist);
    const searchQuery = customQuery || `${track.artist} ${cleanTitle}`.trim();

    // 1. Coba koneksi langsung ke lrclib.net
    try {
      if (!customQuery && track.artist && cleanTitle) {
        const getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(track.artist)}`;
        const res = await fetch(getUrl);
        if (res.ok) {
          result = await res.json();
        }
      }

      if (!result || (!result.plainLyrics && !result.syncedLyrics)) {
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`;
        const res = await fetch(searchUrl);
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            const synced = list.find(item => item.syncedLyrics);
            result = synced || list[0];
          }
        }
      }
    } catch (directErr) {
      console.warn('Direct lrclib fetch gagal, mencoba serverless fallback:', directErr);
    }

    // 2. Fallback melalui serverless proxy /api/lyrics
    if (!result || (!result.plainLyrics && !result.syncedLyrics)) {
      try {
        const proxyUrl = `/api/lyrics?q=${encodeURIComponent(searchQuery)}&track=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(track.artist || '')}`;
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const json = await res.json();
          if (json.status === 'success' && json.data) {
            result = json.data;
          }
        }
      } catch (proxyErr) {
        console.warn('Proxy lyrics fetch gagal:', proxyErr);
      }
    }

    this.isFetching = false;

    if (result && (result.plainLyrics || result.syncedLyrics)) {
      const parsedLines = result.syncedLyrics ? this.parseLRC(result.syncedLyrics) : [];
      const lyricData = {
        trackId,
        title: result.trackName || track.title,
        artist: result.artistName || track.artist,
        plainLyrics: result.plainLyrics || '',
        syncedLyrics: result.syncedLyrics || '',
        parsedLines,
        isSynced: parsedLines.length > 0,
        instrumental: result.instrumental || false
      };

      this.currentLyrics = lyricData;
      this.setCachedLyrics(trackId, lyricData);
      return lyricData;
    }

    this.currentLyrics = null;
    return null;
  }
}

// Global instance
const Lyrics = new LyricsManager();
window.Lyrics = Lyrics;

export { Lyrics, LyricsManager };
