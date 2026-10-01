@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem ============================================================
rem  run.bat - 매일 자동으로 실행되는 본체
rem   실행.bat 이 부를 때는 인자로 manual 이 넘어와, 끝나고 리포트를 브라우저로 엽니다.
rem   작업 스케줄러가 자동 실행할 때는 창을 띄우지 않습니다.
rem ============================================================

rem === 오늘 실행할 날인지 확인 (주말 / 쉬는날.txt / config.json 의 "사용") ===
node check-day.js
if errorlevel 1 (
  echo   오늘은 실행하지 않습니다.
  exit /b
)

echo [1/7] 화면 캡쳐 중...
node monitor.js
echo [2/7] 어제와 비교 중...
node compare.js
echo [3/7] 리포트 생성 중...
node report.js
echo [4/7] 변경 히스토리 갱신 중...
node history.js
echo [5/7] 공유 폴더로 복사 중...
node copy.js

echo [6/7] 웹 게시 확인 중...
rem config.json 의 "웹게시사용" 이 true 일 때만 GitHub 에 올린다
node -e "process.exit(require('./config.js').load().useWebPublish?0:1)"
if errorlevel 1 (
  echo   웹 게시를 사용하지 않는 설정입니다. 건너뜁니다.
  if exist "results\push-status.txt" del "results\push-status.txt"
) else (
  node web-history.js
  git add -A
  git commit -m "report %DATE%" 1>nul 2>nul
  git push 1>nul 2>nul
  if errorlevel 1 (
    echo fail> "results\push-status.txt"
    echo   GitHub 업로드 실패 - web-fix.bat 실행 필요
  ) else (
    echo ok> "results\push-status.txt"
  )
)

echo [7/7] 두레이 알림 전송 중...
node notify.js

if /i "%~1"=="manual" start "" "%~dp0reports\index.html"
