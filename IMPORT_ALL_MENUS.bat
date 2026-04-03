@echo off
setlocal enabledelayedexpansion
title ZIONA HMS - MASTER MENU IMPORT
color 0A

echo ===================================================
echo   ZIONA HMS - IMPORTING MASTER MENUS FROM LAPTOP
echo ===================================================
echo.

:: 1. FIND PSQL
set PSQL_PATH=psql
if not exist "!PSQL_PATH!.exe" (
    echo Searching for PostgreSQL installation...
    for /d %%d in ("C:\Program Files\PostgreSQL\*") do (
        if exist "%%d\bin\psql.exe" (
            set PSQL_PATH="%%d\bin\psql.exe"
            echo   Found at !PSQL_PATH!
        )
    )
)

:: 2. DATABASE URL CHECK
if "%DATABASE_URL%" == "" (
    set DATABASE_URL="postgresql://postgres:hms2035@localhost:5432/hms_db"
)

echo [2/3] Importing SYNC_CLIENT_MENUS.sql...
!PSQL_PATH! %DATABASE_URL% -f SYNC_CLIENT_MENUS.sql

echo.
echo ===================================================
echo   SUCCESS: Laptop Menus Imported to Customer!
echo   1. Log out of the ERP.
echo   2. Log back in (Admin user).
echo ===================================================
pause
