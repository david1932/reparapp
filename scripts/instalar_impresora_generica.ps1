# Script de Utilidad de Impresoras para ReparApp
# Instala de manera automática el controlador "Generic / Text Only" y configura una impresora POS de prueba.

$driverName = "Generic / Text Only"
$printerName = "Impresora_Termica_POS"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Instalador de Impresora Genérica de Texto para Windows  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Verificar permisos de Administrador
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "Este script requiere ejecutarse como Administrador para instalar controladores."
    Write-Host "Reejecutando con privilegios de Administrador..."
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

try {
    # 1. Asegurar que el driver de Texto Genérico existe en el sistema
    Write-Host "Buscando controlador '$driverName'..." -ForegroundColor Yellow
    $driverExists = Get-PrinterDriver -Name $driverName -ErrorAction SilentlyContinue
    if (-not $driverExists) {
        Write-Host "Agregando controlador de impresora '$driverName'..." -ForegroundColor Yellow
        Add-PrinterDriver -Name $driverName
        Write-Host "Controlador instalado con éxito." -ForegroundColor Green
    } else {
        Write-Host "El controlador '$driverName' ya está instalado en el sistema." -ForegroundColor Green
    }

    # 2. Comprobar si ya existe la impresora térmica por defecto
    $printerExists = Get-Printer -Name $printerName -ErrorAction SilentlyContinue
    if (-not $printerExists) {
        Write-Host "Creando puerto local USB/LPT por defecto..." -ForegroundColor Yellow
        # Usamos un puerto local genérico, el usuario lo puede reasignar a su puerto USB (ej. USB001) desde propiedades
        Add-Printer -Name $printerName -DriverName $driverName -PortName "PORTPROMPT:"
        Write-Host "Impresora '$printerName' creada con éxito." -ForegroundColor Green
        Write-Host "Por favor, ve a 'Dispositivos e Impresoras' y en propiedades de la impresora reasigna el puerto al USB correspondiente (USB001, USB002, etc.) de tu impresora física." -ForegroundColor Yellow
    } else {
        Write-Host "La impresora '$printerName' ya existe en este equipo." -ForegroundColor Cyan
    }

    Write-Host "`nProceso finalizado. El sistema está listo para usar la impresión nativa de ReparApp." -ForegroundColor Green
} catch {
    Write-Error "Ocurrió un error al configurar la impresora: $_"
}

Write-Host "`nPresiona cualquier tecla para salir..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
