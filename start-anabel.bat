@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado no PATH.
  echo Instale o Node.js e tente novamente.
  pause
  exit /b 1
)

start "Dev_Anabel Local" cmd /k node local-ai-server.js
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8787/"

endlocal
