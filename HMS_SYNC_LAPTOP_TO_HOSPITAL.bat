@echo off
setlocal enabledelayedexpansion
title ZIONA HMS - LAPTOP TO HOSPITAL MASTER SYNC
color 0B
cls

echo ======================================================================
echo           ZIONA HOSPITAL - MASTER DATA SYNC (LAPTOP TO SERVER)
echo           Direction: [YOUR LAPTOP] ---PUSH---^> [HOSPITAL SERVER]
echo           (This will copy ALL your latest Mobile Audit data to Server)
echo ======================================================================
echo.

:: 1. Ask for Hospital IP
set /p HOSPITAL_IP="Enter Hospital Server IP (e.g. 192.168.1.50): "

if "%HOSPITAL_IP%"=="" (
    echo [ERROR] No IP entered!
    pause
    exit /b
)

:: 2. Connection Details (Assuming standard credentials for hospital)
set LOCAL_DB="postgresql://postgres:hms2035@localhost:5432/hms_db"
set REMOTE_DB="postgresql://postgres:hms2035@%HOSPITAL_IP%:5432/hms_db"

echo.
echo [1/3] CHECKING CONNECTIVITY TO LOCAL REPOSITORY...
"pg_dump.exe" --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Postgres tools (pg_dump) not found in PATH!
    echo Please ensure you have PostgreSQL installed on your laptop.
    pause
    exit /b
)

echo.
echo [2/3] EXTRACTING DATA FROM YOUR LAPTOP...
pg_dump --clean --if-exists --no-owner --no-privileges --no-comments -d %LOCAL_DB% -f "master_export.sql"

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to dump local data. Is Postgres running locally on your laptop?
    pause
    exit /b
)

echo.
echo [3/3] MIRRORING TO HOSPITAL SERVER (%HOSPITAL_IP%)...
echo WARNING: This will overwrite EVERYTHING on the Hospital Server with your Laptop Data!
echo.
echo Press any key to start the FINAL SYNC...
pause >nul

psql -d %REMOTE_DB% -f "master_export.sql"

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Sync failed!
    echo TIP 1: Is the Hospital Server IP unreachable? (Check Wi-Fi)
    echo TIP 2: Is Port 5432 or Firewall blocking the connection?
    pause
    exit /b
)

:: 4. Cleanup
del master_export.sql

echo.
echo ======================================================================
echo           SUCCESS: HOSPITAL SERVER IS NOW MASTER SYNCED!
echo           (The hospital server is now an exact mirror of your laptop)
echo ======================================================================
echo.
pause
