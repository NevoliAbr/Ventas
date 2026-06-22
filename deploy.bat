@echo off
echo.
echo ==========================================
echo   DEPLOY Business Development
echo ==========================================
echo.

echo [1/4] Compilando frontend...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo ERROR: El build fallo. Corrige los errores antes de continuar.
    pause
    exit /b 1
)

echo.
echo [2/4] Agregando dist al staging...
git add client/dist

echo [3/4] Creando commit de build...
git commit -m "build: actualizar dist para produccion"
if %ERRORLEVEL% neq 0 (
    echo INFO: Sin cambios nuevos en dist, nada que commitear.
)

echo.
echo [4/4] Subiendo a repositorio...
git push
if %ERRORLEVEL% neq 0 (
    echo ERROR: Fallo el push. Revisa tu conexion o permisos.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   LISTO. Ahora haz git pull en el servidor
echo   y reinicia Node.js.
echo ==========================================
echo.
pause
