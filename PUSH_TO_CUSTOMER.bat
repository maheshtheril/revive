@echo off
title PRODUCTION PUSHER - Ziona Shield
color 0B

echo ===================================================
echo     PUSHING PRODUCTION UPDATE TO CUSTOMER
echo ===================================================
echo.

:: Check if git is initialized
if not exist .git (
    echo [ERROR] Git is not initialized in this folder!
    echo Run "git init" and connect your repository first.
    pause
    exit /b
)

:: Syncing files to Git
echo [1/3] Adding changes...

:: OPTIMIZATION: Increasing buffer for large builds
git config http.postBuffer 524288000
git config core.lowSpeedLimit 0
git config core.lowSpeedTime 999999

:: SMART SYNC: Reset index to ensure we don't push bulky files (like node_modules)
git rm -r --cached . >nul 2>&1
git add .

echo [2/3] Committing changes...
set /p commitMsg="Enter Update Message (or press Enter for 'Production Update'): "
if "%commitMsg%"=="" set commitMsg=Production Update
git commit -m "%commitMsg%"

echo.
echo [3/3] Pushing to Repository...
git push origin production

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed! Check your internet or Git config.
    pause
    exit /b
)

echo.
echo ===================================================
echo   SUCCESS: Production update is now available!
echo   Go to Customer PC and run "git pull"
echo ===================================================
echo.
pause
