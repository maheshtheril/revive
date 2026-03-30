@echo off
title INITIALIZING GIT - Ziona Shield
color 0A

echo ===================================================
echo    CONNECTING PRODUCTION APP TO GITHUB
echo ===================================================
echo URL: https://github.com/maheshtheril/ZIONA_HOSPITAL.git
echo.

if exist .git (
    echo [INFO] Git is already initialized!
    echo.
    set /p choice="Do you want to re-initialize? (Y/N): "
    if /i "%choice%" neq "Y" exit /b
    rmdir /s /q .git
)

echo [1/4] Initializing Git...
git init
git checkout -b production

echo [2/4] Connecting to Remote...
git remote add origin https://github.com/maheshtheril/ZIONA_HOSPITAL.git

echo [3/4] Adding Production Bundle...
git add .
git commit -m "System: Connection Established"

echo [4/4] Pushing to GitHub...
git push -u origin production

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed! 
    echo Please make sure:
    echo 1. You created the repository on GitHub.
    echo 2. It is blank (no README).
    echo 3. You have logged in to Git.
    pause
    exit /b
)

echo.
echo ===================================================
echo   SUCCESS: Connection Complete!
echo   You can now use "PUSH_TO_CUSTOMER.bat" from now on.
echo ===================================================
echo.
pause
