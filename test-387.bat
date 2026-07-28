@echo off
cd /d %~dp0
echo 387 테스트 캡쳐 중... (약 15초)
node test-387.js
start "" "%~dp0test_387.png"
pause
