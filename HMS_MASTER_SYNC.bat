@echo off
setlocal enabledelayedexpansion
title ZIONA HMS - MASTER CLOUD SYNC (The Simple Fix)
color 0B
cls

echo ======================================================================
echo           ZIONA HOSPITAL - MASTER CLOUD SYNC
echo ======================================================================
echo.

:: 1. Force Structure Sync (Fixes HSN/Batch Column errors)
echo [1/2] Syncing Structure (Modernizing Neon)...
set DATABASE_URL=postgresql://neondb_owner:npg_LKIg3tRXfbp9@ep-flat-firefly-a19fhxoa-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
call npx prisma db push --accept-data-loss
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Could not sync Cloud structure. Check Internet.
    pause
    exit /b
)

echo.
echo [2/2] Mirroring Data (Laptop -> Neon Master)...
echo.
pg_dump --clean --if-exists --no-owner --no-privileges --no-comments -d "postgresql://postgres:hms2035@localhost:5432/hms_db" | psql -d "postgresql://neondb_owner:npg_LKIg3tRXfbp9@ep-flat-firefly-a19fhxoa-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Sync failed. Check credentials.
    pause
    exit /b
)

echo.
echo ======================================================================
echo           SUCCESS: YOUR CLOUD IS NOW A PERFECT MIRROR
echo ======================================================================
echo.
pause
