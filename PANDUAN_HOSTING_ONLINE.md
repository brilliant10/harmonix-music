# 🌐 Panduan Online 24/7 Gratis: HarmoniX Music Player (Tanpa Perlu Menyalakan Laptop)

Aplikasi HarmoniX kini telah siap untuk di-deploy secara online **24 jam sehari secara 100% GRATIS** ke platform cloud **Vercel**!

Dengan meng-onlinekan aplikasi ini:
- ✅ **Bisa dibuka di iPhone & Android dari mana saja** (menggunakan kuota data seluler 4G/5G atau Wi-Fi mana pun).
- ✅ **Laptop Anda tidak perlu dinyalakan** (bisa dimatikan kapan saja, aplikasi tetap berjalan 24/7 di cloud).
- ✅ **Memiliki tautan HTTPS resmi yang aman** (contoh: `https://harmonix-music.vercel.app`).
- ✅ **Langsung bisa dipasang ke Layar Utama iPhone (PWA via Safari)** layaknya aplikasi App Store resmi.

---

## 🚀 Cara 1: Deploy 1-Klik ke Vercel via GitHub (Paling Mudah & Rapi ⭐)

### Langkah 1: Buat Repositori di GitHub
1. Buka [github.com](https://github.com) dan login (atau daftar gratis jika belum punya).
2. Klik tombol **New Repository** (atau tanda **+** di kanan atas).
3. Beri nama, misalnya: `harmonix-music`, lalu klik **Create repository**.
4. Di laptop Anda, buka terminal / command prompt di folder proyek ini:
   ```bash
   git init
   git add .
   git commit -m "HarmoniX Music Player 24/7 Cloud Ready"
   git branch -M main
   git remote add origin https://github.com/USERNAME_ANDA/harmonix-music.git
   git push -u origin main
   ```

### Langkah 2: Sambungkan ke Vercel (Hanya 1 Menit)
1. Buka situs [vercel.com](https://vercel.com) dan klik **Sign In** (pilih **Continue with GitHub**).
2. Di halaman Dashboard Vercel, klik tombol **Add New... > Project**.
3. Di daftar repositori GitHub Anda, cari `harmonix-music` lalu klik **Import**.
4. Konfigurasi sudah otomatis terisi (karena sudah ada `vercel.json` dan `api/index.py`). Langsung saja klik tombol biru **Deploy**!
5. Tunggu sekitar 30 detik sampai muncul kembang api ucapan selamat 🎉.
6. Anda akan mendapatkan tautan website resmi Anda, misalnya:
   ```text
   https://harmonix-music-anda.vercel.app
   ```

---

## 🍏 Cara Pasang di iPhone dari Tautan Online (24/7):

1. Buka browser **Safari** di iPhone Anda.
2. Buka alamat website Vercel Anda (misal: `https://harmonix-music-anda.vercel.app`).
   *(Bisa dibuka pakai paket data seluler 4G/5G dari mana saja, laptop Anda boleh mati total!)*
3. Di bagian bawah layar Safari, ketuk tombol **Bagikan / Share** (ikon kotak dengan panah ke atas: **`[↑]`**).
4. Gulir ke bawah, lalu ketuk menu **"Tambahkan ke Layar Utama"** (*Add to Home Screen*).
5. Ketuk tombol **"Tambah"** (*Add*) di pojok kanan atas.
6. **Selesai!** Ikon HarmoniX akan muncul di Home Screen iPhone Anda. Buka aplikasinya kapan saja dan nikmati pemutar musik gratis tanpa batas!

---

## 🤖 Cara Pasang di Android dari Tautan Online:

1. Buka browser **Google Chrome** di HP Android Anda.
2. Buka alamat website Vercel Anda.
3. Ketuk menu **titik tiga (⋮)** di kanan atas > pilih **"Tambahkan ke Layar Utama"** atau **"Pasang Aplikasi"**.
4. Aplikasi akan otomatis terpasang dengan ikon dan berjalan mandiri di HP Android Anda!

---

## 🛠️ Berkas Konfigurasi Cloud yang Telah Disediakan:

- [vercel.json](file:///c:/Users/brill/Documents/Project-1%28applikasi%20musik%20gratis%29/vercel.json): Konfigurasi rewrite otomatis untuk frontend statis dan backend serverless API.
- [api/index.py](file:///c:/Users/brill/Documents/Project-1%28applikasi%20musik%20gratis%29/api/index.py): Serverless function Python untuk pencarian YouTube, trending, dan autocomplete di cloud.
- [requirements.txt](file:///c:/Users/brill/Documents/Project-1%28applikasi%20musik%20gratis%29/requirements.txt): File dependensi standar Python untuk cloud runtime.
