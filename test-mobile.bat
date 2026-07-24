@echo off
cd /d %~dp0
echo PC + 모바일 하단배너 테스트 캡쳐 중... (약 30초)
node test-mobile.js
start "" "%~dp0test_pc.png"
start "" "%~dp0test_mobile.png"
pause
