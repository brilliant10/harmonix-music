# 📱 Panduan Lengkap Aplikasi Android - HarmoniX Music Player

HarmoniX Music Player dapat dipasang dan dinikmati di smartphone **Android** Anda melalui 2 cara yang fleksibel:

---

## Cara 1: Pasang via WebAPK Instan (Paling Cepat & Direkomendasikan ⭐)
Tanpa perlu install Android Studio atau coding apapun! Karena HarmoniX telah dilengkapi standar Progressive Web App (PWA) lengkap:

1. **Jalankan Server di Komputer**:
   - Jalankan file `start.bat` di komputer Anda.
   - Pastikan HP Android Anda terhubung ke **jaringan Wi-Fi yang sama** dengan komputer.

2. **Buka di HP Android**:
   - Di aplikasi komputer, klik tombol **"HP Android"** di bagian atas.
   - Pindai (scan) **QR Code** yang muncul menggunakan kamera HP atau Google Lens.
   - *(Atau ketik langsung alamat URL lokal di browser HP Anda, contoh: `http://192.168.1.3:5500`)*.

3. **Pasang Aplikasi ke Layar Utama (WebAPK)**:
   - Di Google Chrome / Samsung Internet pada HP Android Anda, klik menu **titik tiga (⋮)** di pojok kanan atas.
   - Pilih menu **"Tambahkan ke Layar Utama"** (*Add to Home screen*) atau **"Pasang Aplikasi"** (*Install App*).
   - Klik **"Pasang" / "Install"**.
   - **Selesai!** HarmoniX akan otomatis terpasang dengan ikon sendiri di menu aplikasi Android Anda dan berjalan dalam mode layar penuh mandiri (*fullscreen standalone*) layaknya aplikasi Spotify asli!

---

## Cara 2: Build File `.APK` Sendiri via Android Studio

Jika Anda ingin menghasilkan file installer **`.apk`** mentah untuk dibagikan:

1. **Buka Android Studio**:
   - Buka program **Android Studio** di komputer Anda.
   - Pilih **File > Open**, lalu arahkan ke folder:
     `c:\Users\brill\Documents\Project-1(applikasi musik gratis)\android`

2. **Sync Gradle**:
   - Biarkan Android Studio mengunduh dependensi dan menyinkronkan proyek (*Gradle Sync*).

3. **Sesuaikan URL Aplikasi**:
   - Buka file `app/src/main/java/com/harmonix/music/MainActivity.java`.
   - Pastikan `DEFAULT_APP_URL` mengarah ke IP lokal komputer Anda (`http://192.168.1.3:5500`) atau ke URL hosting online Anda jika sudah diunggah ke internet.

4. **Build APK**:
   - Di menu atas Android Studio, klik:
     **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
   - Setelah selesai, klik notifikasi **"locate"** di pojok kanan bawah.
   - File `app-debug.apk` siap ditransfer dan di-install di semua perangkat Android!

---

## Tips: Memutar Musik di Luar Rumah (Jaringan Seluler 4G/5G)

Agar aplikasi di HP Android tetap bisa memutar musik saat Anda bepergian tanpa Wi-Fi rumah:
1. Anda dapat menggunakan tool tunneling gratis seperti **Cloudflare Tunnel** (`cloudflared`) atau **Ngrok**:
   ```bash
   # Contoh menjalankan tunnel gratis Cloudflare:
   cloudflared tunnel --url http://localhost:5500
   ```
2. Anda akan mendapatkan URL publik HTTPS gratis (contoh: `https://harmonix-music.trycloudflare.com`).
3. Buka URL tersebut di HP Android Anda dari mana saja di seluruh dunia!
