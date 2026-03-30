@echo off
setlocal enabledelayedexpansion
cls

echo ===================================================
echo [Ziona HMS] LAN Access Configuration
echo ===================================================

:: Detect current IPv4 address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4 Address"') do (
    set "CURRENT_IP=%%a"
    set "CURRENT_IP=!CURRENT_IP: =!"
    goto :IP_FOUND
)

:IP_FOUND
echo.
echo Current IPv4: %CURRENT_IP%
echo Computer Name: %COMPUTERNAME%
echo.

echo 1. Adding Firewall Rule for Port 3000, 3001, 3002, and 8081 (HMS App)...
netsh advfirewall firewall add rule name="HMS_App_3000" dir=in action=allow protocol=TCP localport=3000 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="HMS_App_3001" dir=in action=allow protocol=TCP localport=3001 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="HMS_App_3002" dir=in action=allow protocol=TCP localport=3002 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="HMS_WhatsApp_8081" dir=in action=allow protocol=TCP localport=8081 profile=any >nul 2>&1

echo 2. Adding Firewall Rule for Port 5432 (Database Access)...
netsh advfirewall firewall add rule name="HMS_DB_5432" dir=in action=allow protocol=TCP localport=5432 profile=any >nul 2>&1

echo.
echo [SUCCESS] Firewall rules updated for the current network.
echo.
echo ===================================================
echo   CONNECT FROM OTHER SYSTEMS USING:
echo ===================================================
echo   - Option 1 (IP): http://%CURRENT_IP%:3000
echo   - Option 2 (Name): http://%COMPUTERNAME%:3000
echo ===================================================
echo.
pause
