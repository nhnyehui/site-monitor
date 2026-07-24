@echo off
cd /d %~dp0
echo 82075 PC 테스트 캡쳐 중... (약 15초)
node test-82075.js
start "" "%~dp0test_82075.png"
pause
