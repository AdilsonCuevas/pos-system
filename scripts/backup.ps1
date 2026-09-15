<#
.SYNOPSIS
    POS System - Backup Script (Windows PowerShell)
    
.DESCRIPTION
    Creates a compressed database backup with verification and retention.
    
.EXAMPLE
    .\scripts\backup.ps1
#>

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
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = "$BackupDir\backup_${Timestamp}.sql.gz"
$LogFile = "$ProjectRoot\logs\backup.log"
$RetentionDays = if ($envVars.ContainsKey("BACKUP_RETENTION_DAYS")) { [int]$envVars["BACKUP_RETENTION_DAYS"] } else { 30 }

# Ensure directories
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $LogFile) | Out-Null

function Write-Log {
    param([string]$Message)
    $time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMsg = "[$time] $Message"
    Write-Host $logMsg
    $logMsg | Out-File -FilePath $LogFile -Append -Encoding utf8
}

Write-Log "Starting backup..."

# Verify MariaDB container
$container = docker compose ps mariadb --format json | ConvertFrom-Json
if ($container.State -ne "running") {
    Write-Log "ERROR: MariaDB container not running"
    exit 1
}

Write-Log "Creating database dump..."

# Run mariadb-dump in container
try {
    docker exec pos-mariadb mariadb-dump `
        --single-transaction `
        --routines `
        --triggers `
        --events `
        --hex-blob `
        -u root -p"$($envVars["DB_ROOT_PASSWORD"])" `
        pos_db | gzip > $BackupFile
} catch {
    Write-Log "ERROR: Failed to create dump: $($_.Exception.Message)"
    exit 1
}

# Verify backup
Write-Log "Verifying backup integrity..."
try {
    $test = gzip -t $BackupFile 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR: Backup file is corrupt!"
        Remove-Item $BackupFile -Force
        exit 1
    }
} catch {
    Write-Log "ERROR: gzip test failed"
    Remove-Item $BackupFile -Force
    exit 1
}

$BackupSize = (Get-Item $BackupFile).Length
$BackupSizeMB = [math]::Round($BackupSize / 1MB, 2)
Write-Log "Backup created: $BackupFile ($BackupSizeMB MB)"

# Count tables
$tableCount = (zcat $BackupFile | Select-String "^CREATE TABLE").Count
Write-Log "Tables in backup: $tableCount"

# Cleanup old backups
Write-Log "Cleaning up backups older than $RetentionDays days..."
$deleted = Get-ChildItem "$BackupDir\backup_*.sql.gz" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } | Remove-Item -Force -Verbose
$deletedCount = ($deleted | Measure-Object).Count
if ($deletedCount -gt 0) {
    Write-Log "Deleted $deletedCount old backup(s)"
}

# List current backups
Write-Log "Current backups:"
Get-ChildItem "$BackupDir\backup_*.sql.gz" | Sort-Object LastWriteTime -Descending | ForEach-Object {
    Write-Log "  $($_.Name)  $([math]::Round($_.Length/1MB,2)) MB  $($_.LastWriteTime)"
}

Write-Log "Backup completed successfully"