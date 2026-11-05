@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-engine.ps1"
if errorlevel 1 (
  echo.
  echo Capsnip speech setup did not finish. Read the message above, then run this file again.
  pause
  exit /b 1
)
echo.
echo Capsnip speech engine is ready. Start the app with Start-Capsnip.cmd.
pause
