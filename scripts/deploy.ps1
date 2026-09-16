<#
.SYNOPSIS
    POS System - Deployment Script (Windows PowerShell)
    
.DESCRIPTION
    Deploys the POS system on Windows with WSL2/Docker Desktop.
    Configures Windows Firewall, mDNS (Bonjour), and starts Docker stack.
    
.EXAMPLE
    .\scripts\deploy.ps1
#>

param(
    [switch]$ForceRecreate,
    [switch]$SkipFirewall,
    [switch]$SkipMDNS
)

$ErrorActionPreference = "Stop"

# Colors
$Green = [ConsoleColor]::Green
$Yellow = [ConsoleColor]::Yellow
$Red = [ConsoleColor]::Red
$Cyan = [ConsoleColor]::Cyan
$Gray = [ConsoleColor]::DarkGray

function Write-Log {
    param([string]$Message, [ConsoleColor]$Color = $Gray)
    $time = Get-Date -Format "HH:mm:ss"
    Write-Host "[$time] $Message" -ForegroundColor $Color
}

function Write-Success { Write-Log "[OK] $args[0]" $Green }
function Write-Warn { Write-Log "[WARN] $args[0]" $Yellow }
function Write-Error { Write-Log "[ERROR] $args[0]" $Red }
function Write-Info { Write-Log "[INFO] $args[0]" $Cyan }

# -----------------------------------------------------------------------------
# Step 1: Set Project Root
# -----------------------------------------------------------------------------
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot
Write-Info "Project root: $ProjectRoot"

# -----------------------------------------------------------------------------
# Step 2: Load Environment
# -----------------------------------------------------------------------------
Write-Info "Loading environment configuration..."

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Write-Warn ".env not found. Copying from .env.example..."
        Copy-Item ".env.example" ".env"
        Write-Error "Please edit .env with your configuration before running deploy again!"
        exit 1
    } else {
        Write-Error ".env.example not found!"
        exit 1
    }
}

# Parse .env
$envContent = Get-Content ".env" -Raw
$envVars = @{}
$envContent -split "`n" | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        $envVars[$matches[1].Trim()] = $matches[2].Trim()
    }
}

# Set as environment variables
foreach ($key in $envVars.Keys) {
    [Environment]::SetEnvironmentVariable($key, $envVars[$key], "Process")
}

# -----------------------------------------------------------------------------
# Step 3: Validate Required Variables
# -----------------------------------------------------------------------------
$requiredVars = @("DB_ROOT_PASSWORD", "DB_APP_PASSWORD", "JWT_SECRET", "BUSINESS_TYPE", "LAN_CIDR")
$missingVars = @()

foreach ($var in $requiredVars) {
    if (-not $envVars.ContainsKey($var) -or [string]::IsNullOrWhiteSpace($envVars[$var]) -or $envVars[$var].StartsWith("change_me_")) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Error "Missing or default values for required variables:"
    $missingVars | ForEach-Object { Write-Host "  - $_" -ForegroundColor $Red }
    Write-Error "Please edit .env and set proper values."
    exit 1
}

