@echo off
title Servidor Victoria Vasquez v3 - Carrusel
color 0B
echo ============================================
echo  VICTORIA VASQUEZ - Servidor Local v3
echo  Carrusel + Fondo Transparente
echo ============================================
echo.

REM Ir a la carpeta donde esta este .bat
cd /d "%~dp0"

echo Carpeta: %CD%
echo.

REM Verificar si existe data.json
if not exist "data.json" (
  echo [ERROR] No se encontro data.json en esta carpeta
  echo Asegurate de poner este .bat junto a index.html
  pause
  exit /b
)

echo Iniciando servidor en http://localhost:8000
echo.
echo 1. Abre en tu navegador: http://localhost:8000
echo 2. Abre admin.html en otra pestana para editar
echo 3. Cuando exportes data.json, solo recarga con Ctrl+F5
echo.
echo Para detener el servidor: cierra esta ventana o presiona Ctrl+C
echo.

REM Intentar con python (mas comun)
where python >nul 2>nul
if %errorlevel%==0 (
  echo [OK] Usando python...
  start http://localhost:8000
  python -m http.server 8000
  goto :end
)

REM Intentar con py launcher
where py >nul 2>nul
if %errorlevel%==0 (
  echo [OK] Usando py...
  start http://localhost:8000
  py -m http.server 8000
  goto :end
)

REM Intentar con npx http-server
where npx >nul 2>nul
if %errorlevel%==0 (
  echo [OK] Usando npx http-server...
  start http://localhost:8000
  npx http-server -p 8000
  goto :end
)

echo [ERROR] No se encontro python ni node
echo Instala Python desde: https://www.python.org/
echo O abre index.html directo con doble clic (pero el carrusel puede no cargar data.json)
pause

:end
