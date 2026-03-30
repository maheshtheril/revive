@echo off
echo ===================================================
echo [HMS] One-Click LAN Deployment
echo ===================================================

echo.
echo 1. Detecting and Configuring Local IP...
node configure_ip.js

echo.
echo 2. Ensuring Firewall Rules are Active...
netsh advfirewall firewall add rule name="HMS_App_3000" dir=in action=allow protocol=TCP localport=3000 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="HMS_DB_5432" dir=in action=allow protocol=TCP localport=5432 profile=any >nul 2>&1

echo.
echo 3. Starting Application...
echo Please share the URL printed above with your other laptops.
echo.
npm run dev
pause
