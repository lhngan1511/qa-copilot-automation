@echo off
REM Double-click file nay de cai dat Runner Agent (Windows khong tu chay duoc file .ps1 khi double-click).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
pause
