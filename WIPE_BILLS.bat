@echo off
title ZIONA HMS - EMERGENCY DATA WIPE
color 0C
echo ========================================================
echo   ZIONA HMS - EMERGENCY DATA WIPE UTILITY
echo ========================================================
echo.
echo [WARNING] THIS WILL PERMANENTLY DELETE:
echo 1. ALL Patient Invoices / Bills
echo 2. ALL Payments and Receipts
echo 3. ALL Sales Returns
echo 4. ALL Accounting Journal Entries (Invoices Only) 
echo.
set /p confirm="Are you SURE you want to DELETE ALL BILLS? (type YES to confirm): "
if /i "%confirm%" neq "YES" goto :CANCEL

echo.
echo [1/1] Wiping data...
node wipe_billing_data.js
echo.
echo WIPE COMPLETE.
pause
exit /b

:CANCEL
echo.
echo Operation cancelled. No data was deleted.
pause
exit /b
