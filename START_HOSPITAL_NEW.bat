@echo off
setlocal
title ZIONA HMS - HIGH-SPEED PRODUCTION CONSOLE
color 0B
cd /d "%~dp0"

echo ========================================================
echo   ZIONA HMS - PRODUCTION GATEWAY [v3.3]
echo ========================================================
echo.

:: 1. HARD-STOP OLD SLOW PROCESSES (Ensures no port conflicts)
echo [1/3] Resetting all node engines...
taskkill /F /IM node.exe /T >nul 2>&1
echo Done.

:: [PRISMA SELF-HEAL] Check for Database Engines
if not exist ".next\standalone\node_modules\.prisma" (
    echo [ALERT] Database Engines missing for High-Speed mode.
    echo Healing Prisma Client...
    npx prisma generate
    xcopy /E /I /Y "node_modules\.prisma" ".next\standalone\node_modules\.prisma" >nul 2>&1
    echo Engine Restore SUCCESS.
)

:: [NEW] AUTO-CONFIGURE IP FOR NETWORK ACCESS (World Standard)
echo [2/3] Auto-Configuring Network IP...
node configure_ip.js || (
    echo [WARNING] IP Config failed. Check your network.
    pause
)

echo [3/3] Launching WhatsApp Bridge (Auto-Restart Mode)...
:: Start WhatsApp Bridge in background with a persistent loop
start /B "ZIONA_BRIDGE" cmd /c "cd whatsapp-bridge && :LOOP && node server.js >> bridge.log 2>&1 && echo [%date% %time%] Bridge exited, restarting... >> bridge.log && timeout /t 2 >nul && goto LOOP"

:: Wait 3 seconds for server readiness
timeout /t 3 /nobreak >nul

:: 3. LAUNCH STANDALONE PRODUCTION SERVER
echo [3/3] Launching Dashboard...

:: Environment Setup for Standalone (Fastest Mode)
set PORT=3002
set HOSTNAME=0.0.0.0

:: Launch Chrome in App Mode
set "URL=http://localhost:3002/"
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=%URL%

:: START FINAL STANDALONE ENGINE
cd /d "%~dp0"
if exist ".next\standalone\server.js" (
    node .next/standalone/server.js
) else (
    echo [ERROR] High-Speed Standalone files NOT FOUND.
    echo Running standard start instead...
    call npx next start -p 3002 -H 0.0.0.0
)
pause
