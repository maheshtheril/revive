@echo off
setlocal
title HMS - HIGH-SPEED PRODUCTION CONSOLE
color 0B

echo ========================================================
echo   HOSPITAL MANAGEMENT SYSTEM - PRODUCTION GATEWAY
echo ========================================================
echo.

:: 1. HARD-STOP OLD SLOW PROCESSES (Ensures no port conflicts)
echo [1/3] Resetting all system engines...
taskkill /F /IM node.exe /T >nul 2>&1
echo Done.

:: 2. VERIFY PRODUCTION READINESS
echo [2/3] Checking Production Build & IP Config...
cd /d "%~dp0"

:: [NEW] AUTO-CONFIGURE IP FOR NETWORK ACCESS (World Standard)
node configure_ip.js

if not exist ".next\server" (
    echo [ERROR] Production Build NOT FOUND.
    echo Starting one-time build now (this will take 3 minutes).
    call npm run build
)

:: 3. LAUNCH PRODUCTION SERVER
echo [3/3] Powering Up High-Speed Dashboards...
echo.

:: Start WhatsApp Bridge in background
cd /d "%~dp0whatsapp-bridge"
start /B "HMS_BRIDGE" cmd /c "node server.js > bridge.log 2>&1"

:: Wait 3 seconds for server readiness
timeout /t 3 /nobreak >nul

:: Launch Chrome in App Mode (Redirecting to root)
set "URL=http://localhost:3002/"
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=%URL%
) else (
    start %URL%
)

:: START FINAL ENGINE in PRODUCTION mode (Using 'call' to prevent closing)
cd /d "%~dp0"
echo.
echo ========================================================
echo   SYSTEM IS LIVE (PRODUCTION) - PORT 3002
echo ========================================================
call npx next start -p 3002 -H 0.0.0.0
pause
