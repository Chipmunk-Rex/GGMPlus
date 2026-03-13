@echo off
setlocal

set "ROOT=%~dp0"
set "SOURCE_DIR=%ROOT%firefox"
set "DIST_DIR=%ROOT%dist"
set "BUILD_DIR=%DIST_DIR%\firefox"
set "ZIP_PATH=%DIST_DIR%\ggmplus-firefox.zip"

if not exist "%SOURCE_DIR%" (
  echo [ERROR] Firefox source folder not found: "%SOURCE_DIR%"
  exit /b 1
)

if exist "%BUILD_DIR%" rmdir /s /q "%BUILD_DIR%"
if exist "%ZIP_PATH%" del /q "%ZIP_PATH%"
if not exist "%DIST_DIR%" mkdir "%DIST_DIR%"
mkdir "%BUILD_DIR%"

xcopy "%SOURCE_DIR%\*" "%BUILD_DIR%\" /e /i /y >nul
pushd "%BUILD_DIR%"
"C:\Windows\System32\tar.exe" -a -c -f "%ZIP_PATH%" *
popd

if errorlevel 1 (
  echo [ERROR] Failed to create Firefox zip package.
  exit /b 1
)

echo Firefox package ready:
 echo   Folder: "%BUILD_DIR%"
 echo   Zip:    "%ZIP_PATH%"
exit /b 0
