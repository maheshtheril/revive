@echo off
setlocal
title ZIONA HMS - CLOUD REPAIR ^& MASTER SYNC (v4.0)
color 0B
cls

echo ======================================================================
echo           ZIONA HOSPITAL - CLOUD REPAIR ^& MASTER SYNC
echo           This script will fix all "Column Missing" errors.
echo ======================================================================
echo.

:: Connection Details from .env
node REPAIR_CUSTOMER_CLOUD.js
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Could not sync Cloud. Check your .env credentials.
    pause
    exit /b
)

echo.
echo ======================================================================
echo           SYNC COMPLETE: YOUR CLOUD IS NOW 100%% PERFECT
echo ======================================================================
echo.
pause
