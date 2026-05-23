@echo off
TITLE Hospital ERP - Local Network Server
cd /d "%~dp0"
SETLOCAL EnableDelayedExpansion

echo ===================================================
echo    HOSPITAL ERP - LOCAL NETWORK LAUNCHER
echo ===================================================
echo.

:: 1. Auto-detect Local IP Address
for /f "tokens=4 delims= " %%i in ('route print ^| find " 0.0.0.0"') do (
    set LOCAL_IP=%%i
    goto :found_ip
)

:found_ip
if "%LOCAL_IP%"=="" (
    echo [ERROR] Could not detect Local IP. Please check your WiFi/LAN.
    pause
    exit
)

echo [INFO] Detected Server IP: %LOCAL_IP%
echo [INFO] Access URL: http://%LOCAL_IP%:3000
echo.

:: 2. Auto-configure Windows Firewall (Requires Admin)
echo [SYSTEM] Opening Firewall Port 3000...
netsh advfirewall firewall add rule name="Hospital ERP Server" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Firewall setup failed. Please run this file as ADMINISTRATOR.
) else (
    echo [SUCCESS] Firewall port 3000 is now open for LAN access.
)
echo.

:: 3. Inform User
echo ===================================================
echo  SERVER STARTING...
echo  Share this link with other systems:
echo  http://%LOCAL_IP%:3000
echo ===================================================
echo.

:: 4. Start the Application
:: We use 0.0.0.0 to bind to all network interfaces
npm run dev -- -H 0.0.0.0 -p 3000

pause
