@echo off
setlocal
cd /d %~dp0
powershell -ExecutionPolicy Bypass -File ".\dev\DevStart.ps1"
endlocal
