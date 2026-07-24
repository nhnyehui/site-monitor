@echo off
cd /d %~dp0
echo === 원격 재설정 ===
git remote remove origin 2>nul
git remote add origin https://github.com/nhnyehui/site-monitor.git
git branch -M main
echo === 커밋 ===
git add -A
git commit -m "web report publish"
echo.
echo === GitHub 업로드 (로그인 창이 뜨면 반드시 로그인 완료) ===
git push -u origin main --force
echo.
echo ==================================================
echo  성공: "main -> main" 또는 "Everything up-to-date"
echo  실패: error / rejected / fatal / 403 등이 보이면 그 줄을 알려주세요
echo ==================================================
pause
