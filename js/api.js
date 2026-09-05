/**
 * HarmoniX Music Player - Universal Music & Streaming API Module
 * Akses seluruh lagu di YouTube, radio online, dan kategori musik populer
 */

const API_BASE = window.location.protocol.startsWith('http') 
  ? window.location.origin 
  : 'http://localhost:5500';

// 24/7 Live Radio Stations
export const RADIO_STATIONS = [
  {
    id: 'radio-lofi',
    title: 'Lofi Hip Hop Chill Beats',
    artist: '24/7 Live Lofi Stream',
    genre: 'Lo-Fi / Chill',
    duration: 0,
    isRadio: true,
    artwork: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'https://streams.ilovemusic.de/iloveradio17.mp3'
  },
  {
    id: 'radio-groove-salad',
    title: 'Groove Salad (Chill & Ambient)',
    artist: 'SomaFM Live',
    genre: 'Ambient / Chillout',
    duration: 0,
    isRadio: true,
    artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'https://ice1.somafm.com/groovesalad-128-mp3'
  },
  {
    id: 'radio-synthwave',
    title: 'Synthwave & Retrowave 80s',
    artist: 'Nightdrive Cyber Radio',
    genre: 'Synthwave',
    duration: 0,
    isRadio: true,
    artwork: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'https://ice2.somafm.com/defcon-128-mp3'
  },
  {
    id: 'radio-jazz-lounge',
    title: 'Secret Agent Jazz & Lounge',
    artist: 'SomaFM Lounge',
    genre: 'Jazz / Lounge',
    duration: 0,
    isRadio: true,
    artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'https://ice4.somafm.com/secretagent-128-mp3'
  },
  {
    id: 'radio-deep-space',
    title: 'Deep Space Atmospheric',
    artist: 'SomaFM Ambient',
    genre: 'Cosmic Ambient',
    duration: 0,
    isRadio: true,
    artwork: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'https://ice2.somafm.com/dronezone-128-mp3'
  },
  {
    id: 'radio-indie-pop',
    title: 'Indie Pop Rocks 24/7',
    artist: 'SomaFM Indie',
    genre: 'Indie / Pop',
    duration: 0,
    isRadio: true,
    artwork: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'https://ice1.somafm.com/indiepop-128-mp3'
  }
];

