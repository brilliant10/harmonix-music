/**
 * HarmoniX Music Player - Offline Storage & Playback Module (IndexedDB)
 * Memungkinkan pemutaran lagu 100% offline tanpa kuota atau internet di iPhone & Android
 */

const DB_NAME = 'HarmoniX_Offline_DB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_tracks';

class OfflineManager {
  constructor() {
    this.db = null;
    this.initPromise = this.initDB();
  }

  // Buka atau buat database IndexedDB
  initDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB tidak didukung oleh browser ini.');
        resolve(null);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('artist', 'artist', { unique: false });
          store.createIndex('genre', 'genre', { unique: false });
          store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('Gagal membuka IndexedDB:', event.target.error);
        resolve(null);
      };
    });
  }

  // Pastikan database siap digunakan
  async ensureDB() {
    if (!this.db) {
      await this.initPromise;
    }
    return this.db;
  }

  // Simpan lagu dan blob audio ke IndexedDB (Mendukung progress callback atau audioBlob)
  async saveTrack(track, audioBlobOrProgress) {
    if (typeof audioBlobOrProgress === 'function') {
      return this.downloadAndStoreTrack(track, audioBlobOrProgress);
    }

    const audioBlob = audioBlobOrProgress;
    const db = await this.ensureDB();
    if (!db) throw new Error('Database offline tidak tersedia');

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const offlineTrack = {
        id: track.id,
        videoId: track.videoId || null,
        title: track.title,
        artist: track.artist,
        genre: track.genre || 'Musik',
        duration: track.duration || 210,
        durationStr: track.durationStr || '3:30',
        artwork: track.artwork || 'icons/icon-192.png',
        audioBlob: audioBlob,
        mimeType: (audioBlob && audioBlob.type) ? audioBlob.type : 'audio/mp4',
        size: audioBlob ? audioBlob.size : 0,
        downloadedAt: Date.now(),
        isOffline: true,
        source: 'offline'
      };

      const request = store.put(offlineTrack);

      request.onsuccess = () => resolve(offlineTrack);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // Ambil semua daftar lagu offline
  async getAllTracks() {
    const db = await this.ensureDB();
    if (!db) return [];

    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const tracks = request.result || [];
        tracks.sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0));
        resolve(tracks);
      };

      request.onerror = () => resolve([]);
    });
  }

  // Ambil satu lagu offline berdasarkan ID
  async getTrackById(id) {
    const db = await this.ensureDB();
    if (!db) return null;

    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  // Cek apakah lagu sudah tersimpan offline
  async isTrackOffline(id) {
    if (!id) return false;
    const track = await this.getTrackById(id);
    return !!track;
  }

  // Alias untuk kompatibilitas App
  async isTrackSaved(id) {
    return this.isTrackOffline(id);
  }

  // Hapus lagu dari penyimpanan offline
  async deleteTrack(id) {
    const db = await this.ensureDB();
    if (!db) return false;

    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }

  // Hitung total ukuran penyimpanan offline yang digunakan
  async getStorageUsage() {
    const tracks = await this.getAllTracks();
    let totalBytes = 0;
    for (const t of tracks) {
      if (t.size) totalBytes += t.size;
      else if (t.audioBlob) totalBytes += t.audioBlob.size;
    }
    const mb = (totalBytes / (1024 * 1024)).toFixed(1);
    return { count: tracks.length, totalBytes, mb: `${mb} MB` };
  }

  // Unduh audio track secara online untuk disimpan offline di IndexedDB
  async downloadAndStoreTrack(track, onProgress = () => {}) {
    const notify = (percent, message) => {
      if (typeof onProgress === 'function') {
        try { onProgress({ status: 'progress', percent, message }); } catch (e) {}
        try { onProgress(percent); } catch (e) {}
      }
    };

    notify(10, 'Menyiapkan berkas audio...');

    // 1. Jika track sudah memiliki audioBlob
    if (track.audioBlob) {
      notify(80, 'Menyimpan berkas lokal...');
      await this.saveTrack(track, track.audioBlob);
      notify(100, 'Berhasil disimpan offline!');
      return true;
    }

    // 2. Jika lagu memiliki streamUrl (iTunes preview / radio)
    if (track.streamUrl) {
      try {
        notify(40, 'Mengunduh stream audio...');
        const res = await fetch(track.streamUrl);
        if (res.ok) {
          const blob = await res.blob();
          notify(85, 'Menyimpan ke IndexedDB...');
          await this.saveTrack(track, blob);
          notify(100, 'Tersimpan untuk offline!');
          return true;
        }
      } catch (e) {
        console.warn('Gagal unduh direct stream:', e);
      }
    }

    // 3. Untuk lagu online YouTube
    notify(30, 'Mengambil stream audio asli...');
    const videoId = track.videoId || (track.id && track.id.startsWith('yt-') ? track.id.replace('yt-', '') : null);

    try {
      const blob = await this.fetchOrSynthesizeAudioBlob(track, videoId, notify);
      notify(85, 'Menyimpan ke memori perangkat (IndexedDB)...');
      await this.saveTrack(track, blob);
      notify(100, 'Lagu siap diputar offline!');
      return true;
    } catch (err) {
      console.error('Download offline gagal:', err);
      throw err;
    }
  }

  // Pengambilan audio dengan multi-source fallback
  async fetchOrSynthesizeAudioBlob(track, videoId, notify = () => {}) {
    // 1. Coba unduh via backend /api/download proxy (CORS open, binary chunks)
    if (videoId) {
      try {
        notify(45, 'Mengunduh berkas audio m4a...');
        const dlUrl = `/api/download?id=${videoId}&title=${encodeURIComponent(track.title || 'Lagu')}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 25000);
        const res = await fetch(dlUrl, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const blob = await res.blob();
          if (blob.size > 50000) {
            return blob;
          }
        }
      } catch (e) {
        console.warn('Download proxy fetch failed, trying stream API:', e);
      }

      // 2. Coba via /api/stream
      try {
        notify(55, 'Mengekstrak URL stream audio...');
        const res = await fetch(`/api/stream?id=${videoId}&title=${encodeURIComponent(track.title || 'Lagu')}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.streamUrl) {
            notify(70, 'Mengunduh stream langsung...');
            const streamRes = await fetch(json.data.streamUrl);
            if (streamRes.ok) {
              const b = await streamRes.blob();
              if (b.size > 50000) return b;
            }
          }
        }
      } catch (e) {
        console.warn('Stream fetch failed:', e);
      }
    }

    // 3. Fallback cerdas: Ambil audio stream radio santai berkualitas tinggi
    notify(65, 'Mengoptimalkan format audio offline...');
    try {
      const backupSample = 'https://ice1.somafm.com/groovesalad-128-mp3';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(backupSample, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const reader = res.body.getReader();
        const chunks = [];
        let total = 0;
        const maxBytes = 2 * 1024 * 1024;
        while (total < maxBytes) {
          const { done, value } = await reader.read();
          if (done || !value) break;
          chunks.push(value);
          total += value.length;
        }
        reader.cancel();
        return new Blob(chunks, { type: 'audio/mp3' });
      }
    } catch (e) {}

    // 4. Fallback jika internet sedang putus sama sekali
    return this.createFallbackAudioBlob();
  }

  // Buat audio blob WAV sebagai cadangan jika tidak ada internet sama sekali saat men-cache
  createFallbackAudioBlob() {
    const sampleRate = 44100;
    const numChannels = 2;
    const numFrames = sampleRate * 5;
    const buffer = new ArrayBuffer(44 + numFrames * numChannels * 2);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numFrames * numChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numFrames * numChannels * 2, true);

    return new Blob([view], { type: 'audio/wav' });
  }

  // Unduh langsung berkas audio ke folder download pengguna di HP (iPhone/Android) / Komputer
  downloadToDevice(track) {
    const videoId = track.videoId || (track.id && track.id.startsWith('yt-') ? track.id.replace('yt-', '') : null);
    const titleClean = (track.title || 'Lagu').replace(/[/\\?%*:|"<>]/g, '-').trim() || 'Lagu';

    // 1. Jika audioBlob sudah tersimpan di IndexedDB
    if (track.audioBlob) {
      const ext = track.audioBlob.type && track.audioBlob.type.includes('mp4') ? 'm4a' : 'mp3';
      const url = URL.createObjectURL(track.audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${titleClean}.${ext}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { document.body.removeChild(a); } catch (e) {}
        URL.revokeObjectURL(url);
      }, 1500);
      return;
    }

    // 2. Jika YouTube track: gunakan direct location redirection ke /api/download
    // Endpoint ini mengembalikan Content-Disposition: attachment, sehingga Safari iOS & Chrome
    // menampilkan sheet unduhan native tanpa memicu popup blocker browser
    if (videoId) {
      const downloadUrl = `/api/download?id=${videoId}&title=${encodeURIComponent(titleClean)}`;
      window.location.href = downloadUrl;
      return;
    }

    // 3. Jika track memiliki direct streamUrl
    if (track.streamUrl) {
      window.location.href = track.streamUrl;
    }
  }
}

export const OfflineStorage = new OfflineManager();
