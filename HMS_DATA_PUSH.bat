@echo off
setlocal enabledelayedexpansion

:: ==============================================================================
:: ZIONA CLOUD SHADOW SYNC (LOCAL TO NEON)
:: This tool pushes ALL DATA from Local Server to Neon Cloud.
:: WARNING: This will overwrite data on the Cloud with Local Server status.
:: ==============================================================================

cls
echo ======================================================================
echo           ZIONA HOSPITAL - CLOUD MASTER DATA SYNC (v3.5)
echo           Direction: [LOCAL SERVER] ---PUSH---^> [NEON CLOUD]
echo ======================================================================
echo.

:: 1. Load connection details from .env (requires sed/findstr or manual)
:: Since we know the .env variables from previous step, we can hardcode or extract.
:: Extraction logic:
set LOCAL_DB=postgresql://postgres:hms2035@localhost:5432/hms_db
set CLOUD_DB=postgresql://neondb_owner:npg_LKIg3tRXfbp9@ep-flat-firefly-a19fhxoa-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

echo [1/3] BACKING UP LOCAL HOSPITAL DATA...
:: Dump data. --clean drops tables on target before creation.
"pg_dump.exe" --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Postgres tools (pg_dump) not found in PATH.
    echo Please install Postgres or add bin folder to PATH.
    pause
    exit /b
)

:: Exporting to temporary file
pg_dump --clean --if-exists --no-owner --no-privileges --no-comments -d "%LOCAL_DB%" -f "local_shadow_dump.sql"
if %errorlevel% neq 0 (
    echo ERROR: Failed to dump local data.
    pause
    exit /b
)
echo SUCCESS: Local data extracted to shadow file.

echo.
echo [2/3] UPLOADING TO NEON CLOUD DATABASE...
echo Target: Neon Cloud (Singapore Vault)
echo WARNING: Overwriting Cloud Data now...

psql -d "%CLOUD_DB%" -f "local_shadow_dump.sql" > cloud_sync_log.txt 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Sync failed. Check 'cloud_sync_log.txt' for details.
    pause
    exit /b
)
echo SUCCESS: Neon Cloud Database is now identical to Local Server.

echo.
echo [3/3] CLEANING UP ASSETS...
del local_shadow_dump.sql
echo SUCCESS: Temporary files purged.

echo.
echo ======================================================================
echo             SYNC COMPLETE: CLOUD IS NOW LIVE WITH LOCAL DATA
echo ======================================================================
echo.
pause
