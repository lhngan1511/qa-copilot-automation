@echo off
REM Chuot phai file nay -> "Run as administrator" de dang ky QA Copilot tu chay khi may khoi dong.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-startup-task.ps1"
pause
