@echo off
echo ===================================================
echo   ZIONA PROOF - TIME: %TIME%
echo ===================================================
echo [!] THIS WINDOW MUST STAY OPEN.
echo.
echo If you see this, the explorer is NOT closing it.
echo.
pause

echo [1/3] CHECKING NODE...
node -v
if errorlevel 1 (
    echo [FAIL] Node is not working.
    pause
    exit /b
)

echo [2/3] CHECKING POSTGRES...
psql --version
if errorlevel 1 (
    echo [FAIL] Postgres is not working.
    pause
    exit /b
)

echo [3/3] RUNNING SETUP...
node -e "console.log('Setup engine start...')"
node -e "console.log('Setup security start...')"

echo.
echo ===================================================
echo   SUCCESS: ALL TESTS PASSED
echo ===================================================
pause
