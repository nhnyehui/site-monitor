@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 사이트 모니터링 - 설치
echo.
echo ============================================
echo  사이트 모니터링 설치
echo  (처음 한 번만 실행하면 됩니다. 몇 분 걸립니다)
echo ============================================
echo.

echo [1/5] Node.js 확인 중...
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [중단] Node.js 가 설치되어 있지 않습니다.
  echo   https://nodejs.org 에서 초록색 LTS 버튼을 눌러 받고,
  echo   전부 기본값으로 설치한 뒤 이 파일을 다시 실행하세요.
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo   Node.js %%v 확인

echo [2/5] 프로그램 라이브러리 설치 중... (시간이 걸립니다)
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo   [중단] 라이브러리 설치 실패. 인터넷 연결을 확인하고 다시 실행하세요.
  pause
  exit /b 1
)

echo [3/5] 캡쳐용 브라우저 설치 중...
call npx playwright install chromium
if errorlevel 1 (
  echo   [중단] 브라우저 설치 실패. 인터넷 연결을 확인하고 다시 실행하세요.
  pause
  exit /b 1
)

echo [4/5] 설정 파일 준비 중...
node make-config.js

echo [5/5] 매일 아침 9시 자동 실행 등록 중...
rem 예전 이름으로 등록된 작업이 있으면 지운다 (중복 실행으로 알림이 두 번 오는 것을 막는다)
schtasks /Delete /TN "사이트 모니터링" /F >nul 2>nul
node install-task.js

echo.
echo ============================================
echo  설치 완료
echo.
echo  다음 순서로 확인하세요.
echo   1) 진단.bat  을 더블클릭해 [정상] 만 나오는지 확인
echo   2) 실행.bat  을 더블클릭해 실제로 한 번 돌려보기
echo   3) 두레이 채팅방에 알림이 왔는지 확인
echo ============================================
echo.
pause
