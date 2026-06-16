@echo off
cd /d "d:\Ventas"
:LOOP
cls
echo.
echo  ==========================================
echo    Ventas - Servidor de Desarrollo
echo  ==========================================
echo.

start "Ventas Server" cmd /k "cd /d "d:\Ventas" && npm run dev"

choice /C Q /N /M "  [Q] Reiniciar   Ctrl+C = Salir: "

echo.
echo  Reiniciando...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Ventas Server" >nul 2>&1
timeout /T 1 /NOBREAK >nul
goto LOOP
