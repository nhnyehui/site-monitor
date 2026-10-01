@echo off
cd /d %~dp0
git --version 1>nul 2>nul || (echo [!] Git이 없습니다. https://git-scm.com/download/win 에서 설치 후 다시 실행하세요. & pause & exit /b)
git init 1>nul 2>nul
git config user.email "bot@site-monitor.local"
git config user.name "site-monitor"
git branch -M main 1>nul 2>nul
git add -A
git commit -m "site-monitor web report" 1>nul 2>nul
git remote remove origin 1>nul 2>nul
git remote add origin https://github.com/nhnyehui/site-monitor.git
echo.
echo === GitHub 로그인 창이 뜨면 로그인하세요 (최초 1회) ===
git push -u origin main --force
echo.
echo 완료되면 GitHub 저장소 Settings ^> Pages 에서
echo   Source: Deploy from a branch / Branch: main / 폴더: /docs  로 설정하세요.
echo 1~2분 뒤 https://nhnyehui.github.io/site-monitor/ 에서 열립니다.
pause
