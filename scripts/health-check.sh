#!/usr/bin/env bash
# POS System - Health Check Script
# Verifies all services are running correctly

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

LAN_IP="${LAN_IP:-localhost}"

check_service() {
    local name="$1"
    local cmd="$2"
    local expected="${3:-0}"
    
    if eval "$cmd" >/dev/null 2>&1; then
        echo "✅ $name"
        return 0
    else
        echo "❌ $name"
        return 1
    fi
}

check_http() {
    local name="$1"
    local url="$2"
    local code="${3:-200}"
    
    if curl -kf -s -o /dev/null -w "%{http_code}" "$url" | grep -q "^$code$"; then
        echo "✅ $name ($url)"
        return 0
    else
        echo "❌ $name ($url)"
        return 1
    fi
}

echo "=========================================="
echo "POS System Health Check"
echo "=========================================="
echo ""

FAILED=0

# Docker services
echo "🐳 Docker Services:"
check_service "MariaDB" "docker compose ps mariadb --format json | jq -e '.[0].State == \"running\"'" || FAILED=1
check_service "Backend" "docker compose ps backend --format json | jq -e '.[0].State == \"running\"'" || FAILED=1
check_service "Caddy" "docker compose ps caddy --format json | jq -e '.[0].State == \"running\"'" || FAILED=1

# Health endpoints
echo ""
echo "🏥 Health Endpoints:"
check_http "Backend API" "https://$LAN_IP/api/health" || FAILED=1
check_http "Caddy HTTPS" "https://$LAN_IP/health" || FAILED=1

# Database connectivity
echo ""
echo "🗄️  Database:"
check_service "MariaDB Ping" "docker exec pos-mariadb mysqladmin ping -h 127.0.0.1 -u root -p$DB_ROOT_PASSWORD" || FAILED=1
check_service "Database Exists" "docker exec pos-mariadb mysql -u root -p$DB_ROOT_PASSWORD -e 'USE pos_db; SELECT 1;'" || FAILED=1

# Tables exist
echo ""
echo "📋 Key Tables:"
for table in users products categories sales ingredients recipes; do
    check_service "Table: $table" "docker exec pos-mariadb mysql -u root -p$DB_ROOT_PASSWORD pos_db -e 'SELECT 1 FROM $table LIMIT 1;'" || FAILED=1
done

# Network
echo ""
echo "🌐 Network:"
check_service "LAN IP Reachable" "ping -c 1 -W 1 $LAN_IP" || FAILED=1
check_service "Port 80" "timeout 2 bash -c \"cat < /dev/null > /dev/tcp/$LAN_IP/80\"" || FAILED=1
check_service "Port 443" "timeout 2 bash -c \"cat < /dev/null > /dev/tcp/$LAN_IP/443\"" || FAILED=1
check_service "Port 3306 (LAN only)" "timeout 2 bash -c \"cat < /dev/null > /dev/tcp/$LAN_IP/3306\"" || FAILED=1

# mDNS (Linux only)
if [[ "$OSTYPE" == "linux-gnu"* ]] && command -v avahi-resolve >/dev/null 2>&1; then
    echo ""
    echo "📡 mDNS:"
    check_service "pos.local resolves" "avahi-resolve -n pos.local" || FAILED=1
fi

# Disk space
echo ""
echo "💾 Disk Space:"
df -h "$PROJECT_ROOT" | tail -1 | awk '{print "  Usage: " $5 " (" $4 " free)"}'

echo ""
echo "=========================================="
if [[ $FAILED -eq 0 ]]; then
    echo "✅ All checks passed!"
    exit 0
else
    echo "❌ $FAILED check(s) failed"
    exit 1
fi