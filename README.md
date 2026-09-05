# 🎵 HarmoniX - Pemutar & Streaming Musik Gratis

Aplikasi pemutar dan streaming musik modern dengan desain antarmuka **Glassmorphism Dark Mode** yang memukau (terinspirasi dari Spotify & Apple Music), dilengkapi audio visualizer interaktif dan equalizer 5-band. **100% gratis digunakan tanpa perlu registrasi atau langganan.**

---

## ✨ Fitur Unggulan

1. **Streaming Musik Online Gratis (Audius API)**:
   - Akses ribuan lagu trending dunia dari musisi independen dan produser ternama.
   - Fitur pencarian instan berdasarkan judul lagu, artis, atau genre.
   - Filter lagu berdasarkan kategori genre (Lo-Fi, Electronic, Hip-Hop, Pop, Rock, Ambient, Jazz, Acoustic, dll.).
2. **Stasiun Radio Live 24/7**:
   - Siaran radio streaming gratis tanpa henti: *Lo-Fi Chill Beats, SomaFM Groove Salad (Ambient), Synthwave 80s, Secret Agent Jazz Lounge, Deep Space Ambient*.
3. **Pemutar File Musik Lokal (Offline Mode)**:
   - Dukungan drag-and-drop file audio dari komputer Anda (MP3, WAV, FLAC, M4A, OGG).
   - Putar koleksi lagu lokal dengan visualizer reaktif tanpa koneksi internet.
4. **Interactive Audio Visualizer**:
   - Menggunakan **Web Audio API** dan Canvas HTML5 secara real-time.
   - 3 mode visualizer yang bisa diganti:
     - **Spectrum Bars**: Bar neon dengan gradasi warna ungu-cyan.
     - **Circular Pulse**: Lingkaran reaktif yang berdenyut mengikuti dentuman bass.
     - **Smooth Waveform**: Gelombang sinus bercahaya.
5. **Built-in Equalizer 5-Band**:
   - Atur frekuensi audio sesuai selera: 60Hz (Sub-bass), 250Hz (Bass), 1kHz (Mid), 4kHz (High-mid), 12kHz (Treble).
   - Preset cepat: *Bass Boost, Pop, Rock, Electronic, Vocal Booster, Chill & Lo-Fi, Flat*.
6. **Manajemen Playlist & Favorit**:
   - Simpan lagu ke daftar "Lagu Favorit" (Liked Songs).
   - Buat custom playlist sendiri tanpa batas.
   - Riwayat pemutaran lagu (History).
   - Semua data tersimpan otomatis di penyimpanan lokal browser (`localStorage`).
7. **Mode Immersive Fullscreen Now Playing**:
   - Tampilan piringan hitam (vinyl) berputar dengan background dinamis berefek blur artistik.

---

## 🚀 Cara Menjalankan Aplikasi

Anda dapat menjalankan aplikasi ini dengan salah satu cara berikut:

### Cara 1: Menggunakan File Batch (Paling Mudah)
Cukup **klik dua kali** file `start.bat`. Aplikasi akan otomatis berjalan dan membuka browser default Anda.

### Cara 2: Menggunakan Terminal / Command Prompt
Buka PowerShell atau CMD di folder project ini, lalu jalankan:
```bash
python run.py
```
Aplikasi akan membuka tautan `http://localhost:5500` di browser Anda.

### Cara 3: Langsung Buka File HTML
Klik dua kali file `index.html` untuk langsung membukanya di browser (Google Chrome, Microsoft Edge, Firefox, Brave, dll).

---

## 📂 Struktur Folder Proyek

```text
Project-1(applikasi musik gratis)/
├── css/
│   └── style.css            # Desain kustom, efek glassmorphism, animasi gelombang audio
├── js/
│   ├── api.js               # Integrasi Audius API & stasiun radio 24/7
│   ├── audio.js             # Engine audio, Web Audio API, & 5-band equalizer
│   ├── visualizer.js        # Canvas visualizer realtime (bars, circular, wave)
│   ├── storage.js           # Manajemen localStorage (favorit, playlist, histori)
│   └── app.js               # Kontroller utama aplikasi, routing view, event handler
├── index.html               # Halaman utama aplikasi (Tailwind CSS, Lucide icons)
├── run.py                   # Server HTTP Python lokal otomatis
├── start.bat                # Launcher Windows 1-klik
└── README.md                # Panduan dokumentasi proyek
```

---

## 🎧 Format Audio yang Didukung

- MP3 (`.mp3`)
- WAV (`.wav`)
- FLAC (`.flac`)
- M4A / AAC (`.m4a`, `.aac`)
- OGG Vorbis (`.ogg`)
- Live MP3 / AAC Audio Streams
