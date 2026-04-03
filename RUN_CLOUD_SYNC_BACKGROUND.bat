@echo off
title ZIONA HOSPITAL - CLOUD MASTER SYNC ENGINE (v3.5)
cls
echo ======================================================================
echo           ZIONA HOSPITAL - BACKGROUND CLOUD SYNC SERVICE
echo           Status: [ACTIVE] | Frequency: Every 10 Minutes
echo ======================================================================
echo.
echo Leave this window open on the server to keep your Cloud database 
echo updated with the latest Hospital data.
echo.

:loop
echo [%date% %time%] STARTING CLOUD PUSH...

:: Use the existing PUSH script
call ZIONA_DATA_PUSH.bat

echo.
echo [%date% %time%] Sync Successful. Waiting 10 minutes for next cycle...
echo (You can close this window at any time to stop syncing).
echo.

:: 600 seconds = 10 minutes
timeout /t 600 /nobreak
goto loop
