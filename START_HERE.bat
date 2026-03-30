@echo off
setlocal enabledelayedexpansion
cls
echo ===================================================
echo           ZIONA HMS - ZERO-CLICK START
echo ===================================================
echo.
echo [1/4] Detecting your Computer IP...
node configure_ip.js

:: Capture the IP for display in this batch session
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4 Address"') do (
    set "LOCAL_IP=%%a"
    set "LOCAL_IP=!LOCAL_IP: =!"
    goto :IP_FOUND
)
:IP_FOUND

echo.
echo [2/4] Ensuring Database Settings are Correct...
node setup_whatsapp_local_db.js

echo.
echo [3/4] Opening Windows Firewall...
netsh advfirewall firewall add rule name="HMS_App_3000" dir=in action=allow protocol=TCP localport=3000 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="HMS_DB_5432" dir=in action=allow protocol=TCP localport=5432 profile=any >nul 2>&1

echo.
echo [4/4] Starting WhatsApp Bridge in a NEW window...
echo (Please scan the QR code in the OTHER window)
start "WhatsApp Bridge" cmd /c "RUN_WHATSAPP.bat"

echo.
echo ===================================================
echo   ALL SYSTEMS STARTING...
echo ===================================================
echo   - Local Access: http://localhost:3000
echo   - LAN Access 1: http://!LOCAL_IP!:3000
echo   - LAN Access 2: http://!COMPUTERNAME!:3000
echo ===================================================
echo.
echo TIP: Once the WhatsApp window is "Connected", 
echo you can test it by running: node TEST_WHATSAPP.js your_number
echo ===================================================
echo.
npm run dev
pause
