@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 사이트 모니터링 - 진단
node doctor.js
pause
