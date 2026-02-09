$SUPABASE_URL = "https://yihgvgsajrncsamkwjlq.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA"

$Headers = @{
    "apikey"        = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
    "Content-Type"  = "application/json"
    "Prefer"        = "return=representation"
}

function Delete-All-Records {
    param (
        [string]$TableName
    )

    Write-Host "Buscando registros en tabla: $TableName..." -ForegroundColor Cyan

    # 1. Get all IDs
    $Uri = "$SUPABASE_URL/rest/v1/$TableName?select=id"
    try {
        $Items = Invoke-RestMethod -Uri $Uri -Method Get -Headers $Headers
    }
    catch {
        Write-Error "Error leyendo $TableName : $_"
        return
    }

    if (-not $Items -or $Items.Count -eq 0) {
        Write-Host "$TableName ya esta vacia." -ForegroundColor Green
        return
    }

    $Count = $Items.Count
    Write-Host "Encontrados $Count registros en $TableName. Eliminando..." -ForegroundColor Yellow

    # 2. Delete loop
    $Deleted = 0
    foreach ($Item in $Items) {
        $Id = $Item.id
        $DeleteUri = "$SUPABASE_URL/rest/v1/$TableName?id=eq.$Id"
        try {
            Invoke-RestMethod -Uri $DeleteUri -Method Delete -Headers $Headers
            Write-Host -NoNewline "."
            $Deleted++
        }
        catch {
            Write-Host -NoNewline "X"
        }
    }
    Write-Host "`nDONE $TableName : $Deleted / $Count eliminados." -ForegroundColor Green
}

Write-Host "INICIANDO PROTOCOLO DE BORRADO MASIVO (PowerShell)" -ForegroundColor Red
Write-Host "-----------------------------------------"

Delete-All-Records -TableName "facturas"
Delete-All-Records -TableName "reparaciones"
Delete-All-Records -TableName "clientes"

Write-Host "-----------------------------------------"
Write-Host "PROCESO COMPLETADO." -ForegroundColor White
