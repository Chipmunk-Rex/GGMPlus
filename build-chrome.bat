@echo off
set "ROOT=%~dp0"
call "%ROOT%build-target.bat" chrome
exit /b %ERRORLEVEL%
