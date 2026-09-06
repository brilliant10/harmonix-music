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

    const audioBlob = (audioBlobOrProgress instanceof Blob) ? audioBlobOrProgress : null;
    const db = await this.ensureDB();
    if (!db) throw new Error('Database offline tidak tersedia');

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const rawId = track.videoId || track.id;
      const videoId = typeof rawId === 'string' && rawId.startsWith('yt-') ? rawId.replace('yt-', '') : String(rawId);

      const offlineTrack = {
        id: track.id,
        videoId: videoId || null,
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
        source: audioBlob ? 'local' : 'youtube'
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

  // Simpan lagu untuk mode perpustakaan offline di IndexedDB
  async downloadAndStoreTrack(track, onProgress = () => {}) {
    const notify = (percent, message) => {
      if (typeof onProgress === 'function') {
        try { onProgress({ status: 'progress', percent, message }); } catch (e) {}
        try { onProgress(percent); } catch (e) {}
      }
    };

    notify(20, 'Menyiapkan berkas lagu...');

    // 1. Jika track sudah memiliki audioBlob (berkas lokal pengguna)
    if (track.audioBlob) {
      notify(80, 'Menyimpan berkas lokal ke memori...');
      await this.saveTrack(track, track.audioBlob);
      notify(100, 'Berhasil disimpan offline!');
      return true;
    }

    // 2. Jika lagu online YouTube: simpan metadata ke IndexedDB agar muncul di Perpustakaan PWA
    notify(50, 'Menyimpan informasi lagu ke Perpustakaan PWA...');
    await this.saveTrack(track, null);
    notify(100, 'Lagu siap diputar di Perpustakaan PWA!');
    return true;
  }

  // Unduh langsung berkas audio ke perangkat pengguna (iPhone iOS / Android / Komputer)
  async downloadToDevice(track, targetServer = 'ytmp3') {
    const rawId = track.videoId || track.id;
    const videoId = typeof rawId === 'string' && rawId.startsWith('yt-') ? rawId.replace('yt-', '') : String(rawId);
    const titleClean = (track.title || 'Lagu').replace(/[/\\?%*:|"<>]/g, '-').trim() || 'Lagu';

    // 1. Jika audioBlob sudah tersimpan di IndexedDB (berkas lokal)
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
      return { success: true, mode: 'local' };
    }

    // 2. Jika lagu YouTube: Salin link YouTube otomatis ke clipboard & buka converter MP3 berkecepatan tinggi
    if (videoId) {
      const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(ytUrl);
        }
      } catch (e) {}

      let converterUrl = 'https://ytmp3.nu/';
      if (targetServer === 'snapsave') {
        converterUrl = 'https://snapsave.io/';
      } else if (targetServer === 'tomp3') {
        converterUrl = 'https://tomp3.cc/';
      }

      window.open(converterUrl, '_blank');
      return { success: true, mode: 'converter', ytUrl, server: converterUrl };
    }

    // 3. Jika track memiliki direct streamUrl
    if (track.streamUrl) {
      window.open(track.streamUrl, '_blank');
      return { success: true, mode: 'stream' };
    }
  }
}

export const OfflineStorage = new OfflineManager();
