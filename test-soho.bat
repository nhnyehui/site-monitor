@echo off
cd /d %~dp0
echo 소호 메인 테스트 캡쳐 중... (약 15초)
node test-soho.js
start "" "%~dp0test_soho.png"
pause
