@echo off
title Upload HarmoniX ke GitHub
cd /d "c:\Users\brill\Documents\Project-1(applikasi musik gratis)"
echo ========================================================
echo        Upload HarmoniX Music Player ke GitHub
echo ========================================================
echo.
echo Pastikan Anda sudah membuat repositori kosong di GitHub!
echo Contoh: https://github.com/USERNAME_ANDA/harmonix-music.git
echo.
set /p repo_url="Paste Link Repositori GitHub Anda di sini: "

if "%repo_url%"=="" (
    echo.
    echo [!] Link repositori tidak boleh kosong!
    pause
    exit /b
)

echo.
echo Menghubungkan ke GitHub...
git remote remove origin >nul 2>&1
git remote add origin %repo_url%
git branch -M main
echo Mengunggah berkas ke GitHub...
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo  [BERHASIL] Semua file berhasil diunggah ke GitHub!
    echo  Langkah terakhir: Buka vercel.com lalu klik Import & Deploy!
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo  [!] Terjadi kendala saat push.
    echo  Pastikan Anda memasukkan link repositori yang benar
    echo  dan sudah login ke akun GitHub Anda.
    echo ========================================================
)
echo.
pause
