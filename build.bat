@echo off
chcp 65001 >nul
echo ========================================
echo   MiniRacingHUD - Сборка
echo ========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1"

echo.
pause
