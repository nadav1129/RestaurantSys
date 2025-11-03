# One-click dev environment starter for RestaurantSys
# Run from repo root or via DevStart.bat

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
Set-Location $repoRoot

# --- CONFIG ---
$ApiProject = ".\backend\src\RestaurantSys.Integrations.WhatsAppShiftBot\RestaurantSys.Integrations.WhatsAppShiftBot.csproj"
$ApiUrl     = "http://localhost:8080"
$CloudflaredExe = "C:\Tools\cloudflared\cloudflared.exe"   # adjust if different

# --- Helpers ---
function Assert-Tool($name, $checkCmd) {
    try { & $checkCmd | Out-Null } catch { throw "$name not found or not runnable." }
}

function Wait-PostgresReady([int]$seconds = 25) {
    Write-Host "Waiting up to $seconds seconds for Postgres to be ready..."
    $dbId = (& docker compose ps -q db).Trim()
    if (-not $dbId) { throw "Docker service 'db' not found. Is docker-compose.yml in repo root?" }
    for ($i=0; $i -lt $seconds; $i++) {
        try {
            & docker exec -e PGPASSWORD=postgres -i $dbId psql -U postgres -d postgres -c "select 1;" | Out-Null
            Write-Host "Postgres is ready."
            return
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    throw "Postgres did not become ready in time."
}

# --- Checks ---
Assert-Tool "Docker" { docker --version }
Assert-Tool ".NET SDK" { dotnet --version }
if (-not (Test-Path $CloudflaredExe)) { throw "cloudflared not found at $CloudflaredExe" }

# --- Docker up (db + optional rabbit) ---
Write-Host "Starting docker compose services..." -ForegroundColor Cyan
docker compose up -d
docker compose ps

# --- DB init: copy schema.sql and apply ---
$db = (docker compose ps -q db).Trim()
if (-not $db) { throw "DB container id not found." }

Wait-PostgresReady -seconds 30

Write-Host "Applying DB schema..." -ForegroundColor Cyan
docker cp ".\dev\schema.sql" $db:/schema.sql
docker exec -e PGPASSWORD=postgres -i $db psql -U postgres -d postgres -f /schema.sql

# --- Start API in a new terminal window ---
if (-not (Test-Path $ApiProject)) {
    throw "API project not found at $ApiProject"
}
Write-Host "Launching API at $ApiUrl..." -ForegroundColor Cyan
Start-Process wt.exe -ArgumentList "new-tab pwsh -NoExit -c `"cd `"$repoRoot`"; dotnet run --project `"$ApiProject`" --urls $ApiUrl`""

# --- Start cloudflared in a new terminal window ---
Write-Host "Launching Cloudflared tunnel to $ApiUrl..." -ForegroundColor Cyan
Start-Process wt.exe -ArgumentList "new-tab `"$CloudflaredExe`" tunnel --url $ApiUrl"

# --- Final instructions ---
$twilioHint = @"
------------------------------------------------------------
✔ Docker DB is up and schema applied.
✔ API started on $ApiUrl (check the API tab for logs).
✔ Cloudflared window will show your public https://*.trycloudflare.com URL.

Next:
1) Copy that https URL from the cloudflared window.
2) In Twilio Sandbox → "When a message comes in":
      https://<that-subdomain>.trycloudflare.com/twilio/adapter-test
   (or /twilio/adapter if you’re done testing)
3) Send "ping" to your Twilio WhatsApp sandbox number.
------------------------------------------------------------
"@
Write-Host $twilioHint -ForegroundColor Green
