@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title ZIONA ERP - ULTIMATE INSTALLER v7.0
color 0B

:: Ensure we are in the right folder
cd /d "%~dp0"

cls
echo.
echo  =========================================================
echo.
echo     ███████╗██╗ ██████╗ ███╗   ██╗ █████╗ 
echo     ╚══███╔╝██║██╔═══██╗████╗  ██║██╔══██╗
echo       ███╔╝ ██║██║   ██║██╔██╗ ██║███████║
echo      ███╔╝  ██║██║   ██║██║╚██╗██║██╔══██║
echo     ███████╗██║╚██████╔╝██║ ╚████║██║  ██║
echo     ╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝
echo.
echo         ENTERPRISE ERP - FINAL STABLE v7.0
echo             (THE ZIONA STANDARD UNLOCK)
echo  =========================================================
echo.

echo [1/2] Checking Environment Core...
where node >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] Node.js is missing. Please install it.
    pause & exit /b
)
echo [SUCCESS] Platform Ready.
echo.

echo [2/2] Launching Ziona Standard Orchestrator...
echo.
node setup_database.js

if !ERRORLEVEL! NEQ 0 (
    echo.
    echo [!] INSTALLATION FAILED.
    pause & exit /b
)

echo.
echo =========================================================
echo   ZIONA ERP DEPLOYED SUCCESSFULLY!
echo =========================================================
echo 1. Check your Desktop for "Ziona ERP"
echo 2. Or run: START_HOSPITAL.bat
echo =========================================================
set "URL=http://localhost:3000/"
:: Start the Hospital Server instead of just popping the browser
start START_HOSPITAL.bat
goto :eof
