#!/usr/bin/env bash
# POS System - Backup Verification Script
# Performs a test restore to verify backup integrity

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
LOG_FILE="$PROJECT_ROOT/logs/verify-backup.log"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Find latest backup
LATEST_BACKUP=$(find "$BACKUP_DIR" -name 'backup_*.sql.gz' -type f | sort -r | head -1)

if [[ -z "$LATEST_BACKUP" ]]; then
    log "ERROR: No backups found in $BACKUP_DIR"
    exit 1
fi

log "Verifying backup: $(basename "$LATEST_BACKUP")"

# 1. Check gzip integrity
log "Step 1: Checking gzip integrity..."
if ! gzip -t "$LATEST_BACKUP"; then
    log "❌ FAILED: gzip integrity check failed"
    exit 1
fi
log "✅ gzip integrity OK"

# 2. Check SQL structure
log "Step 2: Checking SQL structure..."
TABLE_COUNT=$(zcat "$LATEST_BACKUP" | grep -c "^CREATE TABLE" || true)
log "  Tables found: $TABLE_COUNT"

if [[ $TABLE_COUNT -lt 10 ]]; then
    log "❌ FAILED: Too few tables ($TABLE_COUNT), expected at least 18"
    exit 1
fi
log "✅ Table count OK"

# 3. Check for key tables
log "Step 3: Checking for key tables..."
for table in users products categories sales ingredients recipes fde_documents; do
    if zcat "$LATEST_BACKUP" | grep -q "CREATE TABLE \`$table\`"; then
        log "  ✅ $table"
    else
        log "  ❌ $table MISSING"
        exit 1
    fi
done
log "✅ All key tables present"

# 4. Test restore to temporary container
log "Step 4: Performing test restore to temporary container..."

TEMP_CONTAINER="pos-verify-$(date +%s)"
TEMP_DB="pos_verify_$(date +%s)"

# Start temporary MariaDB
log "  Starting temporary MariaDB..."
docker run -d \
    --name "$TEMP_CONTAINER" \
    -e MYSQL_ROOT_PASSWORD=verify123 \
    -e MYSQL_DATABASE="$TEMP_DB" \
    mariadb:11.4 \
    --max-connections=50 \
    --innodb-buffer-pool-size=64M >/dev/null

# Wait for it to be ready
sleep 5
for i in {1..10}; do
    if docker exec "$TEMP_CONTAINER" mysqladmin ping -h 127.0.0.1 -u root -pverify123 >/dev/null 2>&1; then
        break
    fi
    sleep 2
done

# Import backup
log "  Importing backup..."
if ! zcat "$LATEST_BACKUP" | docker exec -i "$TEMP_CONTAINER" mysql -u root -pverify123 "$TEMP_DB"; then
    log "❌ FAILED: Backup import failed"
    docker rm -f "$TEMP_CONTAINER" >/dev/null
    exit 1
fi

# Verify data
log "  Verifying restored data..."
USER_COUNT=$(docker exec "$TEMP_CONTAINER" mysql -u root -pverify123 "$TEMP_DB" -se "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
PRODUCT_COUNT=$(docker exec "$TEMP_CONTAINER" mysql -u root -pverify123 "$TEMP_DB" -se "SELECT COUNT(*) FROM products;" 2>/dev/null || echo "0")
CATEGORY_COUNT=$(docker exec "$TEMP_CONTAINER" mysql -u root -pverify123 "$TEMP_DB" -se "SELECT COUNT(*) FROM categories;" 2>/dev/null || echo "0")

log "  Restored counts:"
log "    Users:     $USER_COUNT"
log "    Products:  $PRODUCT_COUNT"
log "    Categories: $CATEGORY_COUNT"

# Cleanup
docker rm -f "$TEMP_CONTAINER" >/dev/null

log "✅ Test restore successful"
log ""
log "=========================================="
log "✅ BACKUP VERIFICATION PASSED"
log "=========================================="
log "Backup: $(basename "$LATEST_BACKUP")"
log "Size:   $(du -h "$LATEST_BACKUP" | cut -f1)"
log "Tables: $TABLE_COUNT"
log "Data:   Users=$USER_COUNT, Products=$PRODUCT_COUNT, Categories=$CATEGORY_COUNT"