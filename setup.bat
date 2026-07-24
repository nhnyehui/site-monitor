@echo off
cd /d %~dp0
echo ============================================
echo  Site Monitor - First time setup
echo  (takes a few minutes, run only once)
echo ============================================
call npm install
call npx playwright install chromium
echo.
echo Setup complete! Now you can double-click run.bat
pause