# -----------------------------------------------------------------------------
# Step 4: Detect LAN IP
# -----------------------------------------------------------------------------
if ($envVars["LAN_IP"] -eq "auto" -or -not $envVars.ContainsKey("LAN_IP")) {
    Write-Info "Auto-detecting LAN IP..."
    
    # Get non-loopback IPv4 addresses
    $ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
        $_.IPAddress -notlike "127.*" -and 
        $_.IPAddress -notlike "169.254.*" -and
        $_.PrefixOrigin -ne "WellKnown"
    } | Select-Object -ExpandProperty IPAddress
    
    if ($ips.Count -eq 0) {
        Write-Error "No suitable LAN IP found. Set LAN_IP manually in .env"
        exit 1
    }
    
    # Prefer 192.168.x.x or 10.x.x.x
    $preferred = $ips | Where-Object { $_ -like "192.168.*" -or $_ -like "10.*" } | Select-Object -First 1
    $detectedIP = if ($preferred) { $preferred } else { $ips[0] }
    
    Write-Info "Detected LAN IP: $detectedIP"
    
    # Update .env
    $newEnv = $envContent -replace '(?m)^LAN_IP=.*', "LAN_IP=$detectedIP"
    if ($envContent -notmatch '(?m)^LAN_IP=') {
        $newEnv += "`nLAN_IP=$detectedIP"
    }
    $newEnv | Set-Content ".env"
    
    # Update LAN_CIDR if needed
    $currentCIDR = $envVars["LAN_CIDR"]
    if ($currentCIDR -eq "192.168.1.0/24" -and $detectedIP -notlike "192.168.1.*") {
        $cidrBase = ($detectedIP -split '\.')[0..2] -join '.'
        $newCIDR = "$cidrBase.0/24"
        Write-Warn "Updating LAN_CIDR from $currentCIDR to $newCIDR based on detected IP"
        $newEnv = $newEnv -replace '(?m)^LAN_CIDR=.*', "LAN_CIDR=$newCIDR"
        $newEnv | Set-Content ".env"
        $envVars["LAN_CIDR"] = $newCIDR
    }
    
    $envVars["LAN_IP"] = $detectedIP
    $env:LAN_IP = $detectedIP
} else {
    Write-Info "Using configured LAN IP: $($envVars["LAN_IP"])"
}

# -----------------------------------------------------------------------------
# Step 5: Configure Windows Firewall
# -----------------------------------------------------------------------------
if (-not $SkipFirewall) {
    Write-Info "Configuring Windows Firewall..."
    
    $cidr = $envVars["LAN_CIDR"]
    $ports = @(80, 443, 3306)
    
    foreach ($port in $ports) {
        $ruleName = "POS LAN Port $port"
        
        # Remove existing rule if exists
        if (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue) {
            Remove-NetFirewallRule -DisplayName $ruleName
        }
        
        # Create new rule
        New-NetFirewallRule `
            -DisplayName $ruleName `
            -Direction Inbound `
            -Action Allow `
            -Protocol TCP `
            -LocalPort $port `
            -RemoteAddress $cidr `
            -Profile Domain,Private `
            -Description "POS System - LAN access for port $port"
    }
    
    Write-Success "Windows Firewall configured for $cidr on ports 80, 443, 3306"
}

# -----------------------------------------------------------------------------
# Step 6: Configure mDNS (Bonjour)
# -----------------------------------------------------------------------------
if (-not $SkipMDNS) {
    Write-Info "Checking mDNS/Bonjour support..."
    
    # Check if Bonjour Print Services installed
    $bonjourPath = "${env:ProgramFiles}\Bonjour\mDNSResponder.exe"
    $bonjourPathX86 = "${env:ProgramFiles(x86)}\Bonjour\mDNSResponder.exe"
    
    if (-not (Test-Path $bonjourPath) -and -not (Test-Path $bonjourPathX86)) {
        Write-Warn "Bonjour Print Services not found."
        Write-Warn "Install from: https://support.apple.com/downloads/bonjour-for-windows"
        Write-Warn "Or run: winget install Apple.Bonjour"
        Write-Warn "mDNS (pos.local) will not work without it."
    } else {
        Write-Success "Bonjour Print Services detected"
    }
    
    # Note: On Windows, we use Docker container with host network for Avahi
    # which is handled by docker-compose.yml profile
}

# -----------------------------------------------------------------------------
# Step 7: Generate mkcert CA
# -----------------------------------------------------------------------------
Write-Info "Checking mkcert CA..."

