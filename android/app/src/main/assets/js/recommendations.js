/**
 * HarmoniX Music Player - Smart Music Recommendation Engine
 * Memberikan saran lagu otomatis berdasarkan kebiasaan mendengar dan lagu yang sedang diputar
 */

import { Storage } from './storage.js';
import { MusicAPI, STARTER_HITS } from './api.js';

class RecommendationEngine {
  constructor() {
    this.cache = new Map();
  }

  // Analisis profil selera musik pengguna dari riwayat & lagu yang disukai
  getUserTasteProfile() {
    const history = Storage.getHistory();
    const liked = Storage.getLikedSongs();
    
    // Gabungkan riwayat & liked songs (liked songs bernilai bobot ganda)
    const combinedTracks = [...liked, ...liked, ...history];

    if (combinedTracks.length === 0) {
      return {
        topArtists: [],
        topGenres: [],
        favoriteTrackIds: new Set(),
        totalTracks: 0,
        isNewUser: true
      };
    }

    const artistCounts = {};
    const genreCounts = {};
    const favoriteTrackIds = new Set();

    combinedTracks.forEach(t => {
      if (!t) return;
      favoriteTrackIds.add(String(t.id));

      // Bersihkan nama artis (hilangkan fitur, VEVO, dll)
      const cleanArtist = this.cleanArtistName(t.artist || '');
      if (cleanArtist && cleanArtist.length > 1 && !cleanArtist.toLowerCase().includes('unknown')) {
        artistCounts[cleanArtist] = (artistCounts[cleanArtist] || 0) + 1;
      }

      const genre = (t.genre || 'Pop').trim();
      if (genre && genre !== 'Musik' && genre !== 'YouTube Music') {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      }
    });

    // Urutkan artis & genre teratas
    const topArtists = Object.entries(artistCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([artist, count]) => ({ artist, count }));

    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([genre, count]) => ({ genre, count }));

    return {
      topArtists,
      topGenres,
      favoriteTrackIds,
      totalTracks: combinedTracks.length,
      isNewUser: false
    };
  }

  // Bersihkan nama artis dari embel-embel
  cleanArtistName(name) {
    if (!name) return '';
    return name
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/\s*VEVO$/i, '')
      .replace(/\s*Official\s*Channel$/i, '')
      .replace(/\s*Music$/i, '')
      .trim();
  }

  // Ambil rekomendasi yang dipersonalisasi untuk halaman Beranda
  async getPersonalizedRecommendations(limit = 12) {
    const profile = this.getUserTasteProfile();

    // Jika pengguna baru belum punya riwayat, berikan starter hits pilihan
    if (profile.isNewUser || profile.topArtists.length === 0) {
      return {
        reason: 'Rekomendasi Populer Untukmu ✨',
        tracks: STARTER_HITS.slice(0, limit)
      };
    }

    const topArtist = profile.topArtists[0]?.artist;
    const topGenre = profile.topGenres[0]?.genre || 'indonesia';

    const cacheKey = `rec_${topArtist}_${topGenre}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let recommendedTracks = [];
    let reasonText = `Berdasarkan seleramu: ${topArtist} & ${topGenre}`;

    try {
      // 1. Cari hits dari artis favorit teratas
      if (topArtist) {
        const artistTracks = await MusicAPI.searchTracks(`${topArtist} lagu hits terpopuler`, 15);
        recommendedTracks.push(...artistTracks);
      }

      // 2. Ambil trending dari genre terfavorit
      if (topGenre) {
        const genreTracks = await MusicAPI.getTrending(topGenre.toLowerCase(), 1);
        recommendedTracks.push(...genreTracks);
      }
    } catch (e) {
      console.warn('Gagal memuat rekomendasi personal:', e);
    }

    // 3. Fallback jika hasil sedikit
    if (recommendedTracks.length < 6) {
      recommendedTracks.push(...STARTER_HITS);
    }

    // 4. Acak & deduplikasi
    const uniqueTracks = [];
    const seenIds = new Set();

    for (const track of recommendedTracks) {
      if (!track || !track.id) continue;
      const idStr = String(track.id);
      if (!seenIds.has(idStr)) {
        seenIds.add(idStr);
        uniqueTracks.push(track);
      }
      if (uniqueTracks.length >= limit) break;
    }

    const result = {
      reason: reasonText,
      topArtist,
      topGenre,
      tracks: uniqueTracks
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  // Rekomendasi lagu serupa secara langsung saat sebuah lagu sedang diputar (Real-time Up Next)
  async getSimilarTracks(currentTrack, limit = 10) {
    if (!currentTrack) return [];

    const cacheKey = `similar_${currentTrack.id}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const artistClean = this.cleanArtistName(currentTrack.artist);
    let results = [];

    try {
      // Cari lagu dari artis yang sama atau lagu serupa
      const query = artistClean && artistClean !== 'YouTube' && artistClean !== 'Artis'
        ? `${artistClean} lagu terbaik hits`
        : `${currentTrack.title} lagu serupa`;

      results = await MusicAPI.searchTracks(query, limit + 5);
    } catch (e) {
      console.warn('Gagal memuat lagu serupa:', e);
    }

    // Filter agar lagu yang sedang diputar tidak muncul lagi di rekomendasi serupa
    const filtered = results.filter(t => String(t.id) !== String(currentTrack.id));
    const finalTracks = filtered.slice(0, limit);

    if (finalTracks.length === 0) {
      const fallbacks = STARTER_HITS.filter(t => String(t.id) !== String(currentTrack.id));
      return fallbacks.slice(0, limit);
    }

    this.cache.set(cacheKey, finalTracks);
    return finalTracks;
  }

  // Pilih 1 lagu rekomendasi otomatis saat antrean playlist habis (Autoplay / Endless Music)
  async getAutoPlayTrack(currentQueue = [], history = []) {
    const queueIds = new Set(currentQueue.map(t => String(t.id)));
    const lastTrack = currentQueue[currentQueue.length - 1] || history[0];

    if (lastTrack) {
      const similar = await this.getSimilarTracks(lastTrack, 8);
      for (const track of similar) {
        if (!queueIds.has(String(track.id))) {
          return track;
        }
      }
    }

    // Fallback dari Starter Hits
    for (const track of STARTER_HITS) {
      if (!queueIds.has(String(track.id))) {
        return track;
      }
    }

    return STARTER_HITS[0];
  }
}

export const Recommendations = new RecommendationEngine();
