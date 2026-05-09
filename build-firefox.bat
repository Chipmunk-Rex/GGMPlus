@echo off
set "ROOT=%~dp0"
call "%ROOT%build-target.bat" firefox
exit /b %ERRORLEVEL%
