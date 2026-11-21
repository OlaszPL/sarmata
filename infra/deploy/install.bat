@echo off
setlocal
chcp 65001 >nul
set "BIN=%~dp0dist\sarmata-windows-x64.exe"
if not exist "%BIN%" (
  echo Brak pliku %BIN%.
  pause
  exit /b 1
)
if "%~1"=="" (
  "%BIN%" install
) else (
  "%BIN%" %*
)
set "CODE=%ERRORLEVEL%"
pause
exit /b %CODE%
