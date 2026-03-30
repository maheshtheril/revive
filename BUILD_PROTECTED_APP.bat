@echo off
setlocal
title ZIONA HMS - PRODUCTION BUILDER
color 0E

echo ===================================================
echo   ZIONA HMS - HIGH-SPEED PRODUCTION BUILDER
echo ===================================================
echo.

:: 1. PRISMA AND NEXT BUILD
echo [1/3] Compiling Application Engine...
call npm run build

:: 2. PREPARE ASSETS (FIXES "SKELETON" LOOK)
echo [2/3] Preparing Design Assets (CSS/Images)...
if exist ".next\standalone" (
    xcopy /E /I /Y "public" ".next\standalone\public" >nul 2>&1
    xcopy /E /I /Y ".next\static" ".next\standalone\.next\static" >nul 2>&1
    echo   [SUCCESS] Beauty assets synchronized.
)

:: 3. SHIELD PROTECTION
echo [3/3] Finalizing Production Bundle...
if exist "shield_packager.js" (
    node shield_packager.js
)

echo.
echo ===================================================
echo   SUCCESS: Production Build Ready!
echo   Run START_HOSPITAL_NEW.bat now.
echo ===================================================
pause
