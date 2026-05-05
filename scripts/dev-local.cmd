@echo off
setlocal

set "NODE_OPTIONS="
set "VSCODE_INSPECTOR_OPTIONS="

node "%~dp0dev-local.js"
exit /b %ERRORLEVEL%
