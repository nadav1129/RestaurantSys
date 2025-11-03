@echo off
REM organize_restaurantsys.cmd - wrapper to run the PowerShell script
setlocal
set PS_SCRIPT=%~dp0organize_restaurantsys.ps1
if not exist "%PS_SCRIPT%" (
  echo Could not find organize_restaurantsys.ps1 next to this CMD file.
  exit /b 1
)
powershell -ExecutionPolicy Bypass -File "%PS_SCRIPT%" %*
endlocal
