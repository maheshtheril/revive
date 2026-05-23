@echo off
setlocal
title ZIONA HMS - DATABASE SYNCHRONIZER
color 0B

echo ===================================================
echo   ZIONA HMS - DATABASE SYNC TOOL (V4.2)
echo ===================================================
echo.

:menu
echo  [1] SYNC LAPTOP (Localhost:5432)
echo  [2] SYNC NEON CLOUD (Production)
echo  [3] EXIT
echo.
set /p choice="Select Database to Sync: "

if "%choice%"=="1" goto sync_local
if "%choice%"=="2" goto sync_neon
if "%choice%"=="3" goto exit

:sync_local
echo.
echo [LAPTOP] Starting Localhost Synchronization...
call npx prisma db push
echo.
echo [SUCCESS] Localhost database structure is now synchronized!
pause
goto menu

:sync_neon
echo.
echo [NEON] Starting Neon Cloud (Production) Synchronization...
:: Setting the environment variable for this session
set DATABASE_URL=postgresql://neondb_owner:npg_Y1Vstn7wSreW@ep-cold-shadow-a1ler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
call npx prisma db push
echo.
echo [SUCCESS] Neon Cloud database structure is now synchronized!
pause
goto menu

:exit
exit
