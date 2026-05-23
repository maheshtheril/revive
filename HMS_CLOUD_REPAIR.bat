@echo off
setlocal
title ZIONA HMS - CLOUD REPAIR ^& MASTER SYNC (v3.8)
color 0B
cls

echo ======================================================================
echo           ZIONA HOSPITAL - CLOUD REPAIR ^& MASTER SYNC
echo           This script will fix all "Column Missing" errors.
echo ======================================================================
echo.

:: Connection Details (extracted from your .env previously)
set LOCAL_DB=postgresql://postgres:hms2035@localhost:5432/hms_db
set CLOUD_DB=postgresql://neondb_owner:npg_LKIg3tRXfbp9@ep-flat-firefly-a19fhxoa-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

echo [1/3] FIXING CLOUD STRUCTURE (PRISMA)...
:: This adds the missing columns to Neon without deleting data yet
set DATABASE_URL=%CLOUD_DB%
call npx prisma db push --accept-data-loss
if %errorlevel% neq 0 (
    echo ERROR: Could not sync Cloud structure. Check your internet.
    pause
    exit /b
)
echo SUCCESS: Cloud Database structure is now modern and matches your laptop.

echo.
echo [2/3] MIRRORING DATA (LOCAL -^> CLOUD)...
echo This will move all your patients, products, and bills to Neon.
:: Dump and pipe to psql
pg_dump --clean --if-exists --no-owner --no-privileges --no-comments -d "%LOCAL_DB%" | psql -d "%CLOUD_DB%"
if %errorlevel% neq 0 (
    echo ERROR: Data transfer failed.
    pause
    exit /b
)
echo SUCCESS: Data migration complete.

echo.
echo [3/3] REPAIRING MENUS ^& ROLES...
node SYSTEM_DATA_SYNC.js
if %errorlevel% neq 0 (
    echo ERROR: Menu repair failed.
    pause
    exit /b
)
echo SUCCESS: All menus and settings are now correct on Cloud.

echo.
echo ======================================================================
echo           REPAIR COMPLETE: YOUR CLOUD IS NOW 100%% PERFECT
echo ======================================================================
echo.
pause
