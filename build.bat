@echo off
setlocal

set "ROOT=%~dp0"

call "%ROOT%build-chrome.bat"
if errorlevel 1 exit /b 1

call "%ROOT%build-firefox.bat"
if errorlevel 1 exit /b 1

echo All browser packages are ready in "%ROOT%dist".
exit /b 0
