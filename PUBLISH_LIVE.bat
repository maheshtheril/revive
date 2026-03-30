@echo off
title ZIONA ERP - MASTER PUBLISH (Cloud + Local)
color 0B
SETLOCAL EnableDelayedExpansion

echo ===================================================
1: echo           ZIONA ERP - MASTER PUBLISH
echo ===================================================
echo.
echo This script will synchronize your system across:
echo 1. CLOUD (Git Push to Vercel/Neon)
echo 2. LOCAL (Build and Update ZIONA_HOSPITAL)
echo.
set /p confirm="Are you sure you want to publish all changes? (y/n): "
if /i "%confirm%" neq "y" exit /b

echo.
echo [1/3] SYNCING TO CLOUD (GITHUB)...
git add .
set /p msg="Enter update message (default: System Update): "
if "!msg!"=="" set msg=System Update
git commit -m "!msg!"
git push origin main

if %errorlevel% neq 0 (
    echo [ERROR] Git push failed. Please check your internet connection.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] BUILDING LOCAL PRODUCTION...
call BUILD_PROTECTED_APP.bat

if %errorlevel% neq 0 (
    echo [ERROR] Local build failed.
    pause
    exit /b %errorlevel%
)

echo.
echo [3/3] FINALIZING UPDATES...
echo.
echo ===================================================
echo   SUCCESS: CLOUD AND LOCAL ARE NOW IN SYNC!
echo ===================================================
echo 1. Cloud: Live on Vercel
echo 2. Local: Updated in C:\2035-HMS\ZIONA_HOSPITAL
echo ===================================================
pause
