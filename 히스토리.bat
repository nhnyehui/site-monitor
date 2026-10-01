@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 사이트 모니터링 - 변경 히스토리
echo 히스토리를 정리하는 중입니다. 잠시만 기다려 주세요...
node history.js
if errorlevel 1 (
  echo.
  echo 히스토리 생성에 실패했습니다. 진단.bat 을 실행해 보세요.
  pause
  exit /b 1
)
start "" "%~dp0reports\history.html"
