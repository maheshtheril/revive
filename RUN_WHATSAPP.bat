@echo off
title WhatsApp Bridge
color 0E

echo ===================================================
echo   WhatsApp Bridge Service
echo ===================================================
echo.

if not exist whatsapp-bridge goto :MISSING_DIR

cd whatsapp-bridge

if not exist node_modules goto :INSTALL_DEPS
goto :START_SERVICE

:INSTALL_DEPS
echo [1/3] Installing dependencies (first time only)...
call npm install
if errorlevel 1 goto :INSTALL_FAILED

:START_SERVICE
echo.
echo [2/3] Starting WhatsApp Bridge Service...
echo.
echo IMPORTANT: If this is your first time, you will see a QR code.
echo Please scan it with your phone's WhatsApp.
echo.
node server.js
if errorlevel 1 (
    echo [WARNING] WhatsApp Bridge Service stopped with error.
)
echo.
echo Bridge session ended or disconnected. Restarting in 5 seconds...
timeout /t 5
goto :START_SERVICE

:MISSING_DIR
echo [ERROR] Directory 'whatsapp-bridge' not found.
pause
exit /b

:INSTALL_FAILED
echo [ERROR] Dependency installation failed. Check your internet connection.
pause
exit /b

:SERVICE_FAILED
echo [ERROR] WhatsApp Bridge Service stopped unexpectedly.
pause
exit /b
