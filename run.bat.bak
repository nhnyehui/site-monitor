@echo off
cd /d %~dp0
rem === 주말(토/일)에는 실행하지 않음 ===
node -e "d=new Date().getDay();process.exit(d===0||d===6?1:0)"
if errorlevel 1 (
  echo 주말(토/일)에는 실행하지 않습니다. 종료합니다.
  exit /b
)
echo [1/6] Taking screenshots...
node monitor.js
echo [2/6] Comparing...
node compare.js
echo [3/6] Building local report...
node report.js
echo [4/6] Copying to Google Drive...
node copy.js
echo [5/6] Publishing web report + upload to GitHub...
node publish.js
git add -A
git commit -m "report %DATE%" 1>nul 2>nul
git push || echo   (GitHub 업로드 실패 - web-fix.bat 실행 필요)
echo [6/6] Sending to Dooray...
node notify.js
start "" "%~dp0reports\index.html"
