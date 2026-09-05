/**
 * HarmoniX Music Player - Main Application Controller (Ultra-Premium UI/UX)
 */

import { MusicAPI, RADIO_STATIONS, STARTER_HITS } from './api.js';
import { Player, EQ_PRESETS } from './audio.js';
import { Visualizer } from './visualizer.js';
import { Storage } from './storage.js';

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
  sleepTimerSecondsLeft: 0
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
  } catch (e) {
    console.error(e);
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
              <button onclick='window.App.playStation(${JSON.stringify(station).replace(/'/g, "\\'")})' class="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all">
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
  const isLiked = Storage.isLiked(track.id);
  const trackJson = JSON.stringify(track).replace(/'/g, "&#39;");
  const isCurrentlyPlaying = Player.currentTrack && String(Player.currentTrack.id) === String(track.id);

  return `
    <div class="glass-card rounded-2xl p-3 flex flex-col justify-between group relative overflow-hidden ${isCurrentlyPlaying ? 'active-track-glow' : ''}">
      <div class="relative w-full aspect-square rounded-xl overflow-hidden mb-3 bg-slate-800">
        <img src="${track.artwork}" alt="${track.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        
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
          <button onclick='window.App.playFromCard(${trackJson}, ${index})' class="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-xl glow-primary transform hover:scale-110 active:scale-95 transition-all">
            <i data-lucide="${isCurrentlyPlaying && Player.isPlaying ? 'pause' : 'play'}" class="w-5 h-5 fill-current ml-0.5"></i>
          </button>
        </div>

        <button onclick='window.App.toggleLike(${trackJson}, this)' class="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/60 backdrop-blur-md text-slate-300 hover:text-rose-500 transition-colors ${isLiked ? 'text-rose-500' : ''}">
          <i data-lucide="heart" class="w-4 h-4 ${isLiked ? 'fill-current' : ''}"></i>
        </button>
      </div>

      <div class="min-w-0">
        <h4 class="text-sm font-bold text-white truncate group-hover:text-indigo-400 transition-colors" title="${track.title}">${track.title}</h4>
        <p class="text-xs text-slate-400 truncate mt-0.5" title="${track.artist}">${track.artist}</p>
      </div>

      <div class="flex items-center justify-between mt-3 pt-2 border-t border-white/5 text-[11px] text-slate-500">
        <span class="truncate max-w-[90px] font-mono">${track.durationStr || formatTime(track.duration)}</span>
        <button onclick='window.App.openTrackMenu(${trackJson}, event)' class="p-1 rounded hover:text-slate-200 transition-colors">
          <i data-lucide="more-horizontal" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `;
}

function renderTrackRow(track, index, trackList, playlistId = null) {
  const isLiked = Storage.isLiked(track.id);
  const trackJson = JSON.stringify(track).replace(/'/g, "&#39;");
  const isCurrentlyPlaying = Player.currentTrack && String(Player.currentTrack.id) === String(track.id);

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
          <img src="${track.artwork}" alt="${track.title}" class="w-full h-full object-cover" loading="lazy" />
          <button onclick='window.App.playFromRow(${trackJson}, ${index})' class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
            <i data-lucide="${isCurrentlyPlaying && Player.isPlaying ? 'pause' : 'play'}" class="w-4 h-4 fill-current"></i>
          </button>
        </div>

        <div class="min-w-0 flex-1">
          <h4 class="text-sm font-semibold truncate ${isCurrentlyPlaying ? 'text-indigo-400 font-bold' : 'text-slate-100'}">${track.title}</h4>
          <p class="text-xs text-slate-400 truncate">${track.artist}</p>
        </div>
      </div>

      <div class="flex items-center gap-3 ml-4">
        <span class="text-xs text-slate-500 hidden sm:inline font-mono">${track.durationStr || formatTime(track.duration)}</span>
        
        <button onclick='window.App.toggleLike(${trackJson}, this)' class="p-2 text-slate-400 hover:text-rose-500 transition-colors ${isLiked ? 'text-rose-500' : ''}">
          <i data-lucide="heart" class="w-4 h-4 ${isLiked ? 'fill-current' : ''}"></i>
        </button>

        ${playlistId ? `
          <button onclick="window.App.removeFromPlaylist('${playlistId}', '${track.id}')" title="Hapus dari playlist" class="p-2 text-slate-400 hover:text-rose-400 transition-colors">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        ` : `
          <button onclick='window.App.openTrackMenu(${trackJson}, event)' class="p-2 text-slate-400 hover:text-slate-200 transition-colors">
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
        const trackJson = JSON.stringify(t).replace(/'/g, "&#39;");
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
  switchView,
  playSingle(track) {
    Player.playTrack(track);
  },
  playFromCard(track, index) {
    if (Player.currentTrack && String(Player.currentTrack.id) === String(track.id)) {
      Player.togglePlay();
    } else {
      Player.playTrack(track, AppState.currentTrackList);
    }
  },
  playFromRow(track, index) {
    if (Player.currentTrack && String(Player.currentTrack.id) === String(track.id)) {
      Player.togglePlay();
    } else {
      Player.playTrack(track, AppState.currentTrackList);
    }
  },
  playStation(station) {
    Player.playTrack(station);
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
  toggleLike(track, el) {
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
  openTrackMenu(track, event) {
    event.stopPropagation();
    AppState.activeTrackMenu = track;
    const playlists = Storage.getPlaylists();
    const menu = document.getElementById('track-action-menu');

    document.getElementById('track-menu-playlists').innerHTML = playlists.map(pl => `
      <button onclick="window.App.addTrackToPlaylist('${pl.id}')" class="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-indigo-600 hover:text-white transition-colors truncate">
        + ${pl.name}
      </button>
    `).join('');

    menu.classList.remove('hidden');
    menu.style.top = `${Math.min(window.innerHeight - 200, event.clientY + 10)}px`;
    menu.style.left = `${Math.min(window.innerWidth - 220, event.clientX - 100)}px`;
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
      } else {
        videoContainer.classList.remove('visible-player');
        videoContainer.classList.add('invisible-player');
        if (recordContainer) recordContainer.classList.remove('hidden');
        if (btn) btn.classList.remove('text-indigo-400');
        showToast('Mode Piringan Hitam (Vinyl) Aktif');
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

    if (track.url && !track.url.includes('youtube.com') && !track.url.includes('youtu.be') && !track.isYouTube) {
      const a = document.createElement('a');
      a.href = track.url;
      a.download = `${track.title} - ${track.artist}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast(`Mengunduh lagu: ${track.title}`, 'success');
    } else {
      const ytId = track.youtubeId || (track.url && track.url.includes('v=') ? track.url.split('v=')[1]?.split('&')[0] : null);
      const ytUrl = ytId ? `https://www.youtube.com/watch?v=${ytId}` : (track.url || '');
      if (ytUrl) {
        window.open(ytUrl, '_blank');
        showToast(`Membuka tautan YouTube: ${track.title}`, 'info');
      } else {
        showToast('Tautan trek tidak dapat diunduh langsung', 'error');
      }
    }
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

  // Service Worker Registration for PWA & Offline Caching
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('HarmoniX Service Worker terdaftar:', reg.scope))
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
  let searchTimeout = null;
  let suggestTimeout = null;

  if (searchInput) {
    searchInput.oninput = (e) => {
      clearTimeout(searchTimeout);
      clearTimeout(suggestTimeout);
      const query = e.target.value.trim();

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
        clearTimeout(searchTimeout);
        clearTimeout(suggestTimeout);
        hideSuggestions();
        const query = searchInput.value.trim();
        if (query) switchView('search', query);
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
