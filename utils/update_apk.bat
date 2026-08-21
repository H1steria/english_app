@echo off
setlocal EnableDelayedExpansion
echo Iniciando proceso de actualizacion y compilacion...
:: Guardar la ubicacion actual y subir dos niveles
pushd ..\..
echo Directorio de trabajo actual: %CD%

:: 1. Copiar los archivos web mas recientes al proyecto de Android
echo Ejecutando: npx cap copy...
call npx cap copy
if errorlevel 1 (
    echo Error durante la ejecucion de npx cap copy.
    popd
    pause
    exit /b 1
)

:: 2. Verificar si la carpeta de Android existe
if not exist android (
    echo Error: No se encontro la carpeta 'android' en la ruta de trabajo.
    popd
    pause
    exit /b 1
)
echo Carpeta 'android' detectada. Accediendo...
cd android

:: 3. Apuntar temporalmente a la version de Java de Android Studio (evitar errores con JDK 26)
if exist "C:\Program Files\Android\Android Studio\jbr" (
    echo Configurando JAVA_HOME temporalmente al JDK de Android Studio...
    set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
)

:: 4. Compilar el APK
echo Compilando el APK con Gradle...
call gradlew.bat assembleDebug
if errorlevel 1 (
    echo Error durante la compilacion con Gradle.
    cd ..
    popd
    pause
    exit /b 1
)

cd ..
echo Proceso de compilacion completado.
echo El APK generado se encuentra en:
echo android\app\build\outputs\apk\debug\app-debug.apk

:: 5. Localizar ADB
echo Buscando ADB para realizar la instalacion...
set "ADB_PATH=adb"
where adb >nul 2>&1
if errorlevel 1 (
    if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" (
        set "ADB_PATH=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
    ) else (
        echo No se pudo localizar 'adb' en el PATH del sistema ni en la ruta predeterminada de Android SDK.
        echo Se omitira el paso de instalacion automatica.
        goto open_folder
    )
)

echo Iniciando servidor ADB...
"%ADB_PATH%" start-server >nul 2>&1

:: 6. Esperar activamente a que un dispositivo este AUTORIZADO
set MAX_WAIT=90
set WAIT_COUNT=0
set "LAST_STATE="

:wait_for_device
set "DEVICE_STATE="
set "DEVICE_ID="
for /f "skip=1 tokens=1,2" %%A in ('"%ADB_PATH%" devices') do (
    if not "%%A"=="" (
        set "DEVICE_ID=%%A"
        set "DEVICE_STATE=%%B"
    )
)

if "!DEVICE_STATE!"=="device" (
    echo.
    echo Dispositivo autorizado y listo: !DEVICE_ID!
    goto do_install
)

if "!DEVICE_STATE!"=="unauthorized" (
    if not "!LAST_STATE!"=="unauthorized" (
        echo.
        echo ==================================================================
        echo El dispositivo esta CONECTADO pero NO AUTORIZADO.
        echo Revise la pantalla del dispositivo y toque "Permitir" / "Allow"
        echo en el dialogo "Permitir depuracion USB".
        echo Marque "Confiar siempre en esta computadora" para no repetirlo.
        echo Esperando confirmacion...
        echo ==================================================================
    )
    set "LAST_STATE=unauthorized"
    goto keep_waiting
)

if "!DEVICE_STATE!"=="offline" (
    if not "!LAST_STATE!"=="offline" echo Dispositivo en estado 'offline'. Reintentando...
    set "LAST_STATE=offline"
    goto keep_waiting
)

if "!DEVICE_STATE!"=="" (
    if not "!LAST_STATE!"=="empty" echo Esperando a que se conecte un dispositivo o emulador...
    set "LAST_STATE=empty"
    goto keep_waiting
)

:keep_waiting
set /a WAIT_COUNT+=1
if !WAIT_COUNT! GEQ %MAX_WAIT% (
    echo.
    echo Tiempo de espera agotado. No se detecto un dispositivo autorizado.
    goto install_failed
)
timeout /t 2 /nobreak >nul
goto wait_for_device

:do_install
echo Intentando instalar el APK en el dispositivo/emulador conectado...
set INSTALL_ATTEMPTS=0

:try_install
set /a INSTALL_ATTEMPTS+=1
"%ADB_PATH%" install -r "android\app\build\outputs\apk\debug\app-debug.apk"
if errorlevel 1 (
    if !INSTALL_ATTEMPTS! LSS 3 (
        echo.
        echo Fallo el intento !INSTALL_ATTEMPTS! de instalacion. Reintentando en 3 segundos...
        timeout /t 3 /nobreak >nul
        goto try_install
    ) else (
        goto install_failed
    )
) else (
    echo APK instalado en el dispositivo.
    goto open_folder
)

:install_failed
echo.
echo No se pudo realizar la instalacion del APK de forma automatica.
echo Asegurese de que:
echo 1. Un dispositivo o emulador este encendido y conectado.
echo 2. La depuracion USB este activada en las opciones de desarrollador del dispositivo.
echo 3. El dispositivo este desbloqueado y haya aceptado el dialogo de autorizacion.
echo.

:open_folder
:: 7. Abrir la carpeta del APK en el Explorador de Windows
if exist "android\app\build\outputs\apk\debug" (
    echo Abriendo la carpeta del APK...
    explorer "android\app\build\outputs\apk\debug"
)

popd
pause