@echo off
echo ===================================================
echo     ZIONA HMS - DUAL-STAGE SYNC PIPELINE
echo ===================================================
echo.

echo [STAGE 1/2] Pulling cloud camp registrations to local...
node scripts/pull_camp_registrations.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [CRITICAL ERROR] Failed to pull camp registrations from cloud.
    echo Sync halted to prevent cloud data loss during overwrite.
    echo.
    pause
    exit /b %ERRORLEVEL%
)

echo [STAGE 1/2 SUCCESS] Cloud registrations pulled and merged.
echo.

echo [STAGE 2/2] Mirroring local database to Neon Cloud...
node smart_sync.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [CRITICAL ERROR] Failed to push local data mirror to cloud.
    echo.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo     SYNCHRONIZATION COMPLETED SUCCESSFULLY!
echo ===================================================
echo.
pause
