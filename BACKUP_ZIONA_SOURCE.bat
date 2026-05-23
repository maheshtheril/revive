@echo off
setlocal
title HMS Source Backup Utility
color 0A

echo ========================================================
echo   HOSPITAL ERP - SOURCE CODE BACKUP (ZIONA)
echo ========================================================
echo.

:: Define target folder name
set "FOLDER_NAME=Ziona_Source_Backup"
set "DEST=..\%FOLDER_NAME%"

echo [1/2] Preparing target location...
if not exist "%DEST%" (
    mkdir "%DEST%"
) else (
    echo [INFO] Destination already exists. Updating files...
)

echo.
echo [2/2] Copying source files (Excluding heavy/private data)...
echo --------------------------------------------------------
echo EXCLUDING: node_modules, .next, .git, .env
echo --------------------------------------------------------

:: Use robocopy for high-speed, reliable copying with exclusions
:: /S - Copy subdirectories (excluding empty ones)
:: /E - Copy subdirectories (including empty ones)
:: /XD - Exclude Directories
:: /XF - Exclude Files
:: /R:3 - Retry 3 times on fail
:: /W:5 - Wait 5 seconds between retries
robocopy "." "%DEST%" /S /E /XD node_modules .next .git /XF .env *.log /R:3 /W:5

echo.
echo ========================================================
echo   BACKUP COMPLETE!
echo.
echo   Location: %DEST%
echo.
echo   You can now copy the "%FOLDER_NAME%" folder to your 
echo   USB or another computer.
echo ========================================================
echo.
pause
