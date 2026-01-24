$Url = "https://yihgvgsajrncsamkwjlq.supabase.co"
$Key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA"

$Headers = @{
    "apikey" = $Key
    "Authorization" = "Bearer $Key"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}

$TestId = "test-delete-ps-" + (Get-Date -UFormat %s)

Write-Host "1. Creating Test Client..."
$Body = @{
    id = $TestId
    nombre = "Test PS Delete"
    telefono = "000000000"
    ultima_modificacion = [long](Get-Date -UFormat %s) * 1000
} | ConvertTo-Json

try {
    $Resp = Invoke-RestMethod -Uri "$Url/rest/v1/clientes" -Method Post -Headers $Headers -Body $Body
    Write-Host "Create Success"
} catch {
    Write-Host "Create Failed: $($_.Exception.Message)"
    exit
}

Write-Host "2. Verifying it exists..."
try {
    $Check = Invoke-RestMethod -Uri "$Url/rest/v1/clientes?id=eq.$TestId" -Method Get -Headers $Headers
    if ($Check.Count -gt 0) {
        Write-Host "Record confirmed on server."
    } else {
        Write-Host "Record NOT found."
        exit
    }
} catch {
    Write-Host "Get Failed: $($_.Exception.Message)"
    exit
}

Write-Host "3. Attempting DELETE..."
try {
    $Del = Invoke-RestMethod -Uri "$Url/rest/v1/clientes?id=eq.$TestId" -Method Delete -Headers $Headers
    Write-Host "Delete Request Sent."
} catch {
    Write-Host "DELETE FAILED (Likely RLS): $($_.Exception.Message)"
    # Clean output
    $Stream = $_.Exception.Response.GetResponseStream()
    $Reader = New-Object System.IO.StreamReader($Stream)
    Write-Host "Server Response: $($Reader.ReadToEnd())"
    exit
}

Write-Host "4. Verifying deletion..."
$FinalCheck = Invoke-RestMethod -Uri "$Url/rest/v1/clientes?id=eq.$TestId" -Method Get -Headers $Headers
if ($FinalCheck.Count -eq 0) {
    Write-Host "SUCCESS: Record was deleted."
} else {
    Write-Host "FAILURE: Record still exists (Zombie Data Confirmed)."
}
