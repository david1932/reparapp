$Url = "https://yihgvgsajrncsamkwjlq.supabase.co"
$Key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA"

$Headers = @{
    "apikey"        = $Key
    "Authorization" = "Bearer $Key"
    "Content-Type"  = "application/json"
    "Prefer"        = "return=representation"
}

# Generate valid UUID
$TestId = [guid]::NewGuid().ToString()

Write-Host "1. Creating Client (NO user_id)..."
$IsoDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

$Body = @{
    id                  = $TestId
    nombre              = "Test Sync Fix"
    telefono            = "666777888"
    fecha_creacion      = $IsoDate
    ultima_modificacion = $IsoDate
    # user_id OMITTED
} | ConvertTo-Json

try {
    $Resp = Invoke-RestMethod -Uri "$Url/rest/v1/clientes" -Method Post -Headers $Headers -Body $Body
    Write-Host "Create Success. Status: 201"
}
catch {
    Write-Host "Create Failed: $($_.Exception.Message)"
    $Stream = $_.Exception.Response.GetResponseStream()
    if ($Stream) {
        $Reader = New-Object System.IO.StreamReader($Stream)
        Write-Host "Server Body: $($Reader.ReadToEnd())"
    }
    exit
}

Write-Host "2. Verifying exists..."
try {
    $Check = Invoke-RestMethod -Uri "$Url/rest/v1/clientes?id=eq.$TestId" -Method Get -Headers $Headers
    if ($Check.Count -gt 0) {
        Write-Host "Record found."
    }
    else {
        Write-Host "Record NOT found."
        exit
    }
}
catch {
    Write-Host "Get Failed: $($_.Exception.Message)"
    exit
}

Write-Host "3. Attempting DELETE..."
try {
    $Del = Invoke-RestMethod -Uri "$Url/rest/v1/clientes?id=eq.$TestId" -Method Delete -Headers $Headers
    Write-Host "Delete Request Sent."
}
catch {
    Write-Host "DELETE FAILED: $($_.Exception.Message)"
    $Stream = $_.Exception.Response.GetResponseStream()
    if ($Stream) {
        $Reader = New-Object System.IO.StreamReader($Stream)
        Write-Host "Server Body: $($Reader.ReadToEnd())"
    }
    exit
}

Write-Host "4. Final Verification..."
$FinalCheck = Invoke-RestMethod -Uri "$Url/rest/v1/clientes?id=eq.$TestId" -Method Get -Headers $Headers
if ($FinalCheck.Count -eq 0) {
    Write-Host "SUCCESS: Record deleted. Sync Fix Verified."
}
else {
    Write-Host "FAILURE: Record still exists."
}
