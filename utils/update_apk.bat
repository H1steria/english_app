@echo off
echo Iniciando proceso de actualizacion y compilacion...

:: Guardar la ubicación actual y subir dos niveles
pushd ..\..

echo Directorio de trabajo actual: %CD%

:: 1. Copiar los archivos web más recientes al proyecto de Android
echo Ejecutando: npx cap copy...
call npx cap copy
if errorlevel 1 (
    echo Error durante la ejecucion de npx cap copy.
    popd
    pause
    exit /b 1
)

:: 2. Verificar si la carpeta de Android existe de manera limpia
if not exist android (
    echo Error: No se encontro la carpeta 'android' en la ruta de trabajo.
    popd
    pause
    exit /b 1
)

echo Carpeta 'android' detectada. Accediendo...
cd android

:: 3. Apuntar temporalmente a la versión de Java de Android Studio para evitar errores con JDK 26
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

:: Regresar a la raíz del proyecto
cd ..

echo Proceso de compilacion completado.
echo El APK generado se encuentra en:
echo android\app\build\outputs\apk\debug\app-debug.apk

:: 5. Intentar instalar el APK usando ADB (Android Debug Bridge)
echo Buscando ADB para realizar la instalacion...
set "ADB_PATH=adb"

:: Comprobar si ADB esta en el PATH del sistema
where adb >nul 2>&1
if errorlevel 1 (
    :: Si no esta en el PATH, buscar en la ruta predeterminada del SDK de Android
    if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" (
        set "ADB_PATH=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
    ) else (
        echo No se pudo localizar 'adb' en el PATH del sistema ni en la ruta predeterminada de Android SDK.
        echo Se omitira el paso de instalacion automatica.
        goto open_folder
    )
)

echo Intentando instalar el APK en el dispositivo/emulador conectado...
:: Se usa la bandera '-r' para reinstalar la aplicacion manteniendo sus datos
"%ADB_PATH%" install -r "android\app\build\outputs\apk\debug\app-debug.apk"
if errorlevel 1 (
    echo.
    echo No se pudo realizar la instalacion del APK de forma automatica.
    echo Asegurese de que:
    echo 1. Un dispositivo o emulador este encendido y conectado.
    echo 2. La depuracion USB este activada en las opciones de desarrollador del dispositivo.
    echo 3. El dispositivo este desbloqueado y confirme si aparece alguna solicitud de autorizacion en pantalla.
    echo.
) else (
    echo APK instalado en el dispositivo.
)

:open_folder
:: 6. Abrir la carpeta del APK en el Explorador de Windows
if exist "android\app\build\outputs\apk\debug" (
    echo Abriendo la carpeta del APK...
    explorer "android\app\build\outputs\apk\debug"
)

:: Regresar a la ubicación original del script
popd
pause