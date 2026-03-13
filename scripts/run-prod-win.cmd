@echo off
setlocal

cd /d "%~dp0\.."
call scripts\run-win-common.cmd prod
