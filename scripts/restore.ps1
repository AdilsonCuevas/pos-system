<#
.SYNOPSIS
    POS System - Restore Script (Windows PowerShell)
    
.DESCRIPTION
    Restores database from backup file with verification.
    
.EXAMPLE
    .\scripts\restore.ps1
    .\scripts\restore.ps1 -BackupFile "backup_20260915_020000.sql.gz"
#>

param(
    [Parameter(Position=0)]
    [string]$BackupFile
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $PSScriptRoot
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

# Load .env
if (-not (Test-Path ".env")) {
    Write-Error ".env not found"
    exit 1
}

$envContent = Get-Content ".env" -Raw
$envVars = @{}
$envContent -split "`n" | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        $envVars[$matches[1].Trim()] = $matches[2].Trim()
    }
}
foreach ($key in $envVars.Keys) { $env:$key = $envVars[$key] }

$BackupDir = "$ProjectRoot\backups"
$LogFile = "$ProjectRoot\logs\restore.log"

New-Item -ItemType Directory -Force -Path (Split-Path $LogFile) | Out-Null

function Write-Log {
    param([string]$Message)
    $time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMsg = "[$time] $Message"
    Write-Host $logMsg
    $logMsg | Out-File -FilePath $LogFile -Append -Encoding utf8
}

function List-Backups {
    $backups = Get-ChildItem "$BackupDir\backup_*.sql.gz" | Sort-Object LastWriteTime -Descending
    if ($backups.Count -eq 0) {
        Write-Log "No backups found in $BackupDir"
        return @()
    }
    
    Write-Log "Available backups:"
    Write-Log "------------------"
    $i = 1
    foreach ($b in $backups) {
        $size = [math]::Round($b.Length / 1MB, 2)
        Write-Log "  $i) $($b.Name)  ($size MB, $($b.LastWriteTime))"
        $i++
    }
    Write-Log ""
    return $backups
}

function Select-Backup {
    $backups = List-Backups
    if ($backups.Count -eq 0) { exit 1 }
    
    $choice = Read-Host "Select backup number (1-$($backups.Count)) or 'q' to quit"
    if ($choice -eq "q" -or $choice -eq "Q") {
        Write-Log "Restore cancelled by user"
        exit 0
    }
    
    if (-not ($choice -as [int]) -or [int]$choice -lt 1 -or [int]$choice -gt $backups.Count) {
        Write-Log "ERROR: Invalid selection"
        exit 1
    }
    
    return $backups[[int]$choice - 1].FullName
}

function Verify-Backup {
    param([string]$File)
    
    Write-Log "Verifying backup: $File"
    
    if (-not (Test-Path $File)) {
        Write-Log "ERROR: Backup file not found: $File"
        return $false
    }
    
    try {
        gzip -t $File 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Log "ERROR: Backup file is corrupt (gzip test failed)"
            return $false
        }
    } catch {
        Write-Log "ERROR: gzip test failed"
        return $false
    }
    
    $header = zcat $File | Select-Object -First 20
    if ($header -notmatch "MariaDB dump") {
        Write-Log "WARN: Backup may not be a valid MariaDB dump"
    }
    
    Write-Log "Backup verification passed"
    return $true
}

function Perform-Restore {
    param([string]$File)
    
    Write-Log "Starting restore from: $File"
    
    Write-Host ""
    Write-Warning "This will REPLACE the current database!"
    Write-Host "   Database: pos_db"
    Write-Host "   Backup:   $(Split-Path $File -Leaf)"
    Write-Host ""
    
    $confirm = Read-Host "Type 'YES' to confirm"
    if ($confirm -ne "YES") {
        Write-Log "Restore cancelled by user"
        exit 0
    }
    
    # Stop backend
    Write-Log "Stopping backend service..."
    docker compose stop backend
    
    # Drop and recreate database
    Write-Log "Dropping and recreating database..."
    docker exec pos-mariadb mysql -u root -p"$($envVars["DB_ROOT_PASSWORD"])" -e "
        DROP DATABASE IF EXISTS pos_db;
        CREATE DATABASE pos_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    "
    
    # Import backup
    Write-Log "Importing backup..."
    try {
        zcat $File | docker exec -i pos-mariadb mysql -u root -p"$($envVars["DB_ROOT_PASSWORD"])" pos_db
    } catch {
        Write-Log "ERROR: Failed to import backup: $($_.Exception.Message)"
        docker compose start backend
        exit 1
    }
    
    # Run migrations
    Write-Log "Running pending migrations..."
    try {
        docker compose run --rm backend alembic upgrade head
    } catch {
        Write-Log "WARN: Migration failed (may be already at head)"
    }
    
    # Restart backend
    Write-Log "Starting backend service..."
    docker compose start backend
    
    # Wait for health
    Write-Log "Waiting for backend to be healthy..."
    Start-Sleep -Seconds 5
    for ($i = 1; $i -le 12; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "https://$($envVars["LAN_IP"])/api/health" -UseBasicParsing -SkipCertificateCheck -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                Write-Log "Backend is healthy"
                break
            }
        } catch { }
        Start-Sleep -Seconds 5
    }
    
    # Verify
    Write-Log "Verifying restored data..."
    $productCount = docker exec pos-mariadb mysql -u root -p"$($envVars["DB_ROOT_PASSWORD"])" pos_db -se "SELECT COUNT(*) FROM products;" 2>$null
    $saleCount = docker exec pos-mariadb mysql -u root -p"$($envVars["DB_ROOT_PASSWORD"])" pos_db -se "SELECT COUNT(*) FROM sales;" 2>$null
    $userCount = docker exec pos-mariadb mysql -u root -p"$($envVars["DB_ROOT_PASSWORD"])" pos_db -se "SELECT COUNT(*) FROM users;" 2>$null
    
    Write-Log "Restore verification:"
    Write-Log "  Products: $productCount"
    Write-Log "  Sales:    $saleCount"
    Write-Log "  Users:    $userCount"
    
    Write-Log "✅ Restore completed successfully from $(Split-Path $File -Leaf)"
}

# Main
if (-not $BackupFile) {
    $BackupFile = Select-Backup
} else {
    if (-not [IO.Path]::IsPathRooted($BackupFile)) {
        $BackupFile = "$BackupDir\$BackupFile"
    }
}

if (Verify-Backup $BackupFile) {
    Perform-Restore $BackupFile
} else {
    exit 1
}