/**
 * HarmoniX Music Player - Main Application Controller (Ultra-Premium UI/UX)
 */

import { MusicAPI, RADIO_STATIONS, STARTER_HITS } from './api.js';
import { Player, EQ_PRESETS } from './audio.js';
import { Visualizer } from './visualizer.js';
import { Storage } from './storage.js';
import { OfflineStorage } from './offline.js';
import { Recommendations } from './recommendations.js';
import { Lyrics } from './lyrics.js';

// Application State
const AppState = {
  currentView: 'discover',
  currentGenre: 'indonesia',
  currentQuery: '',
  discoverPage: 1,
  genrePage: 1,
  searchPage: 1,
  currentTrackList: [],
  localTracks: [],
  selectedPlaylistId: null,
  activeTrackMenu: null,
  isVideoMode: false,
  isQueueDrawerOpen: false,
  sleepTimerTimeout: null,
  sleepTimerInterval: null,
  sleepTimerSecondsLeft: 0,
  offlineTracks: [],
  pendingDownloadTrack: null,
  currentDrawerTab: 'queue',
  isLyricsModalOpen: false,
  isFullscreenLyricsActive: false,
  lyricsDisplayMode: 'synced',
  activeLyricLineIndex: -1,
  lastAutoScroll: 0
};

// PWA Installation State & Events
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBox = document.getElementById('sidebar-install-box');
  if (installBox) installBox.classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  showToast('HarmoniX Music Player berhasil dipasang di Desktop!', 'success');
});

// Centralized Track Registry for Safe Event Handlers (Fixes all quotation & syntax errors)
window.HarmoniXTracks = new Map();

function registerTrack(track) {
  if (!track || !track.id) return track;
  window.HarmoniXTracks.set(String(track.id), track);
  return track;
}

