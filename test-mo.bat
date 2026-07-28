@echo off
cd /d %~dp0
echo 모바일 테스트 캡쳐 중... (약 20초)
node test-mo.js
start "" "%~dp0test_mo.png"
pause
