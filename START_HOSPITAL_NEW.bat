@echo off
setlocal
title HMS - HIGH-SPEED PRODUCTION CONSOLE
color 0B
cd /d "%~dp0"

echo ========================================================
echo   HOSPITAL MANAGEMENT SYSTEM - PRODUCTION GATEWAY
echo ========================================================
echo.

:: 0. PRE-FLIGHT CHECKS
echo [0/3] Checking environment...

:: Verify Node.js
node -v >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is NOT installed or not in PATH.
    echo Please install Node.js version 20 or higher.
    pause
    exit /b 1
)

:: Verify node_modules
if not exist "node_modules\prisma\package.json" (
    echo [ALERT] System dependencies missing or incomplete.
    echo Running npm install...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

:: 1. HARD-STOP OLD SLOW PROCESSES
echo [1/3] Resetting all node engines...
taskkill /F /IM node.exe /T >nul 2>&1
echo Done.

:: [PRISMA SELF-HEAL] Generate Database Client
echo [2/3] Preparing Database Engines...
call npx prisma generate
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [WARNING] Prisma Generate failed.
    echo System will attempt to use existing cached database engines.
    echo If the app fails to start, check your DATABASE_URL in the .env file.
    timeout /t 3 /nobreak >nul
) else (
    echo Engine Restore SUCCESS.
)

:: [NEW] AUTO-CONFIGURE IP
echo [2/3] Auto-Configuring Network IP...
node configure_ip.js
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] IP Config failed.
    pause
)

echo [3/3] Launching WhatsApp Bridge...
if exist "whatsapp-bridge\server.js" (
    cd /d "%~dp0whatsapp-bridge"
    if not exist "node_modules" (
        echo [INFO] Installing Bridge dependencies...
        call npm install
    )
    start /B "HMS_BRIDGE" cmd /c "node server.js > bridge.log 2>&1"
    cd /d "%~dp0"
)

:: Wait 2 seconds
timeout /t 2 /nobreak >nul

:: 3. LAUNCH PRODUCTION SERVER
echo [3/3] Launching Dashboard...
set PORT=3002
set HOSTNAME=0.0.0.0
set "URL=http://localhost:3002/"

:: Launch Chrome
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=%URL%
) else (
    start %URL%
)

:: START FINAL ENGINE
if exist ".next\standalone\server.js" (
    echo Starting in HIGH-SPEED Standalone Mode...
    node .next/standalone/server.js
) else (
    if not exist ".next\BUILD_ID" (
        echo [ALERT] Production build missing or incomplete.
        echo Building the application...
        :: Clean up broken build folder
        if exist ".next" rd /s /q ".next"
        call npm run build
        if %ERRORLEVEL% NEQ 0 (
            echo [ERROR] Build failed.
            pause
            exit /b 1
        )
    )
    echo Starting in STANDARD Production Mode...
    call npx next start -p 3002 -H 0.0.0.0
)

echo.
echo Application stopped.
pause
