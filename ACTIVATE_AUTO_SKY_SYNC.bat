@echo off
set "SYNC_SCRIPT=%~dp0RUN_CLOUD_SYNC_BACKGROUND.bat"
echo Creating Auto-Sync Shortcut in Startup...
 powershell "$s=(New-Object -COM WScript.Shell).CreateShortcut('%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ZionaAutoSync.lnk');$s.TargetPath='%SYNC_SCRIPT%';$s.WorkingDirectory='%~dp0';$s.Save()"
echo [SUCCESS] Auto-Sync added to Windows Startup.
pause
