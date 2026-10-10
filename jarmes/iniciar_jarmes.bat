@echo off
rem Inicia o JARMES (sem janela de console). Rode scripts\install.ps1 antes, uma única vez.
cd /d "%~dp0"
if not exist ".venv\Scripts\pythonw.exe" (
  echo Ambiente nao encontrado. Execute: powershell -ExecutionPolicy Bypass -File scripts\install.ps1
  pause
  exit /b 1
)
start "" ".venv\Scripts\pythonw.exe" run_jarmes.py %*
