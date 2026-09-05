@echo off
title Install HarmoniX Desktop App
cd /d "%~dp0"
echo ========================================================
echo        Memasang Pintasan HarmoniX Music Player...
echo ========================================================
python installer.py
if %errorlevel% neq 0 (
    echo Gagal memasang shortcut otomatis.
)
echo.
echo Selesai! Anda sekarang dapat membuka HarmoniX dari Desktop Anda.
pause
