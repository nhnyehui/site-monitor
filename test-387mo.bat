@echo off
cd /d %~dp0
echo 387 모바일 테스트 캡쳐 중... (약 20초)
node test-387mo.js
start "" "%~dp0test_387mo.png"
pause
