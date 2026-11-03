@echo off
REM Crown & Calculation - one-click Windows launcher.
REM Builds the game on first run (needs Node.js 20+ from https://nodejs.org), then serves it locally
REM on a free port and opens your browser. Close this window to stop the game server.
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install the LTS version from https://nodejs.org and run this file again.
  echo Alternatively, if a prebuilt "dist" folder exists, run Start-Crown.ps1 which needs no Node.js.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo First run: installing dependencies and building Crown ^& Calculation. This takes a minute...
  call npm ci || call npm install || goto :fail
  call npm run build || goto :fail
)
node scripts\serve.mjs --dir dist --port 5173 --open
goto :eof
:fail
echo Build failed. See the messages above.
pause
exit /b 1
