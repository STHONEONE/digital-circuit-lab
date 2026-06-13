@echo off
setlocal
title Digital Circuit Smart Learning Platform
cd /d "%~dp0"

echo ================================================
echo  Digital Circuit Smart Learning Platform
echo ================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto node_missing

set "NODE_MAJOR=0"
for /f "delims=" %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% LSS 18 goto node_too_old

if not exist "node_modules\express\package.json" goto install_dependencies
goto start_server

:install_dependencies
echo Installing project dependencies...
call npm.cmd install
if errorlevel 1 goto install_failed
echo.

:start_server
echo Starting server at http://localhost:8080
echo Keep this window open while using the system.
echo Use the Exit System button on the web page to stop it.
echo.
node server.js
set "SERVER_EXIT=%ERRORLEVEL%"
echo.
echo The server has stopped. Exit code: %SERVER_EXIT%
echo Check the message above for details.
pause
exit /b %SERVER_EXIT%

:node_missing
echo ERROR: Node.js was not found.
echo Install Node.js 18 or later, then run this file again.
pause
exit /b 1

:node_too_old
echo ERROR: Node.js 18 or later is required.
node --version
pause
exit /b 1

:install_failed
echo.
echo ERROR: Dependency installation failed.
echo Check the network connection and npm configuration.
pause
exit /b 1
