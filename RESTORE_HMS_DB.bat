@echo off
setlocal enabledelayedexpansion
echo ==========================================
echo   ZIONA HMS - PRODUCTION RESTORE TOOL
echo ==========================================
echo.

:: 🔍 AUTO-FIND POSTGRES BIN FOLDER
set "PG_BIN="
for /d %%i in ("C:\Program Files\PostgreSQL\*") do (
    if exist "%%i\bin\psql.exe" set "PG_BIN=%%i\bin"
)

if "%PG_BIN%"=="" (
    echo [ERROR] Could not find PostgreSQL installation!
    echo Please make sure PostgreSQL is installed in C:\Program Files\PostgreSQL
    pause
    exit /b 1
)

:: ADD TO PATH FOR THIS SESSION ONLY
set "PATH=%PG_BIN%;%PATH%"
echo [INFO] Found PostgreSQL at: %PG_BIN%

:: SET SETTINGS
set DB_NAME=hms_db
set DB_USER=postgres
set BACKUP_FILE=hms_db_clean_PRO.backup

:: CHECK IF BACKUP EXISTS
if not exist "%BACKUP_FILE%" (
    echo [ERROR] Backup file %BACKUP_FILE% not found!
    pause
    exit /b 1
)

echo [STEP 1/2] Creating/Cleaning Database...
set /p PGPASSWORD="Enter PostgreSQL Password: "

:: Force Drop and Create
psql -U %DB_USER% -d postgres -c "DROP DATABASE IF EXISTS %DB_NAME% WITH (FORCE);"
psql -U %DB_USER% -d postgres -c "CREATE DATABASE %DB_NAME%;"

echo.
echo [STEP 2/2] Restoring Clinical Master Configuration...
pg_restore -U %DB_USER% -d %DB_NAME% --clean --if-exists "%BACKUP_FILE%"

echo.
echo ==========================================
echo ✅ RESTORE COMPLETE! 
echo Your Customer's HMS is now ready for use.
echo ==========================================
echo.
pause