function resolveTrack(trackOrId) {
  if (!trackOrId) return null;
  if (typeof trackOrId === 'object') {
    if (trackOrId.id) window.HarmoniXTracks.set(String(trackOrId.id), trackOrId);
    return trackOrId;
  }
  return window.HarmoniXTracks.get(String(trackOrId)) || null;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Helper: Format seconds to mm:ss
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Helper: Show Toast Notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const borderColors = {
    info: 'border-indigo-500 text-indigo-200',
    success: 'border-emerald-500 text-emerald-200',
    error: 'border-rose-500 text-rose-200'
  };

  toast.className = `fixed bottom-24 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border ${borderColors[type] || borderColors.info} shadow-2xl transition-all duration-300 transform translate-y-4 opacity-0`;
  toast.innerHTML = `
    <i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info'}" class="w-5 h-5"></i>
    <span class="text-sm font-semibold">${message}</span>
  `;

  document.body.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('translate-y-4', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// --- View Router ---

function switchView(viewName, meta = null) {
  AppState.currentView = viewName;

  // Update active sidebar nav
  document.querySelectorAll('[data-nav]').forEach(el => {
    if (el.getAttribute('data-nav') === viewName) {
      el.classList.add('bg-indigo-600/20', 'text-indigo-400', 'border-indigo-500/30');
      el.classList.remove('text-slate-400', 'hover:bg-slate-800/50');
    } else {
      el.classList.remove('bg-indigo-600/20', 'text-indigo-400', 'border-indigo-500/30');
      el.classList.add('text-slate-400', 'hover:bg-slate-800/50');
    }
  });

  closeMobileSidebar();
  hideSuggestions();

  const container = document.getElementById('view-container');
  container.innerHTML = `
    <div class="flex items-center justify-center py-24">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  `;

  switch (viewName) {
    case 'discover':
      renderDiscoverView();
      break;
    case 'genres':
      renderGenresView(meta || 'indonesia');
      break;
    case 'radio':
      renderRadioView();
      break;
    case 'local':
      renderLocalView();
      break;
    case 'favorites':
      renderFavoritesView();
      break;
    case 'playlists':
      renderPlaylistsView(meta);
      break;
    case 'history':
      renderHistoryView();
      break;
    case 'offline':
      renderOfflineView();
      break;
    case 'search':
      renderSearchView(meta || '');
      break;
    default:
      renderDiscoverView();
  }
}

// 1. Discover View
async function renderDiscoverView() {
  AppState.discoverPage = 1;
  const container = document.getElementById('view-container');

  container.innerHTML = `
    <div class="space-y-10 animate-fadeIn pb-12">
      
      <!-- Premium Hero Banner -->
      <div class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-950/80 via-purple-950/60 to-slate-950 border border-white/10 p-8 md:p-12 shadow-2xl backdrop-blur-xl">
        <div class="absolute -right-10 -bottom-10 w-96 h-96 bg-indigo-600/25 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -left-10 -top-10 w-96 h-96 bg-purple-600/25 rounded-full blur-3xl pointer-events-none"></div>

        <div class="relative z-10 max-w-2xl space-y-4">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-indigo-400"></i>
            Akses Seluruh Lagu YouTube Tanpa Batas
          </div>
          <h1 class="text-3xl md:text-5xl font-extrabold tracking-tight">
            Putar Lagu Apapun di <span class="text-gradient">HarmoniX</span>
          </h1>
          <p class="text-slate-300 text-sm md:text-base leading-relaxed">
            Dengarkan lagu hits Indonesia, artis mancanegara, lofi santai, radio 24/7, atau putar link YouTube secara gratis dengan suara jernih berkualitas tinggi.
          </p>
          <div class="flex flex-wrap items-center gap-3 pt-2">
            <button id="hero-play-trending" class="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-lg glow-primary transition-all duration-200 transform hover:scale-105 active:scale-95">
              <i data-lucide="play" class="w-5 h-5 fill-current"></i>
              Putar Lagu Hits
            </button>
            <button onclick="window.App.openPasteLinkModal()" class="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-white/10 font-medium transition-all">
              <i data-lucide="link" class="w-4 h-4 text-indigo-400"></i>
              Tempel Link YouTube
            </button>
            <button onclick="window.App.switchView('radio')" class="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-white/10 font-medium transition-all">
              <i data-lucide="radio" class="w-4 h-4 text-rose-400"></i>
              Radio 24/7
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Genre Pills -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i data-lucide="compass" class="w-5 h-5 text-indigo-400"></i> Kategori Populer
          </h2>
          <span class="text-xs text-slate-400">Pilih kategori untuk melihat ribuan lagu</span>
        </div>
        <div class="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
          ${[
            { name: 'Pop Indonesia 🇮🇩', key: 'indonesia' },
            { name: 'Global Top Hits 🌍', key: 'pop' },
            { name: 'Viral TikTok 📱', key: 'tiktok' },
            { name: 'Lagu Galau / Akustik 🍂', key: 'galau' },
            { name: 'Dangdut & Koplo Jawa 🎤', key: 'dangdut' },
            { name: 'Lo-Fi Chill & Focus ☕', key: 'lofi' },
            { name: 'Rock & Alternatif 🎸', key: 'rock' },
            { name: 'Nostalgia 90-2000an 📻', key: 'nostalgia' },
            { name: 'EDM & Party ⚡', key: 'electronic' },
            { name: 'Anime & J-Pop 🎌', key: 'anime' },
            { name: 'K-Pop Universe 🌟', key: 'kpop' }
          ].map(g => `
            <button onclick="window.App.switchView('genres', '${g.key}')" class="px-4 py-2 rounded-xl glass-panel hover:border-indigo-500/50 text-xs font-semibold text-slate-300 hover:text-white whitespace-nowrap transition-all">
              ${g.name}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Rekomendasi Pintar Untukmu (Based on History & Taste) -->
      <div class="space-y-4" id="recommendations-container">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold text-white flex items-center gap-2">
              <i data-lucide="sparkles" class="w-5 h-5 text-amber-400"></i> Rekomendasi Untukmu
            </h2>
            <p id="rec-reason-text" class="text-xs text-slate-400 mt-0.5">Saran lagu cerdas berdasarkan apa yang sering kamu dengar</p>
          </div>
          <button onclick="window.App.refreshPersonalizedRecommendations()" class="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-panel hover:bg-white/5 transition-all">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Segarkan
          </button>
        </div>

        <div id="recommendations-tracks-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          ${renderTrackSkeletons(5)}
        </div>
      </div>

      <!-- Main Trending Grid -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold text-white flex items-center gap-2">
              <i data-lucide="flame" class="w-5 h-5 text-rose-500"></i> Lagu Populer & Viral Terkini
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">Jutaan lagu dari YouTube siap diputar</p>
          </div>
          <button onclick="window.App.switchView('genres', 'indonesia')" class="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
            Lihat Lebih Banyak <i data-lucide="chevron-right" class="w-4 h-4"></i>
          </button>
        </div>

        <div id="discover-tracks-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          ${renderTrackSkeletons(10)}
        </div>

        <!-- Load More Button -->
        <div class="pt-6 text-center">
          <button id="btn-load-more-discover" onclick="window.App.loadMoreDiscover()" class="px-8 py-3 rounded-2xl glass-panel hover:bg-indigo-600 hover:text-white font-semibold text-xs md:text-sm text-slate-300 border border-white/10 shadow-lg glow-primary transition-all">
            Muat Lebih Banyak Lagu dari YouTube ➕
          </button>
        </div>
      </div>

    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  try {
    const tracks = await MusicAPI.getTrending('all', 1);
    AppState.currentTrackList = tracks;
    const grid = document.getElementById('discover-tracks-grid');
    if (grid) {
      grid.innerHTML = tracks.map((t, idx) => renderTrackCard(t, idx, tracks)).join('');
      if (window.lucide) window.lucide.createIcons();
    }

    const heroBtn = document.getElementById('hero-play-trending');
    if (heroBtn && tracks.length > 0) {
      heroBtn.onclick = () => Player.playTrack(tracks[0], tracks);
    }

    // Muat rekomendasi personal
    loadRecommendationsSection();
  } catch (e) {
    console.error(e);
  }
}

async function loadRecommendationsSection() {
  try {
    const recData = await Recommendations.getPersonalizedRecommendations(10);
    const reasonEl = document.getElementById('rec-reason-text');
    if (reasonEl && recData.reason) {
      reasonEl.textContent = recData.reason;
    }
    const recGrid = document.getElementById('recommendations-tracks-grid');
    if (recGrid && recData.tracks) {
      recGrid.innerHTML = recData.tracks.map((t, idx) => renderTrackCard(t, idx, recData.tracks)).join('');
      if (window.lucide) window.lucide.createIcons();
    }
  } catch (e) {
    console.warn('Gagal memuat rekomendasi:', e);
  }
}

// 2. Genres View
async function renderGenresView(selectedGenre = 'indonesia') {
  AppState.currentGenre = selectedGenre;
  AppState.genrePage = 1;

  const genres = [
    { label: 'Pop Indonesia 🇮🇩', key: 'indonesia' },
    { label: 'Global Top Hits 🌍', key: 'pop' },
    { label: 'Viral TikTok 📱', key: 'tiktok' },
    { label: 'Lagu Galau 🍂', key: 'galau' },
    { label: 'Dangdut Koplo 🎤', key: 'dangdut' },
    { label: 'Lo-Fi Chill ☕', key: 'lofi' },
    { label: 'Rock & Alt 🎸', key: 'rock' },
    { label: 'Nostalgia 📻', key: 'nostalgia' },
    { label: 'Akustik Santai 🍃', key: 'acoustic' },
    { label: 'EDM & Dance ⚡', key: 'electronic' },
    { label: 'Hip-Hop / Rap 🎙️', key: 'hiphop' },
    { label: 'Anime & J-Pop 🎌', key: 'anime' },
    { label: 'K-Pop 🌟', key: 'kpop' }
  ];

  const container = document.getElementById('view-container');

  container.innerHTML = `
    <div class="space-y-6 animate-fadeIn pb-12">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
          <i data-lucide="disc-3" class="w-7 h-7 text-indigo-400"></i> Kategori Genre & Musik YouTube
        </h1>
        <p class="text-xs md:text-sm text-slate-400 mt-1">Jelajahi seluruh lagu YouTube berdasarkan genre favorit Anda</p>
      </div>

      <div class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        ${genres.map(g => `
          <button onclick="window.App.switchView('genres', '${g.key}')" class="px-5 py-2.5 rounded-xl font-medium text-xs md:text-sm transition-all whitespace-nowrap ${g.key.toLowerCase() === selectedGenre.toLowerCase() ? 'bg-indigo-600 text-white shadow-lg glow-primary font-bold' : 'glass-panel text-slate-300 hover:text-white'}">
            ${g.label}
          </button>
        `).join('')}
      </div>

      <div class="space-y-4">
        <h2 class="text-lg font-semibold text-slate-200 flex items-center gap-2">
          Daftar Lagu: <span class="text-indigo-400 uppercase font-bold">${selectedGenre}</span>
        </h2>
        <div id="genre-tracks-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          ${renderTrackSkeletons(10)}
        </div>

        <div class="pt-6 text-center">
          <button id="btn-load-more-genre" onclick="window.App.loadMoreGenre()" class="px-8 py-3 rounded-2xl glass-panel hover:bg-indigo-600 hover:text-white font-semibold text-xs md:text-sm text-slate-300 border border-white/10 shadow-lg glow-primary transition-all">
            Muat Lebih Banyak Lagu (${selectedGenre.toUpperCase()}) ➕
          </button>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  try {
    const tracks = await MusicAPI.getTrending(selectedGenre, 1);
    AppState.currentTrackList = tracks;
    const grid = document.getElementById('genre-tracks-grid');
    if (grid) {
      grid.innerHTML = tracks.map((t, idx) => renderTrackCard(t, idx, tracks)).join('');
      if (window.lucide) window.lucide.createIcons();
    }
  } catch (e) {
    console.error(e);
  }
}

// 3. Search View
async function renderSearchView(query) {
  AppState.currentQuery = query;
  AppState.searchPage = 1;

  const container = document.getElementById('view-container');

  container.innerHTML = `
    <div class="space-y-6 animate-fadeIn pb-12">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <i data-lucide="search" class="w-7 h-7 text-indigo-400"></i> Hasil Pencarian YouTube
          </h1>
          <p class="text-xs md:text-sm text-slate-400 mt-1">Menampilkan hasil untuk "<span class="text-indigo-300 font-bold">${query}</span>"</p>
        </div>
        <button onclick="window.App.switchView('discover')" class="text-xs text-slate-400 hover:text-white">
          ✕ Hapus Pencarian
        </button>
      </div>

      <div id="search-tracks-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        ${renderTrackSkeletons(10)}
      </div>

      <div class="pt-6 text-center">
        <button id="btn-load-more-search" onclick="window.App.loadMoreSearch()" class="px-8 py-3 rounded-2xl glass-panel hover:bg-indigo-600 hover:text-white font-semibold text-xs md:text-sm text-slate-300 border border-white/10 shadow-lg glow-primary transition-all">
          Cari Lebih Banyak Lagu di YouTube ➕
        </button>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  try {
    const tracks = await MusicAPI.searchTracks(query, 30, 1);
    AppState.currentTrackList = tracks;
    const grid = document.getElementById('search-tracks-grid');
    if (grid) {
      if (tracks.length === 0) {
        grid.innerHTML = `
          <div class="col-span-full py-16 text-center text-slate-400">
            <i data-lucide="search-x" class="w-12 h-12 mx-auto mb-2 text-slate-600"></i>
            <p>Tidak ada hasil untuk pencarian "${query}". Coba kata kunci lain.</p>
          </div>
        `;
      } else {
        grid.innerHTML = tracks.map((t, idx) => renderTrackCard(t, idx, tracks)).join('');
      }
      if (window.lucide) window.lucide.createIcons();
    }
  } catch (e) {
    console.error(e);
  }
}

// 4. Radio View
function renderRadioView() {
  const container = document.getElementById('view-container');
  const stations = MusicAPI.getRadioStations();

  container.innerHTML = `
    <div class="space-y-6 animate-fadeIn pb-12">
      <div>
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold mb-2">
          <span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
          24/7 Live Broadcast
        </div>
        <h1 class="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
          <i data-lucide="radio" class="w-7 h-7 text-rose-400"></i> Stasiun Radio Online 24 Jam
        </h1>
        <p class="text-xs md:text-sm text-slate-400 mt-1">Siaran live audio berkualitas tinggi non-stop (Lo-Fi, Synthwave, Jazz Lounge, Chillout)</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        ${stations.map(station => `
          <div class="glass-card rounded-2xl p-5 border border-white/10 flex flex-col justify-between group">
            <div class="flex items-start gap-4">
              <div class="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                <img src="${station.artwork}" alt="${station.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                <div class="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors"></div>
                <div class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold">
                  LIVE
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <span class="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">${station.genre}</span>
                <h3 class="text-base font-bold text-white truncate group-hover:text-indigo-400 transition-colors">${station.title}</h3>
                <p class="text-xs text-slate-400 truncate mt-0.5">${station.artist}</p>
              </div>
            </div>

            <div class="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs text-slate-400">
                <span class="w-2 h-2 rounded-full bg-emerald-400"></span> Siaran Aktif
              </div>
              <button onclick="window.App.playStation('${station.id}')" class="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all">
                <i data-lucide="play" class="w-4 h-4 fill-current"></i> Putar Stasiun
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

// 5. Local Music View
function renderLocalView() {
  const container = document.getElementById('view-container');

  container.innerHTML = `
    <div class="space-y-6 animate-fadeIn pb-12">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <i data-lucide="folder-music" class="w-7 h-7 text-indigo-400"></i> Musik Lokal (Offline)
          </h1>
          <p class="text-xs md:text-sm text-slate-400 mt-1">Putar file audio di komputer Anda tanpa internet (MP3, WAV, FLAC, M4A, OGG)</p>
        </div>
        <label class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs md:text-sm cursor-pointer shadow-lg glow-primary transition-all">
          <i data-lucide="upload" class="w-4 h-4"></i>
          <span>Pilih File Audio</span>
          <input type="file" id="local-file-input" multiple accept="audio/*" class="hidden" />
        </label>
      </div>

      <div id="drag-drop-zone" class="border-2 border-dashed border-indigo-500/30 hover:border-indigo-400 rounded-3xl p-8 md:p-12 text-center glass-panel transition-all cursor-pointer">
        <div class="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
          <i data-lucide="folder-up" class="w-8 h-8"></i>
        </div>
        <h3 class="text-lg font-bold text-white mb-1">Tarik & Letakkan File Musik di Sini</h3>
        <p class="text-xs md:text-sm text-slate-400 max-w-md mx-auto">
          Mendukung format .mp3, .wav, .flac, .ogg, .m4a. Diputar langsung dari komputer secara aman.
        </p>
      </div>

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-slate-200">
            Daftar File Lokal (${AppState.localTracks.length})
          </h2>
          ${AppState.localTracks.length > 0 ? `
            <button onclick="window.App.playAllLocal()" class="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              <i data-lucide="play-circle" class="w-4 h-4"></i> Putar Semua
            </button>
          ` : ''}
        </div>

        <div id="local-track-list">
          ${AppState.localTracks.length === 0 ? `
            <div class="py-12 text-center text-slate-500 text-sm">
              Belum ada file musik lokal. Tarik file audio ke kotak di atas!
            </div>
          ` : `
            <div class="space-y-2">
              ${AppState.localTracks.map((t, idx) => renderTrackRow(t, idx, AppState.localTracks)).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const dropZone = document.getElementById('drag-drop-zone');
  const fileInput = document.getElementById('local-file-input');

  if (dropZone) {
    dropZone.onclick = () => fileInput && fileInput.click();
    dropZone.ondragover = (e) => {
      e.preventDefault();
      dropZone.classList.add('border-indigo-400', 'bg-indigo-900/20');
    };
    dropZone.ondragleave = () => {
      dropZone.classList.remove('border-indigo-400', 'bg-indigo-900/20');
    };
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-indigo-400', 'bg-indigo-900/20');
      if (e.dataTransfer.files) {
        handleLocalFiles(e.dataTransfer.files);
      }
    };
  }

  if (fileInput) {
    fileInput.onchange = (e) => {
      if (e.target.files) {
        handleLocalFiles(e.target.files);
      }
    };
  }
}

function handleLocalFiles(files) {
  const audioFiles = Array.from(files).filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(f.name));

  if (audioFiles.length === 0) {
    showToast('Tidak ada file audio yang valid dipilih.', 'error');
    return;
  }

  audioFiles.forEach(file => {
    const objectUrl = URL.createObjectURL(file);
    let nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    let artist = 'File Lokal';
    let title = nameWithoutExt;

    if (nameWithoutExt.includes(' - ')) {
      const parts = nameWithoutExt.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }

    const track = {
      id: 'local-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      title: title,
      artist: artist,
      genre: 'Local Audio',
      duration: 0,
      artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
      streamUrl: objectUrl,
      isLocal: true,
      source: 'local'
    };

    AppState.localTracks.push(track);
  });

  showToast(`Berhasil menambahkan ${audioFiles.length} file lokal!`, 'success');
  renderLocalView();
}

// 6. Favorites View
function renderFavoritesView() {
  const likedTracks = Storage.getLikedSongs();
  const container = document.getElementById('view-container');

  container.innerHTML = `
    <div class="space-y-6 animate-fadeIn pb-12">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <i data-lucide="heart" class="w-7 h-7 text-rose-500 fill-rose-500"></i> Lagu Favorit
          </h1>
          <p class="text-xs md:text-sm text-slate-400 mt-1">Koleksi lagu yang telah Anda sukai (${likedTracks.length} lagu)</p>
        </div>
        ${likedTracks.length > 0 ? `
          <button onclick="window.App.playAllFavorites()" class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-semibold text-xs md:text-sm shadow-lg glow-pink transition-all">
            <i data-lucide="play" class="w-4 h-4 fill-current"></i> Putar Semua
          </button>
        ` : ''}
      </div>

      <div>
        ${likedTracks.length === 0 ? `
          <div class="py-20 text-center text-slate-500 glass-panel rounded-3xl p-8">
            <i data-lucide="heart-off" class="w-12 h-12 mx-auto mb-3 text-slate-600"></i>
            <h3 class="text-base font-semibold text-slate-300 mb-1">Belum Ada Lagu Favorit</h3>
            <p class="text-xs text-slate-500">Klik ikon hati pada lagu manapun untuk menambahkannya ke sini.</p>
          </div>
        ` : `
          <div class="space-y-2">
            ${likedTracks.map((t, idx) => renderTrackRow(t, idx, likedTracks)).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

// 7. Playlists View
function renderPlaylistsView(selectedId = null) {
  const playlists = Storage.getPlaylists();
  const container = document.getElementById('view-container');

  if (selectedId) {
    const pl = playlists.find(p => p.id === selectedId);
    if (!pl) {
      renderPlaylistsView(null);
      return;
    }

    container.innerHTML = `
      <div class="space-y-6 animate-fadeIn pb-12">
        <div class="flex items-center gap-3">
          <button onclick="window.App.switchView('playlists')" class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
            <i data-lucide="arrow-left" class="w-5 h-5"></i>
          </button>
          <span class="text-xs text-slate-400">Kembali ke Daftar Playlist</span>
        </div>

        <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6 glass-panel rounded-3xl p-6 md:p-8">
          <div class="w-40 h-40 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-xl glow-primary flex-shrink-0">
            <i data-lucide="list-music" class="w-16 h-16"></i>
          </div>
          <div class="flex-1 text-center sm:text-left space-y-2">
            <span class="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Playlist Kustom</span>
            <h1 class="text-2xl md:text-4xl font-extrabold text-white">${pl.name}</h1>
            <p class="text-sm text-slate-400">${pl.description || 'Tidak ada deskripsi'}</p>
            <div class="text-xs text-slate-500 pt-1">${pl.tracks.length} Lagu</div>
            <div class="flex items-center justify-center sm:justify-start gap-3 pt-3">
              ${pl.tracks.length > 0 ? `
                <button onclick="window.App.playPlaylist('${pl.id}')" class="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs md:text-sm font-semibold shadow-md glow-primary transition-all">
                  <i data-lucide="play" class="w-4 h-4 fill-current"></i> Putar Playlist
                </button>
              ` : ''}
              <button onclick="window.App.deletePlaylist('${pl.id}')" class="px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-semibold border border-rose-500/20 transition-all">
                Hapus Playlist
              </button>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          ${pl.tracks.length === 0 ? `
            <div class="py-16 text-center text-slate-500 glass-panel rounded-2xl p-6">
              <p>Playlist ini masih kosong. Cari lagu dan tambahkan ke sini!</p>
            </div>
          ` : `
            ${pl.tracks.map((t, idx) => renderTrackRow(t, idx, pl.tracks, pl.id)).join('')}
          `}
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    return;
  }

  container.innerHTML = `
    <div class="space-y-6 animate-fadeIn pb-12">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <i data-lucide="library" class="w-7 h-7 text-indigo-400"></i> Playlist Saya
          </h1>
          <p class="text-xs md:text-sm text-slate-400 mt-1">Buat dan atur playlist lagu favorit Anda</p>
        </div>
        <button onclick="window.App.openCreatePlaylistModal()" class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs md:text-sm shadow-lg glow-primary transition-all">
          <i data-lucide="plus-circle" class="w-4 h-4"></i> Buat Playlist Baru
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        ${playlists.map(pl => `
          <div onclick="window.App.switchView('playlists', '${pl.id}')" class="glass-card rounded-2xl p-5 border border-white/10 flex items-center gap-4 cursor-pointer group">
            <div class="w-16 h-16 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md flex-shrink-0 group-hover:scale-105 transition-transform">
              <i data-lucide="music" class="w-7 h-7"></i>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-base font-bold text-white truncate group-hover:text-indigo-400 transition-colors">${pl.name}</h3>
              <p class="text-xs text-slate-400 truncate mt-0.5">${pl.description || 'Playlist'}</p>
              <span class="text-[11px] text-indigo-400 font-medium">${pl.tracks.length} Lagu</span>
            </div>
            <i data-lucide="chevron-right" class="w-5 h-5 text-slate-500 group-hover:text-white transition-colors"></i>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

// 8. History View
function renderHistoryView() {
  const history = Storage.getHistory();
  const container = document.getElementById('view-container');

  container.innerHTML = `
    <div class="space-y-6 animate-fadeIn pb-12">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <i data-lucide="history" class="w-7 h-7 text-indigo-400"></i> Riwayat Terakhir
          </h1>
          <p class="text-xs md:text-sm text-slate-400 mt-1">Lagu yang baru saja Anda putar (${history.length} lagu)</p>
        </div>
        ${history.length > 0 ? `
          <button onclick="window.App.playAllHistory()" class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs md:text-sm shadow-md transition-all">
            <i data-lucide="play" class="w-4 h-4 fill-current"></i> Putar Ulang
          </button>
        ` : ''}
      </div>

      <div>
        ${history.length === 0 ? `
          <div class="py-16 text-center text-slate-500 glass-panel rounded-2xl p-6">
            <p>Belum ada riwayat lagu.</p>
          </div>
        ` : `
          <div class="space-y-2">
            ${history.map((t, idx) => renderTrackRow(t, idx, history)).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

// 9. Offline Music View (PWA & Local IndexedDB)
async function renderOfflineView() {
  const container = document.getElementById('view-container');
  container.innerHTML = `
    <div class="space-y-6 animate-fadeIn pb-12">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 md:p-8 rounded-3xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/20 shadow-xl backdrop-blur-xl">
        <div class="space-y-2">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold">
            <i data-lucide="cloud-off" class="w-3.5 h-3.5"></i> Mode 100% Offline Tanpa Kuota
          </div>
          <h1 class="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <i data-lucide="hard-drive-download" class="w-7 h-7 text-amber-400"></i> Perpustakaan Lagu Offline
          </h1>
          <p class="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Lagu yang tersimpan di sini berada di penyimpanan lokal browser/PWA Anda. Tetap bisa diputar lancar saat <span class="text-amber-300 font-semibold">Mode Pesawat</span> atau ketika tidak ada sinyal internet sama sekali.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <label class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md glow-primary transition-all flex items-center gap-2 cursor-pointer">
            <i data-lucide="upload" class="w-4 h-4"></i> Tambah MP3 Manual
            <input type="file" id="offline-file-input" accept="audio/*" multiple class="hidden" />
          </label>
        </div>
      </div>

      <!-- Storage & Controls Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 rounded-2xl glass-panel text-xs">
        <div class="flex items-center gap-3 text-slate-300">
          <span id="offline-storage-info" class="flex items-center gap-1.5 font-medium">
            <i data-lucide="database" class="w-4 h-4 text-amber-400"></i> Memuat data penyimpanan...
          </span>
        </div>
        <button onclick="window.App.playAllOfflineTracks()" id="btn-play-all-offline" class="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all flex items-center justify-center gap-2 shadow-md">
          <i data-lucide="play" class="w-4 h-4 fill-current"></i> Putar Semua Lagu Offline
        </button>
      </div>

      <!-- Offline Tracks Container -->
      <div id="offline-tracks-container">
        <div class="flex items-center justify-center py-20 text-slate-400 text-xs">
          <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-400"></div>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const fileInput = document.getElementById('offline-file-input');
  if (fileInput) {
    fileInput.onchange = async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        await handleOfflineFilesUpload(e.target.files);
      }
    };
  }

  await loadAndRenderOfflineTracks();
}

async function handleOfflineFilesUpload(files) {
  const audioFiles = Array.from(files).filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(f.name));
  if (audioFiles.length === 0) {
    showToast('Pilih berkas audio yang valid (.mp3, .wav, .m4a)', 'error');
    return;
  }

  showToast(`Menyimpan ${audioFiles.length} lagu ke memori offline...`, 'info');

  for (const file of audioFiles) {
    let nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    let artist = 'File Lokal Offline';
    let title = nameWithoutExt;

    if (nameWithoutExt.includes(' - ')) {
      const parts = nameWithoutExt.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }

    const track = {
      id: 'offline-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      title: title,
      artist: artist,
      genre: 'Offline Local',
      duration: 210,
      durationStr: 'Audio',
      artwork: 'icons/icon-192.png',
      isOffline: true,
      source: 'offline'
    };

    await OfflineStorage.saveTrack(track, file);
  }

  showToast(`Berhasil menyimpan ${audioFiles.length} lagu offline!`, 'success');
  await loadAndRenderOfflineTracks();
  await updateOfflineBadgeCount();
}

async function loadAndRenderOfflineTracks() {
  const container = document.getElementById('offline-tracks-container');
  const storageInfo = document.getElementById('offline-storage-info');
  const tracks = await OfflineStorage.getAllTracks();
  AppState.offlineTracks = tracks;

  const usage = await OfflineStorage.getStorageUsage();
  if (storageInfo) {
    storageInfo.innerHTML = `
      <i data-lucide="database" class="w-4 h-4 text-amber-400"></i>
      <span>Tersimpan: <b class="text-white">${usage.count} Lagu</b> (${usage.mb})</span>
    `;
  }

  if (!container) return;

  if (tracks.length === 0) {
    container.innerHTML = `
      <div class="py-20 text-center glass-panel rounded-3xl p-8 space-y-4 border border-dashed border-white/15">
        <div class="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
          <i data-lucide="cloud-off" class="w-8 h-8"></i>
        </div>
        <div class="space-y-1">
          <h3 class="text-lg font-bold text-white">Belum Ada Lagu Offline</h3>
          <p class="text-xs text-slate-400 max-w-md mx-auto">
            Klik tombol download (<i data-lucide="download" class="w-3.5 h-3.5 inline text-amber-400"></i>) pada lagu manapun di Discover atau unggah file MP3 untuk diputar tanpa kuota internet.
          </p>
        </div>
        <button onclick="window.App.switchView('discover')" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-all">
          Cari Lagu untuk Di-download
        </button>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  container.innerHTML = `
    <div class="space-y-2">
      ${tracks.map((t, idx) => renderOfflineTrackRow(t, idx, tracks)).join('')}
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

function renderOfflineTrackRow(track, index, trackList) {
  if (!track) return '';
  registerTrack(track);
  const trackId = String(track.id);
  const isCurrentlyPlaying = Player.currentTrack && String(Player.currentTrack.id) === trackId;

  return `
    <div class="flex items-center justify-between p-3 rounded-2xl glass-card group hover:bg-slate-800/60 transition-all ${isCurrentlyPlaying ? 'border-amber-500/50 bg-amber-950/20 active-track-glow' : ''}">
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <div class="w-7 text-center text-xs text-slate-400 font-medium">
          ${isCurrentlyPlaying && Player.isPlaying ? `
            <div class="flex items-center justify-center">
              <span class="playing-bar bg-amber-400"></span>
              <span class="playing-bar bg-amber-400"></span>
              <span class="playing-bar bg-amber-400"></span>
            </div>
          ` : `${index + 1}`}
        </div>

        <div class="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-slate-800">
          <img src="${track.artwork || 'icons/icon-192.png'}" alt="${escapeHtml(track.title)}" class="w-full h-full object-cover" loading="lazy" />
          <button onclick="window.App.playOfflineTrack('${trackId}', ${index})" class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
            <i data-lucide="${isCurrentlyPlaying && Player.isPlaying ? 'pause' : 'play'}" class="w-4 h-4 fill-current"></i>
          </button>
        </div>

        <div class="min-w-0 flex-1">
          <h4 class="text-sm font-semibold truncate ${isCurrentlyPlaying ? 'text-amber-400 font-bold' : 'text-slate-100'}">${escapeHtml(track.title)}</h4>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold uppercase">Offline</span>
            <p class="text-xs text-slate-400 truncate">${escapeHtml(track.artist)}</p>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3 ml-4">
        <span class="text-xs text-slate-500 hidden sm:inline font-mono">${track.durationStr || formatTime(track.duration)}</span>
        
        <button onclick="window.App.deleteOfflineTrack('${trackId}')" title="Hapus dari penyimpanan offline" class="p-2 text-slate-400 hover:text-rose-400 transition-colors">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `;
}

async function updateOfflineBadgeCount() {
  try {
    const tracks = await OfflineStorage.getAllTracks();
    const badge = document.getElementById('offline-badge-count');
    if (badge) {
      if (tracks.length > 0) {
        badge.textContent = tracks.length;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  } catch (e) {}
}

// --- Component Templates ---

function renderTrackSkeletons(count = 8) {
  return Array.from({ length: count }).map(() => `
    <div class="glass-panel rounded-2xl p-3 animate-pulse space-y-3">
      <div class="w-full aspect-square rounded-xl bg-slate-800/60"></div>
      <div class="h-4 bg-slate-800/60 rounded w-3/4"></div>
      <div class="h-3 bg-slate-800/40 rounded w-1/2"></div>
    </div>
  `).join('');
}

function renderTrackCard(track, index, trackList) {
  if (!track) return '';
  registerTrack(track);
  const trackId = String(track.id);
  const isLiked = Storage.isLiked(track.id);
  const isCurrentlyPlaying = Player.currentTrack && String(Player.currentTrack.id) === trackId;

  return `
    <div class="glass-card rounded-2xl p-3 flex flex-col justify-between group relative overflow-hidden ${isCurrentlyPlaying ? 'active-track-glow' : ''}">
      <div class="relative w-full aspect-square rounded-xl overflow-hidden mb-3 bg-slate-800">
        <img src="${track.artwork || 'icons/icon-192.png'}" alt="${escapeHtml(track.title)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        
        <!-- Live Soundwave Badge if Playing -->
        ${isCurrentlyPlaying && Player.isPlaying ? `
          <div class="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md flex items-center gap-1 border border-indigo-500/40">
            <span class="playing-bar"></span>
            <span class="playing-bar"></span>
            <span class="playing-bar"></span>
          </div>
        ` : ''}

        <!-- Hover Overlay -->
        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
          <button onclick="window.App.playFromCard('${trackId}', ${index})" class="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-xl glow-primary transform hover:scale-110 active:scale-95 transition-all">
            <i data-lucide="${isCurrentlyPlaying && Player.isPlaying ? 'pause' : 'play'}" class="w-5 h-5 fill-current ml-0.5"></i>
          </button>
        </div>

        <button onclick="event.stopPropagation(); window.App.openDownloadModal('${trackId}')" title="Download / Simpan Offline" class="absolute top-2 left-2 p-1.5 rounded-full bg-slate-900/60 backdrop-blur-md text-slate-300 hover:text-amber-400 transition-colors">
          <i data-lucide="download" class="w-4 h-4"></i>
        </button>

        <button onclick="window.App.toggleLike('${trackId}', this)" class="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/60 backdrop-blur-md text-slate-300 hover:text-rose-500 transition-colors ${isLiked ? 'text-rose-500' : ''}">
          <i data-lucide="heart" class="w-4 h-4 ${isLiked ? 'fill-current' : ''}"></i>
        </button>
      </div>

      <div class="min-w-0">
        <h4 class="text-sm font-bold text-white truncate group-hover:text-indigo-400 transition-colors" title="${escapeHtml(track.title)}">${escapeHtml(track.title)}</h4>
        <p class="text-xs text-slate-400 truncate mt-0.5" title="${escapeHtml(track.artist)}">${escapeHtml(track.artist)}</p>
      </div>

      <div class="flex items-center justify-between mt-3 pt-2 border-t border-white/5 text-[11px] text-slate-500">
        <span class="truncate max-w-[90px] font-mono">${track.durationStr || formatTime(track.duration)}</span>
        <button onclick="window.App.openTrackMenu('${trackId}', event)" class="p-1 rounded hover:text-slate-200 transition-colors">
          <i data-lucide="more-horizontal" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `;
}

function renderTrackRow(track, index, trackList, playlistId = null) {
  if (!track) return '';
  registerTrack(track);
  const trackId = String(track.id);
  const isLiked = Storage.isLiked(track.id);
  const isCurrentlyPlaying = Player.currentTrack && String(Player.currentTrack.id) === trackId;

  return `
    <div class="flex items-center justify-between p-3 rounded-2xl glass-card group hover:bg-slate-800/60 transition-all ${isCurrentlyPlaying ? 'border-indigo-500/50 bg-indigo-950/25 active-track-glow' : ''}">
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <div class="w-7 text-center text-xs text-slate-400 font-medium">
          ${isCurrentlyPlaying && Player.isPlaying ? `
            <div class="flex items-center justify-center">
              <span class="playing-bar"></span>
              <span class="playing-bar"></span>
              <span class="playing-bar"></span>
            </div>
          ` : `${index + 1}`}
        </div>

        <div class="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-slate-800">
          <img src="${track.artwork || 'icons/icon-192.png'}" alt="${escapeHtml(track.title)}" class="w-full h-full object-cover" loading="lazy" />
          <button onclick="window.App.playFromRow('${trackId}', ${index})" class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
            <i data-lucide="${isCurrentlyPlaying && Player.isPlaying ? 'pause' : 'play'}" class="w-4 h-4 fill-current"></i>
          </button>
        </div>

        <div class="min-w-0 flex-1">
          <h4 class="text-sm font-semibold truncate ${isCurrentlyPlaying ? 'text-indigo-400 font-bold' : 'text-slate-100'}">${escapeHtml(track.title)}</h4>
          <p class="text-xs text-slate-400 truncate">${escapeHtml(track.artist)}</p>
        </div>
      </div>

      <div class="flex items-center gap-2 sm:gap-3 ml-4">
        <span class="text-xs text-slate-500 hidden sm:inline font-mono">${track.durationStr || formatTime(track.duration)}</span>
        
        <button onclick="event.stopPropagation(); window.App.openDownloadModal('${trackId}')" title="Download / Simpan Offline" class="p-2 text-slate-400 hover:text-amber-400 transition-colors">
          <i data-lucide="download" class="w-4 h-4"></i>
        </button>

        <button onclick="window.App.toggleLike('${trackId}', this)" class="p-2 text-slate-400 hover:text-rose-500 transition-colors ${isLiked ? 'text-rose-500' : ''}">
          <i data-lucide="heart" class="w-4 h-4 ${isLiked ? 'fill-current' : ''}"></i>
        </button>

        ${playlistId ? `
          <button onclick="window.App.removeFromPlaylist('${playlistId}', '${trackId}')" title="Hapus dari playlist" class="p-2 text-slate-400 hover:text-rose-400 transition-colors">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        ` : `
          <button onclick="window.App.openTrackMenu('${trackId}', event)" class="p-2 text-slate-400 hover:text-slate-200 transition-colors">
            <i data-lucide="more-vertical" class="w-4 h-4"></i>
          </button>
        `}
      </div>
    </div>
  `;
}

// --- Player Synchronization ---

function setupPlayerSync() {
  Player.on('playState', isPlaying => {
    const playIcons = document.querySelectorAll('.player-play-icon');
    playIcons.forEach(icon => {
      icon.setAttribute('data-lucide', isPlaying ? 'pause' : 'play');
    });

    const fullRecord = document.getElementById('fullscreen-record');
    if (fullRecord) {
      if (isPlaying) fullRecord.classList.remove('paused');
      else fullRecord.classList.add('paused');
    }

    if (window.lucide) window.lucide.createIcons();
    updateQueueDrawer();
  });

  Player.on('trackChange', track => {
    const art = document.getElementById('player-art');
    const title = document.getElementById('player-title');
    const artist = document.getElementById('player-artist');
    const likeBtn = document.getElementById('player-like-btn');

    if (art) art.src = track.artwork;
    if (title) title.innerText = track.title;
    if (artist) artist.innerText = track.artist;

    if (likeBtn) {
      const isLiked = Storage.isLiked(track.id);
      likeBtn.classList.toggle('text-rose-500', isLiked);
      const icon = likeBtn.querySelector('i');
      if (icon) {
        if (isLiked) icon.classList.add('fill-current');
        else icon.classList.remove('fill-current');
      }
    }

    // Update Fullscreen overlay
    const fsBg = document.getElementById('fullscreen-bg');
    const fsArt = document.getElementById('fullscreen-art');
    const fsTitle = document.getElementById('fullscreen-title');
    const fsArtist = document.getElementById('fullscreen-artist');
    if (fsBg) fsBg.style.backgroundImage = `url('${track.artwork}')`;
    if (fsArt) fsArt.src = track.artwork;
    if (fsTitle) fsTitle.innerText = track.title;
    if (fsArtist) fsArtist.innerText = track.artist;

    if (window.lucide) window.lucide.createIcons();
    updateQueueDrawer();
    if (AppState.currentDrawerTab === 'similar') {
      renderSimilarTracksInDrawer();
    }

    // Auto-update lyrics when track changes
    if (AppState.isLyricsModalOpen) {
      loadAndRenderLyrics(track);
    }
    if (AppState.isFullscreenLyricsActive) {
      loadAndRenderFullscreenLyrics(track);
    }
  });

  Player.on('timeUpdate', ({ currentTime, duration }) => {
    const currentText = document.getElementById('player-current-time');
    const durationText = document.getElementById('player-duration');
    const seekSlider = document.getElementById('player-seek-slider');
    const fsCurrentText = document.getElementById('fs-current-time');
    const fsDurationText = document.getElementById('fs-duration');
    const fsSeekSlider = document.getElementById('fs-seek-slider');

    const curStr = formatTime(currentTime);
    const durStr = duration ? formatTime(duration) : '0:00';

    if (currentText) currentText.innerText = curStr;
    if (durationText) durationText.innerText = durStr;
    if (fsCurrentText) fsCurrentText.innerText = curStr;
    if (fsDurationText) fsDurationText.innerText = durStr;

    // Update lyrics timer in modal
    const lyricsTimer = document.getElementById('lyrics-playback-timer');
    if (lyricsTimer) {
      lyricsTimer.innerText = `${curStr} / ${durStr}`;
    }

    // Sync active lyric highlight
    if (AppState.isLyricsModalOpen && AppState.lyricsDisplayMode === 'synced') {
      syncLyricsHighlight(currentTime);
    }
    if (AppState.isFullscreenLyricsActive) {
      syncFullscreenLyricsHighlight(currentTime);
    }

    if (seekSlider && !seekSlider.dataset.dragging && duration > 0) {
      seekSlider.max = duration;
      seekSlider.value = currentTime;
    }
    if (fsSeekSlider && !fsSeekSlider.dataset.dragging && duration > 0) {
      fsSeekSlider.max = duration;
      fsSeekSlider.value = currentTime;
    }
  });

  Player.on('volumeChange', ({ volume, isMuted }) => {
    const volSlider = document.getElementById('player-volume-slider');
    const volIcon = document.getElementById('player-volume-icon');
    if (volSlider) volSlider.value = isMuted ? 0 : volume * 100;
    if (volIcon) {
      const iconName = isMuted || volume === 0 ? 'volume-x' : volume < 0.5 ? 'volume-1' : 'volume-2';
      volIcon.setAttribute('data-lucide', iconName);
      if (window.lucide) window.lucide.createIcons();
    }
  });

  Player.on('queueChange', () => {
    updateQueueDrawer();
  });

  // Autoplay Rekomendasi Cerdas saat antrean selesai
  Player.on('queueEnded', async ({ lastTrack, queue }) => {
    if (Player.autoPlayRecommendations && navigator.onLine) {
      try {
        const nextTrack = await Recommendations.getAutoPlayTrack(queue, Storage.getHistory());
        if (nextTrack) {
          showToast(`Lanjut otomatis rekomendasi: ${nextTrack.title}`, 'info');
          Player.playTrack(nextTrack);
        }
      } catch (e) {
        console.warn('Autoplay error:', e);
      }
    }
  });

  // Listener status koneksi jaringan
  Player.on('networkChange', ({ isOnline }) => {
    const badge = document.getElementById('network-status-badge');
    if (badge) {
      if (isOnline) {
        badge.className = 'hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>Online</span>';
        showToast('Koneksi internet aktif kembali 🟢', 'success');
      } else {
        badge.className = 'hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20';
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span><span>Mode Offline</span>';
        showToast('Anda sedang offline. Menampilkan lagu tersimpan 💾', 'info');
        switchView('offline');
      }
    }
  });

  // Shuffle & Repeat
  const shuffleBtn = document.getElementById('player-shuffle-btn');
  const repeatBtn = document.getElementById('player-repeat-btn');

  if (shuffleBtn) {
    shuffleBtn.onclick = () => {
      const isShuffled = Player.toggleShuffle();
      shuffleBtn.classList.toggle('text-indigo-400', isShuffled);
      showToast(isShuffled ? 'Shuffle diaktifkan' : 'Shuffle dinonaktifkan');
    };
  }

  if (repeatBtn) {
    repeatBtn.onclick = () => {
      const mode = Player.toggleRepeat();
      repeatBtn.classList.toggle('text-indigo-400', mode !== 'off');
      const icon = repeatBtn.querySelector('i');
      if (icon) {
        icon.setAttribute('data-lucide', mode === 'one' ? 'repeat-1' : 'repeat');
      }
      if (window.lucide) window.lucide.createIcons();
      showToast(mode === 'one' ? 'Ulangi 1 Lagu' : mode === 'all' ? 'Ulangi Semua' : 'Ulangi Dimatikan');
    };
  }

  // Seek bar scrub & hover tooltip
  const seekSlider = document.getElementById('player-seek-slider');
  const seekTooltip = document.getElementById('seek-tooltip');

  if (seekSlider) {
    seekSlider.onmousedown = () => { seekSlider.dataset.dragging = 'true'; };
    seekSlider.ontouchstart = () => { seekSlider.dataset.dragging = 'true'; };
    seekSlider.onchange = (e) => {
      Player.seek(parseFloat(e.target.value));
      delete seekSlider.dataset.dragging;
    };

    seekSlider.onmousemove = (e) => {
      if (!seekTooltip) return;
      const rect = seekSlider.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const maxDur = parseFloat(seekSlider.max) || 100;
      const hoverSecs = pos * maxDur;
      seekTooltip.innerText = formatTime(hoverSecs);
      seekTooltip.style.left = `${(pos * 100).toFixed(1)}%`;
    };
  }

  const fsSeekSlider = document.getElementById('fs-seek-slider');
  if (fsSeekSlider) {
    fsSeekSlider.onmousedown = () => { fsSeekSlider.dataset.dragging = 'true'; };
    fsSeekSlider.ontouchstart = () => { fsSeekSlider.dataset.dragging = 'true'; };
    fsSeekSlider.onchange = (e) => {
      Player.seek(parseFloat(e.target.value));
      delete fsSeekSlider.dataset.dragging;
    };
  }

  // Volume slider
  const volSlider = document.getElementById('player-volume-slider');
  if (volSlider) {
    volSlider.oninput = (e) => {
      Player.setVolume(parseFloat(e.target.value) / 100);
    };
  }
}

// Up Next Queue Drawer Logic
function updateQueueDrawer() {
  const currentContainer = document.getElementById('drawer-current-track');
  const queueList = document.getElementById('drawer-queue-list');
  const countLabel = document.getElementById('drawer-queue-count');
  const badge = document.getElementById('queue-count-badge');

  const current = Player.currentTrack;
  const queue = Player.queue;
  const currentIndex = Player.queueIndex;

  if (badge) {
    const remainingCount = queue.length > currentIndex ? queue.length - currentIndex - 1 : 0;
    if (remainingCount > 0) {
      badge.innerText = remainingCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  if (currentContainer) {
    if (current) {
      currentContainer.innerHTML = `
        <div class="flex items-center gap-3">
          <img src="${current.artwork}" alt="${current.title}" class="w-12 h-12 rounded-xl object-cover shadow-md" />
          <div class="min-w-0 flex-1">
            <span class="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Sedang Diputar</span>
            <h4 class="text-xs font-bold text-white truncate">${current.title}</h4>
            <p class="text-[11px] text-slate-400 truncate">${current.artist}</p>
          </div>
        </div>
      `;
    } else {
      currentContainer.innerHTML = `<p class="text-xs text-slate-500">Belum ada lagu diputar.</p>`;
    }
  }

  if (queueList) {
    const upcoming = queue.slice(currentIndex + 1);
    if (upcoming.length === 0) {
      queueList.innerHTML = `<div class="py-8 text-center text-xs text-slate-500">Antrean lagu kosong. Tambahkan atau putar playlist untuk mengisi antrean!</div>`;
    } else {
      queueList.innerHTML = upcoming.map((t, idx) => {
        const actualIndex = currentIndex + 1 + idx;
        return `
          <div onclick='window.Player.playTrack(window.Player.queue[${actualIndex}])' class="flex items-center gap-3 p-2 rounded-xl glass-panel hover:bg-indigo-600/30 cursor-pointer transition-colors group">
            <span class="text-xs text-slate-500 w-4 text-center font-mono">${idx + 1}</span>
            <img src="${t.artwork}" alt="${t.title}" class="w-9 h-9 rounded-lg object-cover" />
            <div class="min-w-0 flex-1">
              <h5 class="text-xs font-semibold text-slate-200 truncate group-hover:text-white">${t.title}</h5>
              <p class="text-[10px] text-slate-400 truncate">${t.artist}</p>
            </div>
            <span class="text-[10px] text-slate-500 font-mono">${t.durationStr || formatTime(t.duration)}</span>
          </div>
        `;
      }).join('');
    }

    if (countLabel) {
      countLabel.innerText = `${upcoming.length} Lagu berikutnya`;
    }
    const tabCount = document.getElementById('drawer-queue-tab-count');
    if (tabCount) {
      tabCount.innerText = upcoming.length;
    }
  }
}

// Render similar tracks tab in Queue Drawer
async function renderSimilarTracksInDrawer() {
  const container = document.getElementById('drawer-similar-list');
  if (!container) return;

  const current = Player.currentTrack;
  if (!current) {
    container.innerHTML = `
      <div class="py-8 text-center text-xs text-slate-500">
        Putar sebuah lagu untuk melihat rekomendasi lagu yang mirip!
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
      <div class="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
      <span>Mencari lagu yang mirip dengan <strong>${current.title}</strong>...</span>
    </div>
  `;

  try {
    const similarTracks = await Recommendations.getSimilarTracks(current, 10);
    if (!similarTracks || similarTracks.length === 0) {
      container.innerHTML = `
        <div class="py-8 text-center text-xs text-slate-500">
          Belum menemukan lagu serupa. Coba putar lagu lain!
        </div>
      `;
      return;
    }

    container.innerHTML = similarTracks.map((t, idx) => {
      registerTrack(t);
      const trackId = String(t.id);
      return `
        <div class="flex items-center gap-3 p-2 rounded-xl glass-panel hover:bg-indigo-600/30 transition-colors group">
          <img src="${t.artwork || 'icons/icon-192.png'}" alt="${escapeHtml(t.title)}" class="w-9 h-9 rounded-lg object-cover" />
          <div class="min-w-0 flex-1 cursor-pointer" onclick="window.App.playSimilarTrackDirect('${trackId}')">
            <h5 class="text-xs font-semibold text-slate-200 truncate group-hover:text-white">${escapeHtml(t.title)}</h5>
            <p class="text-[10px] text-slate-400 truncate">${escapeHtml(t.artist)}</p>
          </div>
          <div class="flex items-center gap-1">
            <button onclick="window.App.addSimilarTrackToQueue('${trackId}')" title="Tambah ke antrean" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
              <i data-lucide="list-plus" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="event.stopPropagation(); window.App.openDownloadModal('${trackId}')" title="Download / Offline" class="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-white/10 transition-colors">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    container.innerHTML = `
      <div class="py-8 text-center text-xs text-rose-400">
        Gagal memuat rekomendasi lagu serupa.
      </div>
    `;
  }
}

// ==================== LYRICS HANDLERS ====================

async function loadAndRenderLyrics(track, customQuery = '') {
  const modalArt = document.getElementById('lyrics-modal-art');
  const modalTitle = document.getElementById('lyrics-modal-title');
  const modalArtist = document.getElementById('lyrics-modal-artist');
  const modalBg = document.getElementById('lyrics-bg-art');
  const content = document.getElementById('lyrics-content');
  const btnSynced = document.getElementById('btn-lyrics-mode-synced');
  const btnPlain = document.getElementById('btn-lyrics-mode-plain');

  if (!track && Player.currentTrack) track = Player.currentTrack;
  if (!track) {
    if (content) {
      content.innerHTML = `
        <div class="py-20 text-center text-slate-400 space-y-2">
          <i data-lucide="music" class="w-8 h-8 text-slate-500 mx-auto"></i>
          <p class="text-sm font-semibold">Pilih lagu untuk melihat lirik</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
    return;
  }

  if (modalArt) modalArt.src = track.artwork || 'icons/icon-192.png';
  if (modalTitle) modalTitle.innerText = track.title || 'Judul Lagu';
  if (modalArtist) modalArtist.innerText = track.artist || 'Artis';
  if (modalBg) modalBg.style.backgroundImage = `url('${track.artwork || ''}')`;

  if (content) {
    content.innerHTML = `
      <div class="py-20 text-center text-slate-400 space-y-3">
        <div class="w-7 h-7 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-sm font-medium">Mencari lirik untuk <span class="text-white font-bold">${track.title}</span>...</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  try {
    const data = await Lyrics.fetchLyrics(track, customQuery);
    if (!data || (!data.plainLyrics && !data.syncedLyrics)) {
      if (content) {
        content.innerHTML = `
          <div class="py-20 text-center text-slate-400 space-y-4 max-w-md mx-auto">
            <div class="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
              <i data-lucide="file-x" class="w-6 h-6"></i>
            </div>
            <div>
              <h4 class="text-base font-bold text-white">Lirik Belum Tersedia</h4>
              <p class="text-xs text-slate-400 mt-1">Kami belum menemukan lirik otomatis untuk lagu ini.</p>
            </div>
            <button onclick="window.App.toggleLyricsSearchBar(true)" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md">
              Coba Cari Manual 🔍
            </button>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
      return;
    }

    // Jika lagu tidak memiliki synced lyrics, fallback ke plain
    if (!data.isSynced && AppState.lyricsDisplayMode === 'synced') {
      AppState.lyricsDisplayMode = 'plain';
      if (btnSynced) btnSynced.className = 'px-3 py-1.5 rounded-lg font-semibold text-slate-400 hover:text-white transition-all';
      if (btnPlain) btnPlain.className = 'px-3 py-1.5 rounded-lg font-bold bg-indigo-600 text-white shadow transition-all';
    }

    renderLyricsBody(data);
  } catch (err) {
    console.warn('Load lyrics error:', err);
    if (content) {
      content.innerHTML = `
        <div class="py-20 text-center text-rose-400 space-y-2">
          <p class="text-sm font-semibold">Gagal memuat lirik: ${err.message || 'Koneksi error'}</p>
          <button onclick="window.App.toggleLyricsSearchBar(true)" class="text-xs text-indigo-400 hover:underline">
            Cari manual
          </button>
        </div>
      `;
    }
  }
}

function renderLyricsBody(data) {
  const content = document.getElementById('lyrics-content');
  if (!content || !data) return;

  if (AppState.lyricsDisplayMode === 'synced' && data.isSynced) {
    // Mode Karaoke / Synced LRC
    content.innerHTML = `
      <div class="text-center py-6 space-y-3">
        ${data.parsedLines.map((line, idx) => `
          <div 
            id="lyric-line-${idx}" 
            class="lyric-line future text-base md:text-xl leading-relaxed" 
            data-index="${idx}" 
            data-time="${line.time}" 
            onclick="window.App.seekToLyric(${line.time})"
          >
            ${line.text || '♪'}
          </div>
        `).join('')}
      </div>
    `;
    AppState.activeLyricLineIndex = -1;
    syncLyricsHighlight(Player.currentTime || 0);
  } else {
    // Mode Teks Lengkap (Plain)
    const stanzas = data.plainLyrics ? data.plainLyrics.split(/\n\s*\n/) : ['Lirik teks tidak tersedia'];
    content.innerHTML = `
      <div class="space-y-6 py-6 text-center max-w-xl mx-auto">
        ${stanzas.map(stanza => `
          <div class="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
            ${stanza.split('\n').map(l => `<p class="text-sm md:text-base text-slate-200 leading-relaxed">${l.trim() || '&nbsp;'}</p>`).join('')}
          </div>
        `).join('')}
      </div>
    `;
  }
}

function syncLyricsHighlight(currentTime) {
  if (!Lyrics.currentLyrics || !Lyrics.currentLyrics.isSynced) return;
  const idx = Lyrics.getActiveLineIndex(currentTime, 0.25);

  if (idx !== AppState.activeLyricLineIndex) {
    AppState.activeLyricLineIndex = idx;
    const lines = Lyrics.currentLyrics.parsedLines;

    for (let i = 0; i < lines.length; i++) {
      const el = document.getElementById(`lyric-line-${i}`);
      if (!el) continue;
      if (i < idx) {
        el.className = 'lyric-line past text-base md:text-xl leading-relaxed';
      } else if (i === idx) {
        el.className = 'lyric-line active text-lg md:text-2xl leading-relaxed';
        // Auto scroll container
        const container = document.getElementById('lyrics-scroll-container');
        if (container) {
          const elTop = el.offsetTop;
          const targetScroll = elTop - (container.clientHeight / 2) + (el.clientHeight / 2);
          container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
        }
      } else {
        el.className = 'lyric-line future text-base md:text-xl leading-relaxed';
      }
    }
  }
}

async function loadAndRenderFullscreenLyrics(track) {
  const container = document.getElementById('fs-lyrics-content');
  if (!container) return;

  if (!track && Player.currentTrack) track = Player.currentTrack;
  if (!track) return;

  container.innerHTML = `
    <div class="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
      <div class="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
      <span class="text-xs">Memuat lirik...</span>
    </div>
  `;

  try {
    const data = await Lyrics.fetchLyrics(track);
    if (!data || (!data.plainLyrics && !data.syncedLyrics)) {
      container.innerHTML = `
        <div class="py-12 text-center text-slate-400 text-sm">
          Lirik belum tersedia untuk lagu ini.
        </div>
      `;
      return;
    }

    if (data.isSynced) {
      container.innerHTML = data.parsedLines.map((line, idx) => `
        <div 
          id="fs-lyric-line-${idx}" 
          class="fs-lyric-line inactive" 
          data-time="${line.time}" 
          onclick="window.App.seekToLyric(${line.time})"
        >
          ${line.text || '♪'}
        </div>
      `).join('');
      syncFullscreenLyricsHighlight(Player.currentTime || 0);
    } else {
      container.innerHTML = `
        <div class="text-slate-300 text-sm space-y-2 whitespace-pre-line py-4">
          ${data.plainLyrics}
        </div>
      `;
    }
  } catch (e) {
    container.innerHTML = `<div class="py-12 text-center text-rose-400 text-xs">Gagal memuat lirik.</div>`;
  }
}

function syncFullscreenLyricsHighlight(currentTime) {
  if (!Lyrics.currentLyrics || !Lyrics.currentLyrics.isSynced) return;
  const idx = Lyrics.getActiveLineIndex(currentTime, 0.25);
  const lines = Lyrics.currentLyrics.parsedLines;

  for (let i = 0; i < lines.length; i++) {
    const el = document.getElementById(`fs-lyric-line-${i}`);
    if (!el) continue;
    if (i === idx) {
      el.className = 'fs-lyric-line active';
      const wrapper = document.getElementById('fullscreen-lyrics-wrapper');
      if (wrapper) {
        const elTop = el.offsetTop;
        const targetScroll = elTop - (wrapper.clientHeight / 2) + (el.clientHeight / 2);
        wrapper.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
      }
    } else {
      el.className = 'fs-lyric-line inactive';
    }
  }
}

// Autocomplete suggestions box handler
function hideSuggestions() {
  const box = document.getElementById('search-suggestions-box');
  if (box) box.classList.add('hidden');
}

function showSuggestions(list) {
  const box = document.getElementById('search-suggestions-box');
  if (!box) return;

  if (!list || list.length === 0) {
    box.classList.add('hidden');
    return;
  }

  box.innerHTML = list.map(item => `
    <div onclick="window.App.selectSuggestion('${item.replace(/'/g, "\\'")}')" class="px-3.5 py-2 text-xs text-slate-300 hover:text-white hover:bg-indigo-600/30 rounded-xl cursor-pointer flex items-center gap-2.5 transition-colors">
      <i data-lucide="search" class="w-3.5 h-3.5 text-slate-500"></i>
      <span class="truncate">${item}</span>
    </div>
  `).join('');

  box.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

// Modals
function setupEqualizer() {
  const modal = document.getElementById('equalizer-modal');
  const openBtn = document.getElementById('btn-open-equalizer');
  const closeBtn = document.getElementById('btn-close-equalizer');

  if (openBtn) openBtn.onclick = () => modal.classList.remove('hidden');
  if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');

  const presetContainer = document.getElementById('eq-presets-container');
  if (presetContainer) {
    presetContainer.innerHTML = Object.keys(EQ_PRESETS).map(key => `
      <button onclick="window.App.applyEqPreset('${key}')" class="px-3 py-1.5 rounded-lg text-xs font-semibold glass-panel hover:bg-indigo-600 hover:text-white transition-all">
        ${EQ_PRESETS[key].name}
      </button>
    `).join('');
  }
}

function setupFullscreenOverlay() {
  const overlay = document.getElementById('fullscreen-overlay');
  const openBtn = document.getElementById('btn-open-fullscreen');
  const closeBtn = document.getElementById('btn-close-fullscreen');

  if (openBtn) openBtn.onclick = () => overlay.classList.remove('hidden');
  if (closeBtn) closeBtn.onclick = () => overlay.classList.add('hidden');
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.add('-translate-x-full');
}

function openMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('-translate-x-full');
}

// Global App API
window.App = {
  AppState,
  switchView,
  playSingle(trackOrId) {
    const track = resolveTrack(trackOrId);
    if (track) Player.playTrack(track);
  },
  playFromCard(trackOrId, index) {
    const track = resolveTrack(trackOrId);
    if (!track) return;
    if (Player.currentTrack && String(Player.currentTrack.id) === String(track.id)) {
      Player.togglePlay();
    } else {
      Player.playTrack(track, AppState.currentTrackList);
    }
  },
  playFromRow(trackOrId, index) {
    const track = resolveTrack(trackOrId);
    if (!track) return;
    if (Player.currentTrack && String(Player.currentTrack.id) === String(track.id)) {
      Player.togglePlay();
    } else {
      Player.playTrack(track, AppState.currentTrackList);
    }
  },
  playStation(stationOrId) {
    let station = typeof stationOrId === 'object' ? stationOrId : RADIO_STATIONS.find(s => s.id === stationOrId);
    if (!station) station = resolveTrack(stationOrId);
    if (station) Player.playTrack(station);
  },
  playAllFavorites() {
    const liked = Storage.getLikedSongs();
    if (liked.length > 0) Player.playTrack(liked[0], liked);
  },
  playAllLocal() {
    if (AppState.localTracks.length > 0) {
      Player.playTrack(AppState.localTracks[0], AppState.localTracks);
    }
  },
  playAllHistory() {
    const hist = Storage.getHistory();
    if (hist.length > 0) Player.playTrack(hist[0], hist);
  },
  playPlaylist(id) {
    const pl = Storage.getPlaylists().find(p => p.id === id);
    if (pl && pl.tracks.length > 0) {
      Player.playTrack(pl.tracks[0], pl.tracks);
    }
  },
  toggleLike(trackOrId, el) {
    const track = resolveTrack(trackOrId);
    if (!track) return;
    const isNowLiked = Storage.toggleLike(track);
    showToast(isNowLiked ? 'Ditambahkan ke favorit!' : 'Dihapus dari favorit');

    if (el) {
      el.classList.toggle('text-rose-500', isNowLiked);
      const icon = el.querySelector('i');
      if (icon) {
        if (isNowLiked) icon.classList.add('fill-current');
        else icon.classList.remove('fill-current');
      }
    }
    if (AppState.currentView === 'favorites') {
      renderFavoritesView();
    }
  },
  applyEqPreset(key) {
    Player.setEqualizerPreset(key);
    showToast(`Preset ${EQ_PRESETS[key].name} diterapkan`);
  },
  openCreatePlaylistModal() {
    const modal = document.getElementById('playlist-modal');
    if (modal) modal.classList.remove('hidden');
  },
  createPlaylistSubmit() {
    const name = document.getElementById('new-playlist-name').value;
    const desc = document.getElementById('new-playlist-desc').value;
    if (!name || !name.trim()) {
      showToast('Nama playlist tidak boleh kosong', 'error');
      return;
    }
    Storage.createPlaylist(name, desc);
    document.getElementById('playlist-modal').classList.add('hidden');
    document.getElementById('new-playlist-name').value = '';
    document.getElementById('new-playlist-desc').value = '';
    showToast('Playlist berhasil dibuat!', 'success');
    renderPlaylistsView();
  },
  deletePlaylist(id) {
    if (confirm('Yakin ingin menghapus playlist ini?')) {
      Storage.deletePlaylist(id);
      showToast('Playlist telah dihapus');
      switchView('playlists');
    }
  },
  removeFromPlaylist(plId, trackId) {
    Storage.removeFromPlaylist(plId, trackId);
    showToast('Lagu dihapus dari playlist');
    renderPlaylistsView(plId);
  },
  openTrackMenu(trackOrId, event) {
    if (event) event.stopPropagation();
    const track = resolveTrack(trackOrId);
    if (!track) return;
    AppState.activeTrackMenu = track;
    const playlists = Storage.getPlaylists();
    const menu = document.getElementById('track-action-menu');

    document.getElementById('track-menu-playlists').innerHTML = playlists.map(pl => `
      <button onclick="window.App.addTrackToPlaylist('${pl.id}')" class="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-indigo-600 hover:text-white transition-colors truncate">
        + ${escapeHtml(pl.name)}
      </button>
    `).join('');

    menu.classList.remove('hidden');
    menu.style.top = `${Math.min(window.innerHeight - 200, (event ? event.clientY : 100) + 10)}px`;
    menu.style.left = `${Math.min(window.innerWidth - 220, (event ? event.clientX : 100) - 100)}px`;
  },
  addTrackToPlaylist(playlistId) {
    if (AppState.activeTrackMenu) {
      const added = Storage.addToPlaylist(playlistId, AppState.activeTrackMenu);
      showToast(added ? 'Lagu berhasil ditambahkan ke playlist!' : 'Lagu sudah ada di playlist ini');
      document.getElementById('track-action-menu').classList.add('hidden');
    }
  },
  toggleVisualizerMode() {
    const modes = ['bars', 'circular', 'wave'];
    const currentIdx = modes.indexOf(Visualizer.mode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    Visualizer.setMode(nextMode);
    showToast(`Mode Visualizer: ${nextMode.toUpperCase()}`);
  },
  toggleVideoMode() {
    AppState.isVideoMode = !AppState.isVideoMode;
    const videoContainer = document.getElementById('yt-player-wrapper');
    const recordContainer = document.getElementById('fullscreen-record');
    const btn = document.getElementById('btn-toggle-video');

    if (videoContainer) {
      if (AppState.isVideoMode) {
        videoContainer.classList.remove('invisible-player');
        videoContainer.classList.add('visible-player');
        if (recordContainer) recordContainer.classList.add('hidden');
        if (btn) btn.classList.add('text-indigo-400');
        showToast('Mode Video Klip Aktif');
        if (Player.currentTrack && Player.isDirectAudioActive) {
          const curTime = Player.audio.currentTime || 0;
          Player.audio.pause();
          Player.isDirectAudioActive = false;
          const videoId = Player.currentTrack.videoId || (Player.currentTrack.id && Player.currentTrack.id.startsWith('yt-') ? Player.currentTrack.id.replace('yt-', '') : null);
          if (videoId && Player.ytPlayer && Player.isYtReady) {
            try {
              Player.ytPlayer.loadVideoById(videoId, curTime);
              if (Player.isPlaying) Player.ytPlayer.playVideo();
            } catch (e) {}
          }
        }
      } else {
        videoContainer.classList.remove('visible-player');
        videoContainer.classList.add('invisible-player');
        if (recordContainer) recordContainer.classList.remove('hidden');
        if (btn) btn.classList.remove('text-indigo-400');
        showToast('Mode Audio & Background Aktif');
        if (Player.currentTrack && !Player.isDirectAudioActive) {
          const curTime = (Player.ytPlayer && Player.isYtReady) ? Player.ytPlayer.getCurrentTime() : 0;
          if (Player.ytPlayer && Player.isYtReady) {
            try { Player.ytPlayer.pauseVideo(); } catch (e) {}
          }
          Player.isDirectAudioActive = true;
          const videoId = Player.currentTrack.videoId || (Player.currentTrack.id && Player.currentTrack.id.startsWith('yt-') ? Player.currentTrack.id.replace('yt-', '') : null);
          if (videoId) {
            Player.audio.src = `/api/stream?id=${videoId}&title=${encodeURIComponent(Player.currentTrack.title || '')}&redirect=1`;
            Player.audio.currentTime = curTime;
            if (Player.isPlaying) Player.audio.play().catch(() => {});
          }
        }
      }
    }
  },

  // Queue Drawer
  toggleQueueDrawer() {
    AppState.isQueueDrawerOpen = !AppState.isQueueDrawerOpen;
    const drawer = document.getElementById('queue-drawer');
    if (drawer) {
      drawer.classList.toggle('translate-x-full', !AppState.isQueueDrawerOpen);
    }
    updateQueueDrawer();
  },
  clearQueue() {
    if (Player.queue.length > 0) {
      Player.queue = Player.currentTrack ? [Player.currentTrack] : [];
      Player.queueIndex = 0;
      updateQueueDrawer();
      showToast('Antrean lagu telah dibersihkan');
    }
  },

  // Sleep Timer
  openSleepTimerModal() {
    const modal = document.getElementById('sleep-timer-modal');
    if (modal) modal.classList.remove('hidden');
  },
  setSleepTimer(minutes) {
    this.cancelSleepTimer();
    AppState.sleepTimerSecondsLeft = minutes * 60;
    const badge = document.getElementById('sleep-timer-badge');
    if (badge) badge.classList.remove('hidden');

    const updateLabel = () => {
      const status = document.getElementById('sleep-timer-status');
      if (status) {
        const m = Math.floor(AppState.sleepTimerSecondsLeft / 60);
        const s = AppState.sleepTimerSecondsLeft % 60;
        status.innerText = `Berhenti dalam ${m}:${s < 10 ? '0' : ''}${s}`;
      }
    };
    updateLabel();

    AppState.sleepTimerInterval = setInterval(() => {
      AppState.sleepTimerSecondsLeft--;
      updateLabel();

      if (AppState.sleepTimerSecondsLeft <= 0) {
        window.App.cancelSleepTimer();
        Player.pause();
        showToast('Waktu tidur selesai. Musik telah dimatikan. Selamat istirahat! 🌙', 'info');
      }
    }, 1000);

    document.getElementById('sleep-timer-modal').classList.add('hidden');
    showToast(`Timer tidur disetel untuk ${minutes} menit`);
  },
  cancelSleepTimer() {
    if (AppState.sleepTimerInterval) clearInterval(AppState.sleepTimerInterval);
    if (AppState.sleepTimerTimeout) clearTimeout(AppState.sleepTimerTimeout);
    AppState.sleepTimerSecondsLeft = 0;
    const badge = document.getElementById('sleep-timer-badge');
    if (badge) badge.classList.add('hidden');
    const status = document.getElementById('sleep-timer-status');
    if (status) status.innerText = 'Timer tidak aktif';
  },

  // Shortcuts Modal
  openShortcutsModal() {
    const modal = document.getElementById('shortcuts-modal');
    if (modal) modal.classList.remove('hidden');
  },

  // Direct YouTube Link
  openPasteLinkModal() {
    const modal = document.getElementById('youtube-link-modal');
    if (modal) {
      modal.classList.remove('hidden');
      const input = document.getElementById('direct-yt-link-input');
      if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 100);
      }
    }
  },
  async submitDirectYoutubeLink() {
    const input = document.getElementById('direct-yt-link-input');
    const linkVal = input ? input.value.trim() : '';
    if (!linkVal) {
      showToast('Silakan masukkan link YouTube atau ID video', 'error');
      return;
    }

    showToast('Memuat lagu dari YouTube...', 'info');
    document.getElementById('youtube-link-modal').classList.add('hidden');

    try {
      const results = await MusicAPI.searchTracks(linkVal);
      if (results && results.length > 0) {
        Player.playTrack(results[0], results);
        showToast(`Memutar: ${results[0].title}`, 'success');
      } else {
        showToast('Gagal memuat video dari tautan tersebut', 'error');
      }
    } catch (e) {
      showToast('Terjadi kesalahan saat memuat link YouTube', 'error');
    }
  },

  selectSuggestion(itemText) {
    const input = document.getElementById('global-search-input');
    if (input) input.value = itemText;
    hideSuggestions();
    switchView('search', itemText);
  },

  // Infinite Load More
  async loadMoreDiscover() {
    const btn = document.getElementById('btn-load-more-discover');
    if (btn) {
      btn.innerText = 'Memuat lagu...';
      btn.disabled = true;
    }
    AppState.discoverPage++;
    try {
      const moreTracks = await MusicAPI.getTrending('all', AppState.discoverPage);
      if (moreTracks && moreTracks.length > 0) {
        const grid = document.getElementById('discover-tracks-grid');
        const startIdx = AppState.currentTrackList.length;
        AppState.currentTrackList.push(...moreTracks);
        if (grid) {
          const newHtml = moreTracks.map((t, idx) => renderTrackCard(t, startIdx + idx, AppState.currentTrackList)).join('');
          grid.insertAdjacentHTML('beforeend', newHtml);
          if (window.lucide) window.lucide.createIcons();
        }
        showToast(`Berhasil memuat ${moreTracks.length} lagu baru dari YouTube!`, 'success');
      }
    } catch (e) {}
    if (btn) {
      btn.innerText = 'Muat Lebih Banyak Lagu dari YouTube ➕';
      btn.disabled = false;
    }
  },

  async loadMoreGenre() {
    const btn = document.getElementById('btn-load-more-genre');
    if (btn) {
      btn.innerText = 'Memuat lagu...';
      btn.disabled = true;
    }
    AppState.genrePage++;
    try {
      const moreTracks = await MusicAPI.getTrending(AppState.currentGenre, AppState.genrePage);
      if (moreTracks && moreTracks.length > 0) {
        const grid = document.getElementById('genre-tracks-grid');
        const startIdx = AppState.currentTrackList.length;
        AppState.currentTrackList.push(...moreTracks);
        if (grid) {
          const newHtml = moreTracks.map((t, idx) => renderTrackCard(t, startIdx + idx, AppState.currentTrackList)).join('');
          grid.insertAdjacentHTML('beforeend', newHtml);
          if (window.lucide) window.lucide.createIcons();
        }
        showToast(`Berhasil memuat ${moreTracks.length} lagu baru!`, 'success');
      }
    } catch (e) {}
    if (btn) {
      btn.innerText = `Muat Lebih Banyak Lagu (${AppState.currentGenre.toUpperCase()}) ➕`;
      btn.disabled = false;
    }
  },

  async loadMoreSearch() {
    const btn = document.getElementById('btn-load-more-search');
    if (btn) {
      btn.innerText = 'Mencari lebih banyak...';
      btn.disabled = true;
    }
    AppState.searchPage++;
    try {
      const moreTracks = await MusicAPI.searchTracks(AppState.currentQuery, 30, AppState.searchPage);
      if (moreTracks && moreTracks.length > 0) {
        const grid = document.getElementById('search-tracks-grid');
        const startIdx = AppState.currentTrackList.length;
        AppState.currentTrackList.push(...moreTracks);
        if (grid) {
          const newHtml = moreTracks.map((t, idx) => renderTrackCard(t, startIdx + idx, AppState.currentTrackList)).join('');
          grid.insertAdjacentHTML('beforeend', newHtml);
          if (window.lucide) window.lucide.createIcons();
        }
        showToast(`Ditemukan ${moreTracks.length} hasil baru!`, 'success');
      }
    } catch (e) {}
    if (btn) {
      btn.innerText = 'Cari Lebih Banyak Lagu di YouTube ➕';
      btn.disabled = false;
    }
  },

  // Download & PWA Helpers
  installPWA() {
    const modal = document.getElementById('download-app-modal');
    if (modal) modal.classList.remove('hidden');
  },

  async triggerBrowserInstallPrompt() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast('Memasang HarmoniX Music Player...', 'success');
        const modal = document.getElementById('download-app-modal');
        if (modal) modal.classList.add('hidden');
      }
      deferredPrompt = null;
    } else {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      if (isStandalone) {
        showToast('HarmoniX sudah berjalan sebagai aplikasi terpasang!', 'info');
      } else {
        showToast('Tekan ikon Pasang (+) di bilah browser atau buka file install_desktop_app.bat', 'info');
      }
    }
  },

  downloadCurrentMenuTrack() {
    const track = AppState.activeTrackMenu;
    if (!track) return;
    const menu = document.getElementById('track-action-menu');
    if (menu) menu.classList.add('hidden');
    this.openDownloadModal(track);
  },

  // Mobile Connect & QR Code Modal (iPhone & Android)
  async openMobileModal(defaultTab = 'iphone') {
    const modal = document.getElementById('android-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    this.switchMobileTab(defaultTab);

    let targetUrl = window.location.origin;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      try {
        const res = await fetch('/api/network-info');
        if (res.ok) {
          const json = await res.json();
          if (json.local_url && !json.is_cloud) {
            targetUrl = json.local_url;
          }
        }
      } catch (e) {
        console.warn('Network info fallback:', e);
      }
    }

    const input = document.getElementById('android-direct-url');
    if (input) input.value = targetUrl;

    const qrImg = document.getElementById('android-qr-image');
    if (qrImg) {
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(targetUrl)}&bgcolor=ffffff&color=050811&margin=4`;
    }
  },

  switchMobileTab(platform) {
    const tabIphone = document.getElementById('tab-btn-iphone');
    const tabAndroid = document.getElementById('tab-btn-android');
    const secIphone = document.getElementById('section-iphone-guide');
    const secAndroid = document.getElementById('section-android-guide');
    const scanLabel = document.getElementById('qr-scan-label');

    if (platform === 'iphone') {
      if (tabIphone) {
        tabIphone.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md';
      }
      if (tabAndroid) {
        tabAndroid.className = 'flex-1 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-all flex items-center justify-center gap-1.5';
      }
      if (secIphone) secIphone.classList.remove('hidden');
      if (secAndroid) secAndroid.classList.add('hidden');
      if (scanLabel) scanLabel.innerText = 'Buka Kamera iPhone Anda lalu arahkan ke QR Code ini';
    } else {
      if (tabAndroid) {
        tabAndroid.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md';
      }
      if (tabIphone) {
        tabIphone.className = 'flex-1 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-all flex items-center justify-center gap-1.5';
      }
      if (secAndroid) secAndroid.classList.remove('hidden');
      if (secIphone) secIphone.classList.add('hidden');
      if (scanLabel) scanLabel.innerText = 'Arahkan Kamera HP Android / Google Lens ke QR Code ini';
    }
  },

  openAndroidModal() {
    this.openMobileModal('android');
  },

  openSafariBackgroundModal() {
    const modal = document.getElementById('safari-bg-modal');
    if (modal) {
      modal.classList.remove('hidden');
      if (window.lucide) window.lucide.createIcons();
    }
  },

  async copyAndroidUrl() {
    const input = document.getElementById('android-direct-url');
    if (!input || !input.value) return;
    try {
      await navigator.clipboard.writeText(input.value);
      showToast('Tautan disalin ke clipboard!', 'success');
    } catch (e) {
      input.select();
      document.execCommand('copy');
      showToast('Tautan disalin ke clipboard!', 'success');
    }
  },

  // Queue Drawer Tab Switcher
  switchDrawerTab(tab) {
    AppState.currentDrawerTab = tab;
    const tabQueue = document.getElementById('drawer-tab-queue');
    const tabSimilar = document.getElementById('drawer-tab-similar');
    const queueList = document.getElementById('drawer-queue-list');
    const similarList = document.getElementById('drawer-similar-list');

    if (tab === 'similar') {
      if (tabSimilar) {
        tabSimilar.className = 'px-3 py-1.5 rounded-lg font-bold bg-indigo-600 text-white shadow transition-all flex items-center gap-1';
      }
      if (tabQueue) {
        tabQueue.className = 'px-3 py-1.5 rounded-lg font-semibold text-slate-400 hover:text-white transition-all';
      }
      if (queueList) queueList.classList.add('hidden');
      if (similarList) {
        similarList.classList.remove('hidden');
        renderSimilarTracksInDrawer();
      }
    } else {
      if (tabQueue) {
        tabQueue.className = 'px-3 py-1.5 rounded-lg font-bold bg-indigo-600 text-white shadow transition-all';
      }
      if (tabSimilar) {
        tabSimilar.className = 'px-3 py-1.5 rounded-lg font-semibold text-slate-400 hover:text-white transition-all flex items-center gap-1';
      }
      if (queueList) queueList.classList.remove('hidden');
      if (similarList) similarList.classList.add('hidden');
    }
  },

  async refreshPersonalizedRecommendations() {
    await loadRecommendationsSection();
    showToast('Rekomendasi berhasil diperbarui!', 'success');
  },

  playSimilarTrackDirect(trackOrId) {
    const track = resolveTrack(trackOrId);
    if (!track) return;
    Player.playTrack(track);
    showToast(`Memutar: ${track.title}`, 'success');
  },

  addSimilarTrackToQueue(trackOrId) {
    const track = resolveTrack(trackOrId);
    if (!track) return;
    Player.addToQueue(track);
    showToast(`Ditambahkan ke antrean: ${track.title}`, 'info');
    updateQueueDrawer();
  },

  // Offline & Download Management
  async openDownloadModal(trackOrId) {
    let track = resolveTrack(trackOrId);
    if (!track) {
      if (Player.currentTrack) track = Player.currentTrack;
      else {
        showToast('Pilih lagu yang ingin di-download terlebih dahulu', 'error');
        return;
      }
    }
    AppState.pendingDownloadTrack = track;
    const modal = document.getElementById('track-download-modal');
    if (!modal) return;

    const art = document.getElementById('dl-modal-art');
    const title = document.getElementById('dl-modal-title');
    const artist = document.getElementById('dl-modal-artist');
    const status = document.getElementById('dl-modal-status');
    const progressContainer = document.getElementById('dl-progress-bar-container');

    if (art) art.src = track.artwork || 'icons/icon-192.png';
    if (title) title.innerText = track.title || 'Judul Lagu';
    if (artist) artist.innerText = track.artist || 'Artis';

    if (progressContainer) progressContainer.classList.add('hidden');

    try {
      const isSaved = await OfflineStorage.isTrackSaved(track.id);
      if (status) {
        if (isSaved) {
          status.innerText = 'Sudah tersimpan di Offline PWA ✅';
          status.className = 'inline-block mt-1 px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-mono';
        } else {
          status.innerText = 'Siap disimpan untuk mode offline';
          status.className = 'inline-block mt-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono';
        }
      }
    } catch (e) {
      if (status) {
        status.innerText = 'Siap disimpan';
        status.className = 'inline-block mt-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono';
      }
    }

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  },

  async confirmSaveOffline() {
    const track = AppState.pendingDownloadTrack;
    if (!track) return;

    const progressContainer = document.getElementById('dl-progress-bar-container');
    const progressBar = document.getElementById('dl-progress-bar');
    const progressText = document.getElementById('dl-progress-text');
    const status = document.getElementById('dl-modal-status');

    if (progressContainer) progressContainer.classList.remove('hidden');
    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.innerText = 'Menyiapkan audio...';

    try {
      await OfflineStorage.downloadAndStoreTrack(track, (info) => {
        const percent = typeof info === 'number' ? info : (info && info.percent ? info.percent : 50);
        const msg = (info && info.message) ? info.message : `Menyimpan ${percent}%...`;
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressText) progressText.innerText = msg;
      });

      if (progressBar) progressBar.style.width = '100%';
      if (progressText) progressText.innerText = 'Selesai tersimpan! 💾';
      if (status) {
        status.innerText = 'Sudah tersimpan di Offline PWA ✅';
        status.className = 'inline-block mt-1 px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-mono';
      }

      await updateOfflineBadgeCount();
      if (AppState.currentView === 'offline') {
        await loadAndRenderOfflineTracks();
      }

      showToast(`"${track.title}" berhasil disimpan di Offline PWA! Bisa diputar tanpa kuota 🎉`, 'success');

      setTimeout(() => {
        const modal = document.getElementById('track-download-modal');
        if (modal) modal.classList.add('hidden');
      }, 900);
    } catch (err) {
      console.error('Gagal menyimpan offline:', err);
      if (progressText) progressText.innerText = 'Gagal menyimpan audio';
      showToast(err.message || 'Gagal menyimpan lagu ke offline', 'error');
    }
  },

  async confirmDownloadFile(server = 'ytmp3') {
    const track = AppState.pendingDownloadTrack;
    if (!track) return;

    try {
      const res = await OfflineStorage.downloadToDevice(track, server);
      if (res && res.mode === 'converter') {
        showToast(`Link lagu otomatis disalin! Silakan Paste di konverter untuk download MP3 320kbps 🎵`, 'success');
      } else {
        showToast(`Mengunduh berkas audio "${track.title}" ke penyimpanan perangkat...`, 'success');
      }
      const modal = document.getElementById('track-download-modal');
      if (modal) modal.classList.add('hidden');
    } catch (err) {
      showToast('Gagal mengunduh file: ' + err.message, 'error');
    }
  },

  async copyPendingTrackLink() {
    const track = AppState.pendingDownloadTrack;
    if (!track) return;
    const rawId = track.videoId || track.id;
    const videoId = typeof rawId === 'string' && rawId.startsWith('yt-') ? rawId.replace('yt-', '') : String(rawId);
    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(ytUrl);
        showToast(`Link lagu disalin ke clipboard! 📋`, 'success');
      } else {
        prompt('Salin link lagu ini:', ytUrl);
      }
    } catch (e) {
      prompt('Salin link lagu ini:', ytUrl);
    }
  },

  async deleteOfflineTrack(id) {
    if (!confirm('Hapus lagu ini dari perpustakaan offline?')) return;
    try {
      await OfflineStorage.deleteTrack(id);
      showToast('Lagu berhasil dihapus dari offline', 'info');
      await updateOfflineBadgeCount();
      await loadAndRenderOfflineTracks();
    } catch (err) {
      showToast('Gagal menghapus lagu: ' + err.message, 'error');
    }
  },

  playOfflineTrack(trackOrId, index) {
    const track = resolveTrack(trackOrId);
    if (!track) return;
    if (Player.currentTrack && String(Player.currentTrack.id) === String(track.id)) {
      Player.togglePlay();
    } else {
      Player.playTrack(track, AppState.offlineTracks);
    }
  },

  playAllOfflineTracks() {
    if (AppState.offlineTracks && AppState.offlineTracks.length > 0) {
      Player.playTrack(AppState.offlineTracks[0], AppState.offlineTracks);
    } else {
      showToast('Belum ada lagu offline tersimpan', 'info');
    }
  },

  // Lyrics & Karaoke Methods
  openLyricsModal(track) {
    if (!track) {
      if (Player.currentTrack) track = Player.currentTrack;
      else {
        showToast('Pilih dan putar lagu terlebih dahulu untuk melihat lirik', 'info');
        return;
      }
    }
    const modal = document.getElementById('lyrics-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    AppState.isLyricsModalOpen = true;

    // Prefill query input
    const sInput = document.getElementById('lyrics-manual-input');
    if (sInput) sInput.value = `${track.artist} ${Lyrics.cleanQuery(track.title, track.artist)}`.trim();

    loadAndRenderLyrics(track);
    if (window.lucide) window.lucide.createIcons();
  },

  closeLyricsModal() {
    const modal = document.getElementById('lyrics-modal');
    if (modal) modal.classList.add('hidden');
    AppState.isLyricsModalOpen = false;
  },

  toggleLyricsSearchBar(forceOpen = null) {
    const bar = document.getElementById('lyrics-search-bar');
    if (!bar) return;
    if (forceOpen === true) bar.classList.remove('hidden');
    else if (forceOpen === false) bar.classList.add('hidden');
    else bar.classList.toggle('hidden');

    if (!bar.classList.contains('hidden')) {
      const input = document.getElementById('lyrics-manual-input');
      if (input) setTimeout(() => input.focus(), 100);
    }
  },

  async searchLyricsManual() {
    const input = document.getElementById('lyrics-manual-input');
    const query = input ? input.value.trim() : '';
    if (!query) {
      showToast('Ketikkan judul atau artis lagu yang ingin dicari', 'error');
      return;
    }
    showToast(`Mencari lirik: "${query}"...`, 'info');
    await loadAndRenderLyrics(Player.currentTrack, query);
  },

  switchLyricsDisplayMode(mode) {
    AppState.lyricsDisplayMode = mode;
    const btnSynced = document.getElementById('btn-lyrics-mode-synced');
    const btnPlain = document.getElementById('btn-lyrics-mode-plain');

    if (mode === 'synced') {
      if (btnSynced) btnSynced.className = 'px-3 py-1.5 rounded-lg font-bold bg-indigo-600 text-white shadow transition-all flex items-center gap-1.5';
      if (btnPlain) btnPlain.className = 'px-3 py-1.5 rounded-lg font-semibold text-slate-400 hover:text-white transition-all';
    } else {
      if (btnPlain) btnPlain.className = 'px-3 py-1.5 rounded-lg font-bold bg-indigo-600 text-white shadow transition-all';
      if (btnSynced) btnSynced.className = 'px-3 py-1.5 rounded-lg font-semibold text-slate-400 hover:text-white transition-all flex items-center gap-1.5';
    }

    if (Lyrics.currentLyrics) {
      renderLyricsBody(Lyrics.currentLyrics);
    }
  },

  toggleFullscreenLyrics() {
    AppState.isFullscreenLyricsActive = !AppState.isFullscreenLyricsActive;
    const record = document.getElementById('fullscreen-record');
    const lyricsWrapper = document.getElementById('fullscreen-lyrics-wrapper');
    const btn = document.getElementById('btn-toggle-fs-lyrics');
    const btnText = document.getElementById('fs-lyrics-btn-text');

    if (AppState.isFullscreenLyricsActive) {
      if (record) record.classList.add('hidden');
      if (lyricsWrapper) {
        lyricsWrapper.classList.remove('hidden');
        loadAndRenderFullscreenLyrics(Player.currentTrack);
      }
      if (btn) btn.classList.add('bg-pink-600', 'text-white');
      if (btnText) btnText.innerText = 'Vinyl';
      showToast('Mode Lirik Layar Penuh Aktif 🎤');
    } else {
      if (lyricsWrapper) lyricsWrapper.classList.add('hidden');
      if (record) record.classList.remove('hidden');
      if (btn) btn.classList.remove('bg-pink-600', 'text-white');
      if (btnText) btnText.innerText = 'Lirik';
      showToast('Mode Piringan Hitam Aktif 💿');
    }
  },

  seekToLyric(seconds) {
    if (typeof seconds === 'number' && !isNaN(seconds)) {
      Player.seek(seconds);
      showToast(`Melompat ke ${formatTime(seconds)}`);
    }
  },

  async copyCurrentLyrics() {
    if (!Lyrics.currentLyrics) {
      showToast('Belum ada lirik untuk disalin', 'error');
      return;
    }
    const textToCopy = Lyrics.currentLyrics.plainLyrics || 
      (Lyrics.currentLyrics.parsedLines ? Lyrics.currentLyrics.parsedLines.map(l => l.text).join('\n') : '');
    
    if (!textToCopy) {
      showToast('Lirik kosong', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(`${Lyrics.currentLyrics.title} - ${Lyrics.currentLyrics.artist}\n\n${textToCopy}`);
      showToast('Lirik lagu berhasil disalin ke clipboard! 📋', 'success');
    } catch (e) {
      showToast('Gagal menyalin lirik', 'error');
    }
  }
};

// Keyboard Shortcuts Controller
function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // Abaikan jika sedang mengetik di input text atau textarea
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        Player.togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        Player.seek((Player.audio.currentTime || (Player.ytPlayer && Player.ytPlayer.getCurrentTime()) || 0) - 5);
        showToast('Mundur 5 detik');
        break;
      case 'ArrowRight':
        e.preventDefault();
        Player.seek((Player.audio.currentTime || (Player.ytPlayer && Player.ytPlayer.getCurrentTime()) || 0) + 5);
        showToast('Maju 5 detik');
        break;
      case 'ArrowUp':
        e.preventDefault();
        Player.setVolume(Math.min(1, Player.volume + 0.05));
        break;
      case 'ArrowDown':
        e.preventDefault();
        Player.setVolume(Math.max(0, Player.volume - 0.05));
        break;
      case 'KeyM':
        Player.toggleMute();
        break;
      case 'KeyF':
        document.getElementById('btn-open-fullscreen').click();
        break;
      case 'KeyL':
        if (Player.currentTrack) {
          window.App.toggleLike(Player.currentTrack, document.getElementById('player-like-btn'));
        }
        break;
      case 'KeyK':
        window.App.openLyricsModal();
        break;
      case 'KeyQ':
        window.App.toggleQueueDrawer();
        break;
      case 'Slash':
        e.preventDefault();
        const sInput = document.getElementById('global-search-input');
        if (sInput) {
          sInput.focus();
          sInput.select();
        }
        break;
    }

    if (e.key === '?') {
      window.App.openShortcutsModal();
    }
  });
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) window.lucide.createIcons();

  const canvas = document.getElementById('visualizer-canvas');
  if (canvas) Visualizer.init(canvas);

  setupPlayerSync();
  setupEqualizer();
  setupFullscreenOverlay();
  setupKeyboardShortcuts();
  updateOfflineBadgeCount();

  // Service Worker Registration for PWA & Offline Caching (v7 - Instant Activation)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js?v=7.0')
        .then(reg => {
          console.log('HarmoniX Service Worker v7 terdaftar:', reg.scope);
          reg.update();
        })
        .catch(err => console.log('HarmoniX Service Worker gagal:', err));
    });
  }

  // Play button
  const mainPlayBtn = document.getElementById('player-play-btn');
  if (mainPlayBtn) mainPlayBtn.onclick = () => Player.togglePlay();

  // Next / Prev
  const nextBtn = document.getElementById('player-next-btn');
  const prevBtn = document.getElementById('player-prev-btn');
  if (nextBtn) nextBtn.onclick = () => Player.next();
  if (prevBtn) prevBtn.onclick = () => Player.prev();

  // Mute
  const muteBtn = document.getElementById('player-volume-btn');
  if (muteBtn) muteBtn.onclick = () => Player.toggleMute();

  // Search input & Live Suggestions
  const searchInput = document.getElementById('global-search-input');
  const searchForm = document.getElementById('global-search-form');
  const searchClearBtn = document.getElementById('global-search-clear');
  let searchTimeout = null;
  let suggestTimeout = null;

  const triggerSearch = (query) => {
    clearTimeout(searchTimeout);
    clearTimeout(suggestTimeout);
    hideSuggestions();
    if (searchInput) searchInput.blur();
    if (query) {
      switchView('search', query);
    } else {
      switchView('discover');
    }
  };

  if (searchForm) {
    searchForm.onsubmit = (e) => {
      e.preventDefault();
      const query = searchInput ? searchInput.value.trim() : '';
      triggerSearch(query);
    };
  }

  if (searchClearBtn && searchInput) {
    searchClearBtn.onclick = () => {
      searchInput.value = '';
      searchClearBtn.classList.add('hidden');
      triggerSearch('');
    };
  }

  if (searchInput) {
    searchInput.oninput = (e) => {
      clearTimeout(searchTimeout);
      clearTimeout(suggestTimeout);
      const query = e.target.value.trim();

      if (searchClearBtn) {
        if (query) searchClearBtn.classList.remove('hidden');
        else searchClearBtn.classList.add('hidden');
      }

      if (!query) {
        hideSuggestions();
        switchView('discover');
        return;
      }

      suggestTimeout = setTimeout(async () => {
        const suggestions = await MusicAPI.getSuggestions(query);
        showSuggestions(suggestions);
      }, 150);

      searchTimeout = setTimeout(() => {
        switchView('search', query);
      }, 600);
    };

    searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const query = searchInput.value.trim();
        triggerSearch(query);
      }
    };
  }

  // Outside click handler
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#global-search-input') && !e.target.closest('#search-suggestions-box')) {
      hideSuggestions();
    }
    const menu = document.getElementById('track-action-menu');
    if (menu && !e.target.closest('#track-action-menu') && !e.target.closest('button')) {
      menu.classList.add('hidden');
    }
    const drawer = document.getElementById('queue-drawer');
    const toggleBtn = document.getElementById('btn-toggle-queue');
    if (drawer && AppState.isQueueDrawerOpen && !drawer.contains(e.target) && !toggleBtn.contains(e.target)) {
      window.App.toggleQueueDrawer();
    }
  });

  // Sidebar navigation clicks
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.onclick = () => {
      const view = btn.getAttribute('data-nav');
      switchView(view);
    };
  });

  const menuToggle = document.getElementById('mobile-menu-toggle');
  if (menuToggle) menuToggle.onclick = () => openMobileSidebar();

  const closeSidebarBtn = document.getElementById('close-sidebar-btn');
  if (closeSidebarBtn) closeSidebarBtn.onclick = () => closeMobileSidebar();

  switchView('discover');
});