// Starter Hits
export const STARTER_HITS = [
  {
    id: 'yt-9II3OGZETo4',
    videoId: '9II3OGZETo4',
    title: 'TULUS - Hati-Hati di Jalan',
    artist: 'Tulus',
    genre: 'Pop Indonesia',
    duration: 243,
    durationStr: '4:03',
    artwork: 'https://i.ytimg.com/vi/9II3OGZETo4/hqdefault.jpg',
    source: 'youtube'
  },
  {
    id: 'yt-yjnSX_iUFVo',
    videoId: 'yjnSX_iUFVo',
    title: 'Bernadya - Satu Bulan',
    artist: 'Bernadya',
    genre: 'Pop Indonesia',
    duration: 215,
    durationStr: '3:35',
    artwork: 'https://i.ytimg.com/vi/yjnSX_iUFVo/hqdefault.jpg',
    source: 'youtube'
  },
  {
    id: 'yt-kL3N1X2mS54',
    videoId: 'kL3N1X2mS54',
    title: 'Mahalini - Sial',
    artist: 'Mahalini',
    genre: 'Pop Indonesia',
    duration: 243,
    durationStr: '4:03',
    artwork: 'https://i.ytimg.com/vi/kL3N1X2mS54/hqdefault.jpg',
    source: 'youtube'
  },
  {
    id: 'yt-sZpZJz76d7Q',
    videoId: 'sZpZJz76d7Q',
    title: 'Hindia - Evaluasi',
    artist: 'Hindia',
    genre: 'Indie Indonesia',
    duration: 236,
    durationStr: '3:56',
    artwork: 'https://i.ytimg.com/vi/sZpZJz76d7Q/hqdefault.jpg',
    source: 'youtube'
  },
  {
    id: 'yt-PMivT7MJ41M',
    videoId: 'PMivT7MJ41M',
    title: 'Bruno Mars - That’s What I Like',
    artist: 'Bruno Mars',
    genre: 'Pop / R&B',
    duration: 210,
    durationStr: '3:30',
    artwork: 'https://i.ytimg.com/vi/PMivT7MJ41M/hqdefault.jpg',
    source: 'youtube'
  },
  {
    id: 'yt-ic8j13piAhQ',
    videoId: 'ic8j13piAhQ',
    title: 'Taylor Swift - Cruel Summer',
    artist: 'Taylor Swift',
    genre: 'Pop',
    duration: 178,
    durationStr: '2:58',
    artwork: 'https://i.ytimg.com/vi/ic8j13piAhQ/hqdefault.jpg',
    source: 'youtube'
  },
  {
    id: 'yt-dvgZkm1xWPE',
    videoId: 'dvgZkm1xWPE',
    title: 'Coldplay - Viva La Vida',
    artist: 'Coldplay',
    genre: 'Alternative Rock',
    duration: 242,
    durationStr: '4:02',
    artwork: 'https://i.ytimg.com/vi/dvgZkm1xWPE/hqdefault.jpg',
    source: 'youtube'
  },
  {
    id: 'yt-_S39v3t-9f4',
    videoId: '_S39v3t-9f4',
    title: 'NIKI - Every Summertime',
    artist: 'NIKI',
    genre: 'R&B / Soul',
    duration: 216,
    durationStr: '3:36',
    artwork: 'https://i.ytimg.com/vi/_S39v3t-9f4/hqdefault.jpg',
    source: 'youtube'
  },
  {
    id: 'yt-Kj6Yx_6eHSc',
    videoId: 'Kj6Yx_6eHSc',
    title: 'Sheila On 7 - Dan',
    artist: 'Sheila On 7',
    genre: 'Pop Rock Indonesia',
    duration: 289,
    durationStr: '4:49',
    artwork: 'https://i.ytimg.com/vi/Kj6Yx_6eHSc/hqdefault.jpg',
    source: 'youtube'
  },
  {
    id: 'yt-jfKfPfyJRdk',
    videoId: 'jfKfPfyJRdk',
    title: 'Lofi Girl - Lofi Hip Hop Beats (Relax & Focus)',
    artist: 'Lofi Girl',
    genre: 'Lo-Fi',
    duration: 180,
    durationStr: '3:00',
    artwork: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
    source: 'youtube'
  }
];

export const MusicAPI = {
  // Cari lagu dari YouTube Gateway (Mendukung link langsung & kata kunci)
  async searchTracks(query, limit = 30, page = 1) {
    if (!query || !query.trim()) return [];
    try {
      const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query.trim())}&page=${page}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          return json.data;
        }
      }
    } catch (err) {
      console.warn('Pencarian API gagal:', err);
    }

    // Fallback pencarian lokal jika offline
    const q = query.toLowerCase();
    const filtered = STARTER_HITS.filter(t => 
      t.title.toLowerCase().includes(q) || 
      t.artist.toLowerCase().includes(q) || 
      (t.genre && t.genre.toLowerCase().includes(q))
    );

    return filtered.length > 0 ? filtered : STARTER_HITS;
  },

  // Ambil lagu trending berdasarkan genre dengan dukungan paginasi
  async getTrending(genre = 'all', page = 1) {
    try {
      const res = await fetch(`${API_BASE}/api/trending?genre=${encodeURIComponent(genre)}&page=${page}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          return json.data;
        }
      }
    } catch (err) {
      console.warn('Trending API gagal:', err);
    }

    return STARTER_HITS;
  },

  // Ambil daftar radio 24/7
  getRadioStations() {
    return RADIO_STATIONS;
  },

  // Rekomendasi auto-complete langsung dari YouTube
  async getSuggestions(query) {
    if (!query || !query.trim()) return [];
    try {
      const res = await fetch(`${API_BASE}/api/suggest?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) {
        const json = await res.json();
        return json.data || [];
      }
    } catch (e) {
      return [];
    }
    return [];
  }
};
