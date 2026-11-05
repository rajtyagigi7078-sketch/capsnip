@echo off
setlocal
cd /d "%~dp0"
if exist "node_modules\electron\dist\electron.exe" goto run
echo Capsnip's desktop runtime is missing from this folder.
echo Install Node.js, then run npm install from this folder and retry.
pause
exit /b 1
:run
"%~dp0node_modules\electron\dist\electron.exe" .
if errorlevel 1 (
  echo Capsnip could not start. Check that the app files are intact.
  pause
  exit /b 1
)
endlocal
