@echo off
title ZIONA HMS - COMMAND CENTER
color 0B
SETLOCAL EnableDelayedExpansion

:MENU
cls
echo ===================================================
echo           ZIONA HMS - COMMAND CENTER
echo ===================================================
echo.
echo [1] START HOSPITAL (Full Suite)
echo [2] STOP ALL SERVICES
echo [3] SYNC TO CLOUD (Mirror Backup)
echo [4] WHATSAPP STATUS / RE-CONNECT
echo [5] SYSTEM HEALTH & LOGS
echo [6] PUBLISH UPDATES (Cloud + Local)
echo [7] EXIT
echo.
echo ===================================================
set /p opt="Select an option (1-6): "

if "%opt%"=="1" goto START_HOSP
if "%opt%"=="2" goto STOP_HOSP
if "%opt%"=="3" goto CLOUD_SYNC
if "%opt%"=="4" goto WA_STATUS
if "%opt%"=="5" goto HEALTH
if "%opt%"=="6" goto PUBLISH
if "%opt%"=="7" exit

goto MENU

:START_HOSP
echo.
echo [INFO] Engaging Enterprise Engines...
start /min cmd /c "node smart_guard.js"

:: --- SHIELD DETECTION ---
if exist .ziona_shield (
    echo [SHIELD] Production Mode Active ^(Lightning Fast ^& Secure^)
    start "ZIONA HOSPITAL" cmd /c "npm start"
) else (
    echo [DEV] Developer Mode Active ^(Live Reloading Enabled^)
    start "ZIONA HOSPITAL" cmd /c "npm run dev"
)
:: -------------------------

goto MENU


:STOP_HOSP
echo.
echo [WARNING] Shutting down hospital services...
taskkill /F /FI "WINDOWTITLE eq ZIONA HOSPITAL" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq WhatsApp Bridge" >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1
echo [SUCCESS] All systems offline.
pause
goto MENU

:CLOUD_SYNC
echo.
call SYNC_TO_CLOUD.bat
goto MENU

:WA_STATUS
echo.
echo [INFO] Opening WhatsApp Bridge Console...
start RUN_WHATSAPP.bat
goto MENU

:HEALTH
echo.
echo --- RECENT SYSTEM EVENTS ---
if exist ziona_guard.log (
    tail -n 20 ziona_guard.log
) else (
    echo [INFO] No events recorded yet.
)
echo.
pause
goto MENU
:PUBLISH
echo.
call PUBLISH_LIVE.bat
goto MENU
