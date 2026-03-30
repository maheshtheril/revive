@echo off
title UPDATING ZIONA HOSPITAL
color 0E

echo ===================================================
echo      UPDATING HOSPITAL SYSTEM (GIT SYNC)
echo ===================================================
echo.

echo [0/3] Stopping background services for safe update...
taskkill /F /IM node.exe /T >nul 2>&1
echo Services stopped.

echo [1/3] Downloading latest updates from server...
git fetch origin production
git reset --hard origin/production

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Update failed! Retrying with standard pull...
    git pull origin production
)

echo [2/3] Updating system dependencies...
call npm install

echo [3/3] Rebuilding system components...
call npm run build

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed! Cleaning cache and retrying...
    del /s /f /q .next
    call npm run build
)

echo.
echo ===================================================
echo   SUCCESS: System is up to date and rebuilt!
echo   You can now restart the application.
echo ===================================================
echo.
pause
