#!/usr/bin/env bash
# POS System - Backup Script
# Run via cron: 0 2 * * * /path/to/scripts/backup.sh

set -euo pipefail

# Load environment
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

if [[ ! -f ".env" ]]; then
    echo "ERROR: .env not found"
    exit 1
fi

set -a
source .env
set +a

# Configuration
BACKUP_DIR="$PROJECT_ROOT/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql.gz"
LOG_FILE="$PROJECT_ROOT/logs/backup.log"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# Ensure directories exist
mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "Starting backup..."

# Verify database container is running
if ! docker compose ps mariadb --format json | jq -e '.[0].State == "running"' >/dev/null 2>&1; then
    log "ERROR: MariaDB container not running"
    exit 1
fi

# Create backup
log "Creating database dump..."
docker exec pos-mariadb mariadb-dump \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --hex-blob \
    -u root -p"$DB_ROOT_PASSWORD" \
    pos_db | gzip > "$BACKUP_FILE"

# Verify backup integrity
log "Verifying backup integrity..."
if ! gzip -t "$BACKUP_FILE"; then
    log "ERROR: Backup file is corrupt!"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# Verify backup contains expected tables
TABLE_COUNT=$(zcat "$BACKUP_FILE" | grep -c "^CREATE TABLE" || true)
log "Tables in backup: $TABLE_COUNT"

# Cleanup old backups
log "Cleaning up backups older than $RETENTION_DAYS days..."
DELETED=$(find "$BACKUP_DIR" -name 'backup_*.sql.gz' -mtime +$RETENTION_DAYS -delete -print | wc -l)
if [[ $DELETED -gt 0 ]]; then
    log "Deleted $DELETED old backup(s)"
fi

# List current backups
log "Current backups:"
ls -lh "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | tee -a "$LOG_FILE" || log "No backups found"

log "Backup completed successfully"