$caDir = "$ProjectRoot\caddy\ca"
if (-not (Test-Path "$caDir\rootCA.pem")) {
    Write-Info "Generating mkcert CA (first run)..."
    
    # Create directory
    New-Item -ItemType Directory -Force -Path $caDir | Out-Null
    
    # Use Docker to generate CA
    try {
        docker run --rm `
            -v "${caDir}:/data" `
            ghcr.io/caddy-docker-gen/mkcert:latest `
            -install -caroot /data "pos.local" $envVars["LAN_IP"] "localhost"
        Write-Success "mkcert CA generated via Docker"
    } catch {
        Write-Warn "Docker mkcert failed. Caddy will generate self-signed certs."
    }
} else {
    Write-Info "Using existing mkcert CA"
}

# -----------------------------------------------------------------------------
# Step 8: Start Docker Stack
# -----------------------------------------------------------------------------
Write-Info "Starting Docker stack..."

$composeArgs = @("compose", "up", "-d")
if ($ForceRecreate) { $composeArgs += "--force-recreate" }
$composeArgs += "--build"

docker @composeArgs

# -----------------------------------------------------------------------------
# Step 9: Wait for Health Checks
# -----------------------------------------------------------------------------
Write-Info "Waiting for services to become healthy..."

$maxWait = 120
$waited = 0
$interval = 5

while ($waited -lt $maxWait) {
    $services = docker compose ps --format json | ConvertFrom-Json
    $allHealthy = $true
    
    foreach ($svc in $services) {
        $health = $svc.Health
        if ($health -and $health -ne "healthy" -and $health -ne "") {
            $allHealthy = $false
            break
        }
    }
    
    if ($allHealthy) {
        Write-Success "All services healthy!"
        break
    }
    
    Start-Sleep -Seconds $interval
    $waited += $interval
    Write-Host -NoNewline "."
}

Write-Host ""

if ($waited -ge $maxWait) {
    Write-Error "Timeout waiting for services. Check logs:"
    docker compose ps
    docker compose logs --tail 50
    exit 1
}

# -----------------------------------------------------------------------------
# Step 10: Verify Deployment
# -----------------------------------------------------------------------------
Write-Info "Verifying deployment..."

$lanIP = $envVars["LAN_IP"]
try {
    $response = Invoke-WebRequest -Uri "https://$lanIP/health" -UseBasicParsing -SkipCertificateCheck -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Success "HTTPS endpoint responding on $lanIP"
    }
} catch {
    Write-Warn "HTTPS check failed on $lanIP (may need CA trust)"
}

# -----------------------------------------------------------------------------
# Step 11: Summary
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "==========================================" -ForegroundColor $Green
Write-Host "[OK] POS System Deployed Successfully!" -ForegroundColor $Green
Write-Host "==========================================" -ForegroundColor $Green
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor $Cyan
Write-Host "   * HTTPS (mDNS):  https://pos.local" -ForegroundColor $Gray
Write-Host "   * HTTPS (IP):    https://$lanIP" -ForegroundColor $Gray
Write-Host "   * CA Download:   https://$lanIP/ca-cert" -ForegroundColor $Gray
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor $Cyan
Write-Host "   1. Install CA certificate on client devices:" -ForegroundColor $Gray
Write-Host "      -> Open https://$lanIP/ca-cert in browser" -ForegroundColor $Gray
Write-Host "      -> Download and install rootCA.pem" -ForegroundColor $Gray
Write-Host "   2. Access POS at https://pos.local" -ForegroundColor $Gray
Write-Host "   3. Register first admin user (sets business type)" -ForegroundColor $Gray
Write-Host "   4. Configure products, (ingredients/recipes if restaurant)" -ForegroundColor $Gray
Write-Host "   5. Set up FDE (DIAN) in Settings -> FDE" -ForegroundColor $Gray
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor $Cyan
Write-Host "   * View logs:     docker compose logs -f [service]" -ForegroundColor $Gray
Write-Host "   * Backup:        .\scripts\backup.ps1" -ForegroundColor $Gray
Write-Host "   * Restore:       .\scripts\restore.ps1" -ForegroundColor $Gray
Write-Host "   * Stop:          docker compose down" -ForegroundColor $Gray
Write-Host "   * Restart:       docker compose restart" -ForegroundColor $Gray
Write-Host ""