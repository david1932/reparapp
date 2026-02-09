$Url = "https://yihgvgsajrncsamkwjlq.supabase.co"
$Key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA"

$Headers = @{
    "apikey"        = $Key
    "Authorization" = "Bearer $Key"
    "Content-Type"  = "application/json"
    "Prefer"        = "return=representation"
}

Write-Host "Fetching ANY repair ID from Supabase (Simplified)..."

try {
    # VERY SIMPLE QUERY: Just get 1 ID. No sorting.
    $Response = Invoke-RestMethod -Uri "$Url/rest/v1/reparaciones?select=id,modelo,estado&limit=1" -Method Get -Headers $Headers
    
    if ($Response.Count -gt 0) {
        $Repair = $Response[0]
        Write-Host "---------------------------------------------------"
        Write-Host "FOUND REPAIR:" -ForegroundColor Green
        Write-Host "ID:     $($Repair.id)" -ForegroundColor Cyan
        Write-Host "Model:  $($Repair.modelo)"
        Write-Host "Status: $($Repair.estado)"
        Write-Host "---------------------------------------------------"
    }
    else {
        Write-Host "No repairs found. Please sync the app first." -ForegroundColor Yellow
    }
}
catch {
    Write-Host "Error fetching data: $($_.Exception.Message)"
    $Stream = $_.Exception.Response.GetResponseStream()
    if ($Stream) {
        $Reader = New-Object System.IO.StreamReader($Stream)
        Write-Host "Server Body: $($Reader.ReadToEnd())"
    }
}
