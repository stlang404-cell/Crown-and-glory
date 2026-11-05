@echo off
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo Install the current Node.js LTS from https://nodejs.org then run this launcher again.
  pause
  exit /b 1
)
if not exist node_modules call npm ci
if errorlevel 1 goto failed
call npm run crownmaster:build
if errorlevel 1 goto failed
node scripts/serve.mjs --dir dist-crownmaster --open
exit /b
:failed
echo Crownmaster could not start. See the error above.
pause
