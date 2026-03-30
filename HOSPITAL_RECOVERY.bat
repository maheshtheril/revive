@echo off
title HOSPITAL RECOVERY - ZIONA SHIELD
color 0E

echo ===================================================
echo   HOSPITAL RECOVERY - EMERGENCY REPAIR (v3)
echo ===================================================
echo.

echo [1/6] Stopping active services...
taskkill /F /IM node.exe /T >nul 2>&1
echo Services stopped.

echo [2/6] Syncing Database Schema (One-Click Fix)...
echo This may take a minute...
node tmp/migrate_columns_v2.js
call npx prisma generate
call npx prisma db push --accept-data-loss

echo [3/6] Configuring Local Network IP...
node configure_ip.js

echo [4/6] Rebuilding System (Fixing Skeleton/styles)...
echo Building optimized version...
call npm run build

echo [5/6] Opening Security Ports (Windows Firewall)...
netsh advfirewall firewall add rule name="HMS_Port_3000" dir=in action=allow protocol=TCP localport=3000 profile=any >nul 2>&1
echo Firewall ready.

echo [6/6] Launching FAST Production Server...
echo.
echo ===================================================
echo   SUCCESS: Hospital is Online!
echo ===================================================
echo.
npm start
pause
