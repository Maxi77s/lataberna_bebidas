@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo Hubo un error instalando las dependencias.
    pause
    exit /b 1
  )
)
echo Iniciando La Taberna Bebidas en http://localhost:3000
call npm run dev
pause
