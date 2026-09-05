@echo off
title HarmoniX Music Player Launcher
cd /d "%~dp0"
echo =======================================================
echo          HarmoniX - Free Music Player & Streamer
echo =======================================================
echo Menjalankan HarmoniX di browser...
python run.py
if %errorlevel% neq 0 (
    echo.
    echo Python tidak ditemukan atau terjadi error.
    echo Mencoba membuka index.html langsung di browser...
    start "" index.html
)
pause
