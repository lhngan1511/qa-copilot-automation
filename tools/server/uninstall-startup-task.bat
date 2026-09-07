@echo off
REM Chuot phai file nay -> "Run as administrator" de go dang ky tu khoi dong QA Copilot server.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-startup-task.ps1"
pause
