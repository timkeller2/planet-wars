@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Amoeba Wars Local Host
echo.
echo  ============================================
echo   AMOEBA WARS  -  Local Host (portable Node)
echo  ============================================
echo.

set "ROOT=%~dp0"
set "NODE_DIR=%ROOT%runtime\node"
set "NODE_EXE=%NODE_DIR%\node.exe"
set "PORT=%PORT%"
if "%PORT%"=="" set "PORT=5173"
set "NODE_ENV=production"

if not exist "%NODE_EXE%" (
  echo [ERROR] Portable Node not found at:
  echo   %NODE_EXE%
  echo.
  echo Re-download the Install Local Host package, or run:
  echo   npm run pack:portable -- --platform win-x64
  echo.
  pause
  exit /b 1
)

if not exist "%ROOT%server.js" (
  echo [ERROR] server.js missing. Unzip the full package first.
  pause
  exit /b 1
)

if not exist "%ROOT%dist\index.html" (
  echo [ERROR] Client build missing ^(dist\index.html^).
  echo This package should include a prebuilt client. Re-download the install zip.
  pause
  exit /b 1
)

if not exist "%ROOT%node_modules" (
  echo [setup] Installing production dependencies ^(first run^)...
  if exist "%NODE_DIR%\npm.cmd" (
    call "%NODE_DIR%\npm.cmd" install --omit=dev --no-audit --no-fund
  ) else if exist "%NODE_DIR%\node_modules\npm\bin\npm-cli.js" (
    "%NODE_EXE%" "%NODE_DIR%\node_modules\npm\bin\npm-cli.js" install --omit=dev --no-audit --no-fund
  ) else (
    echo [ERROR] npm not found next to portable Node. Package may be incomplete.
    pause
    exit /b 1
  )
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo [host] Using portable Node: %NODE_EXE%
echo [host] Server: http://localhost:%PORT%
echo [host] LAN clients can join via this PC's IP on port %PORT%.
echo [host] Press Ctrl+C to stop the server.
echo.

rem Open the browser shortly after the server begins listening
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%PORT%/"

"%NODE_EXE%" "%ROOT%server.js"
set "EC=%ERRORLEVEL%"
echo.
if not "%EC%"=="0" (
  echo [host] Server exited with code %EC%.
  pause
)
exit /b %EC%
