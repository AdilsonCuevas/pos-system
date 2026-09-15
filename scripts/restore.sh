#!/usr/bin/env bash
# POS System - Restore Script
# Usage: ./scripts/restore.sh [backup_file]
# If no backup_file specified, shows interactive menu

set -euo pipefail

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

BACKUP_DIR="$PROJECT_ROOT/backups"
LOG_FILE="$PROJECT_ROOT/logs/restore.log"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# -----------------------------------------------------------------------------
# List available backups
# -----------------------------------------------------------------------------
list_backups() {
    echo "Available backups:"
    echo "------------------"
    local i=1
    while IFS= read -r file; do
        if [[ -n "$file" ]]; then
            size=$(du -h "$file" | cut -f1)
            date_str=$(stat -c '%y' "$file" | cut -d' ' -f1,2 | cut -d'.' -f1)
            basename=$(basename "$file")
            echo "  $i) $basename  ($size, $date_str)"
            i=$((i+1))
        fi
    done < <(find "$BACKUP_DIR" -name 'backup_*.sql.gz' -type f | sort -r)
    echo ""
}

# -----------------------------------------------------------------------------
# Select backup interactively
# -----------------------------------------------------------------------------
select_backup() {
    local backups=()
    while IFS= read -r file; do
        [[ -n "$file" ]] && backups+=("$file")
    done < <(find "$BACKUP_DIR" -name 'backup_*.sql.gz' -type f | sort -r)
    
    if [[ ${#backups[@]} -eq 0 ]]; then
        log "ERROR: No backups found in $BACKUP_DIR"
        exit 1
    fi
    
    list_backups
    
    echo -n "Select backup number (1-${#backups[@]}) or 'q' to quit: "
    read -r choice
    
    if [[ "$choice" == "q" || "$choice" == "Q" ]]; then
        log "Restore cancelled by user"
        exit 0
    fi
    
    if ! [[ "$choice" =~ ^[0-9]+$ ]] || [[ $choice -lt 1 ]] || [[ $choice -gt ${#backups[@]} ]]; then
        log "ERROR: Invalid selection"
        exit 1
    fi
    
    echo "${backups[$((choice-1))]}"
}

# -----------------------------------------------------------------------------
# Verify backup file
# -----------------------------------------------------------------------------
verify_backup() {
    local file="$1"
    
    log "Verifying backup: $file"
    
    if [[ ! -f "$file" ]]; then
        log "ERROR: Backup file not found: $file"
        return 1
    fi
    
    if ! gzip -t "$file"; then
        log "ERROR: Backup file is corrupt (gzip test failed)"
        return 1
    fi
    
    # Quick SQL syntax check
    if ! zcat "$file" | head -20 | grep -q "MariaDB dump"; then
        log "WARN: Backup may not be a valid MariaDB dump"
    fi
    
    log "Backup verification passed"
    return 0
}

# -----------------------------------------------------------------------------
# Perform restore
# -----------------------------------------------------------------------------
perform_restore() {
    local backup_file="$1"
    
    log "Starting restore from: $backup_file"
    
    # Confirm
    echo ""
    echo "⚠️  WARNING: This will REPLACE the current database!"
    echo "   Database: pos_db"
    echo "   Backup:   $(basename "$backup_file")"
    echo ""
    echo -n "Type 'YES' to confirm: "
    read -r confirm
    
    if [[ "$confirm" != "YES" ]]; then
        log "Restore cancelled by user"
        exit 0
    fi
    
    # Stop backend to prevent writes during restore
    log "Stopping backend service..."
    docker compose stop backend
    
    # Drop and recreate database
    log "Dropping and recreating database..."
    docker exec pos-mariadb mysql -u root -p"$DB_ROOT_PASSWORD" -e "
        DROP DATABASE IF EXISTS pos_db;
        CREATE DATABASE pos_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    "
    
    # Import backup
    log "Importing backup (this may take a while)..."
    if ! zcat "$backup_file" | docker exec -i pos-mariadb mysql -u root -p"$DB_ROOT_PASSWORD" pos_db; then
        log "ERROR: Failed to import backup"
        docker compose start backend
        exit 1
    fi
    
    # Run migrations (in case backup is from older version)
    log "Running pending migrations..."
    docker compose run --rm backend alembic upgrade head || {
        log "WARN: Migration failed (may be already at head)"
    }
    
    # Restart backend
    log "Starting backend service..."
    docker compose start backend
    
    # Wait for backend health
    log "Waiting for backend to be healthy..."
    sleep 5
    for i in {1..12}; do
        if curl -kf "https://${LAN_IP:-localhost}/api/health" >/dev/null 2>&1; then
            log "Backend is healthy"
            break
        fi
        sleep 5
    done
    
    # Verify restore
    log "Verifying restored data..."
    PRODUCT_COUNT=$(docker exec pos-mariadb mysql -u root -p"$DB_ROOT_PASSWORD" pos_db -se "SELECT COUNT(*) FROM products;" 2>/dev/null || echo "0")
    SALE_COUNT=$(docker exec pos-mariadb mysql -u root -p"$DB_ROOT_PASSWORD" pos_db -se "SELECT COUNT(*) FROM sales;" 2>/dev/null || echo "0")
    USER_COUNT=$(docker exec pos-mariadb mysql -u root -p"$DB_ROOT_PASSWORD" pos_db -se "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
    
    log "Restore verification:"
    log "  Products: $PRODUCT_COUNT"
    log "  Sales:    $SALE_COUNT"
    log "  Users:    $USER_COUNT"
    
    log "✅ Restore completed successfully from $(basename "$backup_file")"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
    local backup_file="${1:-}"
    
    if [[ -z "$backup_file" ]]; then
        backup_file=$(select_backup)
    else
        # If relative path, make absolute
        if [[ ! "$backup_file" = /* ]]; then
            backup_file="$BACKUP_DIR/$backup_file"
        fi
    fi
    
    if verify_backup "$backup_file"; then
        perform_restore "$backup_file"
    else
        exit 1
    fi
}

main "$@"