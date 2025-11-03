
<# 
    organize_restaurantsys.ps1
    ------------------------------------------------------------------
    Reorganize the physical folders of the RestaurantSys repository 
    to match the enterprise-style layout used in Solution Explorer.

    WHAT IT DOES
    - Creates standard folders: src/, tests/, integrations/, deploy/, docs/, tools/
    - Moves existing projects/files into their target folders (if found)
    - Optionally deletes old/extra .sln files
    - Makes a ZIP backup before changing anything

    USAGE
    1) Close Visual Studio.
    2) Open PowerShell in the folder that contains RestaurantSys.sln.
       (Right click folder background → "Open in Terminal").
    3) Run:  pwsh -ExecutionPolicy Bypass -File .\organize_restaurantsys.ps1
       Or:   powershell -ExecutionPolicy Bypass -File .\organize_restaurantsys.ps1
    4) Reopen RestaurantSys.sln → Remove missing projects → Add Existing Project… 
       from their new locations.
#>

param(
    [switch]$NoBackup = $false,
    [switch]$WhatIfOnly = $false,
    [switch]$KeepOldSolutions = $false
)

$ErrorActionPreference = "Stop"

function Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Done($msg) { Write-Host "[ OK ] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }

# Ensure we are at the repo root (must contain RestaurantSys.sln)
$root = Get-Location
$sln = Join-Path $root "RestaurantSys.sln"
if (!(Test-Path $sln)) {
    Fail "RestaurantSys.sln not found in $root. Open the repository root and run again."
    exit 1
}

# Backup
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = Join-Path $root ("backup_before_reorg_{0}.zip" -f $timestamp)

if (-not $NoBackup) {
    Info "Creating backup zip: $backupPath"
    if (-not $WhatIfOnly) {
        Compress-Archive -Path * -DestinationPath $backupPath -Force
    }
    Done "Backup created."
} else {
    Warn "Skipping backup per -NoBackup"
}

# Create target folders
$folders = @("src","tests","integrations","deploy","docs","tools")
foreach ($f in $folders) {
    $target = Join-Path $root $f
    if (!(Test-Path $target)) {
        Info "Creating folder $f"
        if (-not $WhatIfOnly) { New-Item -ItemType Directory -Path $target | Out-Null }
    }
}

# Moves table (source -> destination). Paths relative to repo root.
$moves = @(
    @{ from="backend/src/RestaurantSys.Domain";               to="src/RestaurantSys.Domain" },
    @{ from="backend/src/RestaurantSys.Application";          to="src/RestaurantSys.Application" },
    @{ from="backend/src/RestaurantSys.Infrastructure";       to="src/RestaurantSys.Infrastructure" },
    @{ from="backend/src/RestaurantSys.ConsoleRunner";        to="src/RestaurantSys.ConsoleRunner" },
    @{ from="backend/src/RestaurantSys.Workers/exporter";     to="src/ExporterWorker" },
    @{ from="integrations/WhatsAppShiftBot/WhatsAppWebhook";  to="integrations/WhatsAppWebhook" }
)

foreach ($m in $moves) {
    $src = Join-Path $root $m.from
    $dst = Join-Path $root $m.to
    if (Test-Path $src) {
        if (Test-Path $dst) {
            Warn "Target already exists, skipping move: $($m.to)"
        } else {
            Info ("Moving {0}  ->  {1}" -f $m.from, $m.to)
            if (-not $WhatIfOnly) {
                $dstParent = Split-Path $dst -Parent
                if (!(Test-Path $dstParent)) { New-Item -ItemType Directory -Path $dstParent | Out-Null }
                Move-Item -Path $src -Destination $dst
            }
            Done ("Moved to {0}" -f $m.to)
        }
    } else {
        Warn ("Source not found, skipping: {0}" -f $m.from)
    }
}

# Clean up empty parent folder integrations/WhatsAppShiftBot if it's empty
$maybeEmpty = Join-Path $root "integrations/WhatsAppShiftBot"
if (Test-Path $maybeEmpty) {
    $items = Get-ChildItem $maybeEmpty -Force -ErrorAction SilentlyContinue
    if ($items.Count -eq 0) {
        Info "Removing empty folder integrations/WhatsAppShiftBot"
        if (-not $WhatIfOnly) { Remove-Item $maybeEmpty -Force }
    }
}

# Move dev ops files
$opsMoves = @("docker-compose.yml", "start.json", "end.json")
foreach ($f in $opsMoves) {
    $src = Join-Path $root $f
    $dst = Join-Path $root ("deploy/{0}" -f $f)
    if (Test-Path $src) {
        Info ("Moving {0} -> deploy\{0}" -f $f)
        if (-not $WhatIfOnly) { Move-Item $src $dst -Force }
        Done ("Moved {0}" -f $f)
    } else {
        Warn ("Ops file not found: {0}" -f $f)
    }
}

# Remove old solution files (optional)
$oldSolutions = @(
    "backend/RestaurantSys.sln",
    "integrations/WhatsAppShiftBot/WhatsAppWebhook.sln"
)
if (-not $KeepOldSolutions) {
    foreach ($p in $oldSolutions) {
        $full = Join-Path $root $p
        if (Test-Path $full) {
            Info ("Deleting old solution: {0}" -f $p)
            if (-not $WhatIfOnly) { Remove-Item $full -Force }
            Done ("Deleted {0}" -f $p)
        }
    }
} else {
    Warn "Keeping old .sln files per -KeepOldSolutions"
}

Info "Done. Reopen RestaurantSys.sln in Visual Studio."
Warn "You will need to Remove missing projects and Add → Existing Project… from the new locations."
Warn "Then reapply project references: Application→Domain, Infrastructure→Application, Runners → Application (+ Infrastructure if needed)."
