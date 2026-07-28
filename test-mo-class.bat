@echo off
cd /d %~dp0
echo 모바일 배너 클래스 진단 중... (약 15초)
node test-mo-class.js
echo.
echo 위에 나온 내용을 전부 복사해서 알려주세요.
pause
