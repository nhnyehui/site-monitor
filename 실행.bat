@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 사이트 모니터링 - 수동 실행
call "%~dp0run.bat" manual
pause
