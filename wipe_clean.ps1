$Url = "https://yihgvgsajrncsamkwjlq.supabase.co"
$Key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA"

$Headers = @{
    "apikey"        = $Key
    "Authorization" = "Bearer $Key"
    "Content-Type"  = "application/json"
    "Prefer"        = "return=representation"
}

# Verify Connectivity First
try {
    Write-Host "Verifying connection..."
    $Check = Invoke-RestMethod -Uri "$Url/rest/v1/" -Method Get -Headers $Headers
    Write-Host "Connection OK."
}
catch {
    # It's normal for root to fail, but let's see. 404 is expected on root.
}

function Delete-Table {
    param([string]$TableName)
    
    # Use script scope Url/Headers
    $ServiceUrl = $script:Url
    $ReqHeaders = $script:Headers

    Write-Host "Fetching $TableName from $ServiceUrl..." -ForegroundColor Cyan
    
    try {
        # Construct URI explicitly
        $Uri = $ServiceUrl + "/rest/v1/" + $TableName + "?select=id"
        Write-Host "GET $Uri" -ForegroundColor DarkGray
        
        $Records = Invoke-RestMethod -Uri $Uri -Method Get -Headers $ReqHeaders
        
        # Array detection
        if ($Records -is [System.Array]) {
            $Count = $Records.Count
        }
        elseif ($null -ne $Records) {
            $Records = @($Records)
            $Count = 1
        }
        else {
            $Records = @()
            $Count = 0
        }
        
        Write-Host "Found $Count records." -ForegroundColor Yellow
        
        foreach ($Rec in $Records) {
            $Id = $Rec.id
            if ($Id) {
                try {
                    $DelUri = $ServiceUrl + "/rest/v1/" + $TableName + "?id=eq." + $Id
                    $Null = Invoke-RestMethod -Uri $DelUri -Method Delete -Headers $ReqHeaders
                    Write-Host "Deleted $TableName : $Id" -ForegroundColor Gray
                }
                catch {
                    Write-Host "X Failed $Id : $($_.Exception.Message)" -ForegroundColor Red
                }
            }
        }
    }
    catch {
        Write-Host "!!! Error fetching $TableName : $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            try {
                $Stream = $_.Exception.Response.GetResponseStream()
                $Reader = New-Object System.IO.StreamReader($Stream)
                Write-Host "Server Body: $($Reader.ReadToEnd())"
            }
            catch {}
        }
    }
}

Write-Host "STARTING NUCLEAR WIPE..." -ForegroundColor Yellow

# Delete children first to avoid FK constraints
Delete-Table "reparaciones"
Delete-Table "facturas"
Delete-Table "clientes"

Write-Host "WIPE COMPLETE. Cloud should be empty." -ForegroundColor Green
