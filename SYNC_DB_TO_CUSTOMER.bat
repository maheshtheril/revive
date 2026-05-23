@echo off
title ZIONA HMS - DATABASE SYNC (LAPTOP TO CUSTOMER)
color 0B
cls

echo ===================================================
echo     ZIONA HMS - PRODUCTION DATA SYNC
echo ===================================================
echo.

:: 🔍 AUTO-FIND POSTGRES BIN FOLDER
set "PG_BIN="
for /d %%i in ("C:\Program Files\PostgreSQL\*") do (
    if exist "%%i\bin\pg_dump.exe" set "PG_BIN=%%i\bin"
)

if "%PG_BIN%"=="" (
    echo [ERROR] Could not find PostgreSQL installation!
    pause
    exit /b 1
)

set "PATH=%PG_BIN%;%PATH%"

:: CONFIG
set LOCAL_DB=hms_db
set /p CUSTOMER_IP="Enter Customer IP (Default: 10.190.80.178): "
if "%CUSTOMER_IP%"=="" set CUSTOMER_IP=10.190.80.178

echo.
echo [1/2] Dumping latest data from Laptop...
pg_dump --clean --if-exists --no-owner --no-privileges -U postgres -d %LOCAL_DB% -f "customer_update.sql"

if %errorlevel% neq 0 (
    echo [ERROR] Failed to dump local data.
    pause
    exit /b
)

echo.
echo [2/2] Pushing data to Customer System (%CUSTOMER_IP%)...
psql -h %CUSTOMER_IP% -U postgres -d hms_db -f "customer_update.sql"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed! 
    echo 1. Is the Customer System turned on?
    echo 2. Did you run allow_lan_access.bat on the Customer System?
    echo 3. Is the password correct?
    pause
    exit /b
)

echo.
echo ===================================================
echo   SUCCESS: Customer Database is now UP TO DATE!
echo ===================================================
del customer_update.sql
pause
