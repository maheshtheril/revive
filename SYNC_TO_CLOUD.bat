@echo off
SETLOCAL EnableDelayedExpansion

echo ===================================================
echo          ZIONA HMS - CLOUD SYNC TOOL
echo ===================================================
echo.

:: 1. Check if Cloud is configured
findstr "CLOUD_DATABASE_URL" .env >nul
if %errorlevel% neq 0 (
    echo [MISSING SETUP] You haven't configured the Cloud Database yet.
    echo.
    echo Starting Cloud Setup Wizard...
    node configure_cloud.js
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Setup failed. Please try again or check your Cloud URL.
        pause
        exit /b %errorlevel%
    )
    echo.
    echo Setup complete! Now starting the first sync...
    echo.
)

:: 2. Run the Smart Sync
node smart_sync.js

if %errorlevel% equ 0 (
    echo.
    echo ===================================================
    echo SUCCESS: Cloud Mirror is now 100%% up to date.
    echo ===================================================
) else (
    echo.
    echo [ERROR] Sync failed. Check the messages above.
)

pause
