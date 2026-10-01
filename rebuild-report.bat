@echo off
cd /d %~dp0
echo 오늘 스크린샷은 그대로 두고, 비교/리포트만 다시 생성합니다...
node compare.js
node report.js
node publish.js
node copy.js
git add -A
git commit -m "rebuild report" 1>nul 2>nul
git push 1>nul 2>nul && echo   (웹 리포트 갱신 완료) || echo   (웹 업로드 건너뜀)
start "" "%~dp0reports\index.html"
echo.
echo 완료. (두레이 재알림은 보내지 않습니다)
pause
