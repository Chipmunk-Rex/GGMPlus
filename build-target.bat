@echo off
setlocal

set "BROWSER=%~1"
set "ROOT=%~dp0"
set "SOURCE_DIR=%ROOT%src"
set "MANIFEST_PATH=%ROOT%manifests\%BROWSER%.json"
set "DIST_DIR=%ROOT%dist"
set "BUILD_DIR=%DIST_DIR%\%BROWSER%"
set "ZIP_PATH=%DIST_DIR%\ggmplus-%BROWSER%.zip"

if "%BROWSER%"=="" (
  echo [ERROR] Browser target is required. Example: build-target.bat chrome
  exit /b 1
)

if not exist "%SOURCE_DIR%" (
  echo [ERROR] Shared source folder not found: "%SOURCE_DIR%"
  exit /b 1
)

if not exist "%MANIFEST_PATH%" (
  echo [ERROR] Manifest not found: "%MANIFEST_PATH%"
  exit /b 1
)

if exist "%BUILD_DIR%" rmdir /s /q "%BUILD_DIR%"
if exist "%ZIP_PATH%" del /q "%ZIP_PATH%"
if not exist "%DIST_DIR%" mkdir "%DIST_DIR%"
mkdir "%BUILD_DIR%"

xcopy "%SOURCE_DIR%\*" "%BUILD_DIR%\" /e /i /y >nul
copy /y "%MANIFEST_PATH%" "%BUILD_DIR%\manifest.json" >nul

pushd "%BUILD_DIR%"
"C:\Windows\System32\tar.exe" -a -c -f "%ZIP_PATH%" *
popd

if errorlevel 1 (
  echo [ERROR] Failed to create %BROWSER% zip package.
  exit /b 1
)

echo %BROWSER% package ready:
echo   Folder: "%BUILD_DIR%"
echo   Zip:    "%ZIP_PATH%"
exit /b 0
