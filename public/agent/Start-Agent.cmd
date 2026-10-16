@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -STA -File "%~dp0RCC-Agent.ps1"
if errorlevel 1 pause
