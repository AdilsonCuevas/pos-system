#!/usr/bin/env bash
# POS System - Deployment Script (Linux/macOS)
# Run from project root: ./scripts/deploy.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# -----------------------------------------------------------------------------
# Step 1: Load Environment
# -----------------------------------------------------------------------------
log_info "Loading environment configuration..."

if [[ ! -f ".env" ]]; then
    if [[ -f ".env.example" ]]; then
        log_warn ".env not found. Copying from .env.example..."
        cp .env.example .env
        log_error "Please edit .env with your configuration before running deploy again!"
        exit 1
    else
        log_error ".env.example not found!"
        exit 1
    fi
fi

# Load .env
set -a
source .env
set +a

# -----------------------------------------------------------------------------
# Step 2: Validate Required Variables
# -----------------------------------------------------------------------------
required_vars=("DB_ROOT_PASSWORD" "DB_APP_PASSWORD" "JWT_SECRET" "BUSINESS_TYPE" "LAN_CIDR")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" || "${!var}" == "change_me_"* ]]; then
        missing_vars+=("$var")
    fi
done

if [[ ${#missing_vars[@]} -gt 0 ]]; then
    log_error "Missing or default values for required variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    log_error "Please edit .env and set proper values."
    exit 1
fi

# -----------------------------------------------------------------------------
# Step 3: Detect LAN IP
# -----------------------------------------------------------------------------
if [[ "${LAN_IP:-auto}" == "auto" ]]; then
    log_info "Auto-detecting LAN IP..."
    
    # Try multiple methods
    if command -v ip >/dev/null 2>&1; then
        # Linux: ip route get
        DETECTED_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
    elif command -v ifconfig >/dev/null 2>&1; then
        # macOS/BSD: ifconfig
        DETECTED_IP=$(ifconfig | grep -E 'inet [0-9]' | grep -v '127.0.0.1' | head -1 | awk '{print $2}')
    else
        log_error "Cannot auto-detect LAN IP. Please set LAN_IP manually in .env"
        exit 1
    fi
    
    if [[ -z "$DETECTED_IP" ]]; then
        log_error "Failed to auto-detect LAN IP. Set LAN_IP manually in .env"
        exit 1
    fi
    
    log_info "Detected LAN IP: $DETECTED_IP"
    
    # Update .env with detected IP
    if grep -q "^LAN_IP=" .env; then
        sed -i "s/^LAN_IP=.*/LAN_IP=$DETECTED_IP/" .env
    else
        echo "LAN_IP=$DETECTED_IP" >> .env
    fi
    
    # Also update LAN_CIDR if it looks like it needs updating
    if [[ "$LAN_CIDR" == "192.168.1.0/24" && "$DETECTED_IP" != 192.168.1.* ]]; then
        # Try to infer CIDR from detected IP
        CIDR_BASE=$(echo "$DETECTED_IP" | cut -d. -f1-3)
        NEW_CIDR="${CIDR_BASE}.0/24"
        log_warn "Updating LAN_CIDR from $LAN_CIDR to $NEW_CIDR based on detected IP"
        sed -i "s/^LAN_CIDR=.*/LAN_CIDR=$NEW_CIDR/" .env
        LAN_CIDR="$NEW_CIDR"
    fi
    
    LAN_IP="$DETECTED_IP"
else
    log_info "Using configured LAN IP: $LAN_IP"
fi

# -----------------------------------------------------------------------------
# Step 4: Configure Firewall
# -----------------------------------------------------------------------------
log_info "Configuring firewall for LAN access..."

if command -v ufw >/dev/null 2>&1; then
    # Ubuntu/Debian with UFW
    log_info "Configuring UFW..."
    
    # Allow SSH (don't lock yourself out!)
    ufw allow ssh comment 'SSH'
    
    # Allow POS services from LAN CIDR only
    ufw allow from "$LAN_CIDR" to any port 80 comment 'POS HTTP'
    ufw allow from "$LAN_CIDR" to any port 443 comment 'POS HTTPS'
    ufw allow from "$LAN_CIDR" to any port 3306 comment 'POS MariaDB'
    
    # Enable firewall if not active
    if ! ufw status | grep -q "Status: active"; then
        log_warn "Enabling UFW firewall..."
        echo "y" | ufw enable
    fi
    
    ufw reload
    log_success "UFW configured"
    
elif command -v firewall-cmd >/dev/null 2>&1; then
    # RHEL/Fedora with firewalld
    log_info "Configuring firewalld..."
    
    firewall-cmd --permanent --add-service=ssh
    firewall-cmd --permanent --add-rich-rule="rule family=ipv4 source address=$LAN_CIDR port port=80 protocol=tcp accept"
    firewall-cmd --permanent --add-rich-rule="rule family=ipv4 source address=$LAN_CIDR port port=443 protocol=tcp accept"
    firewall-cmd --permanent --add-rich-rule="rule family=ipv4 source address=$LAN_CIDR port port=3306 protocol=tcp accept"
    firewall-cmd --reload
    log_success "firewalld configured"
    
else
    log_warn "No supported firewall found (ufw/firewalld). Please configure manually:"
    echo "  - Allow TCP 80, 443, 3306 from $LAN_CIDR"
fi

# -----------------------------------------------------------------------------
# Step 5: Install/Configure Avahi (mDNS) - Linux only
# -----------------------------------------------------------------------------
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    log_info "Configuring Avahi mDNS..."
    
    if ! command -v avahi-daemon >/dev/null 2>&1; then
        log_info "Installing avahi-daemon..."
        if command -v apt-get >/dev/null 2>&1; then
            apt-get update && apt-get install -y avahi-daemon
        elif command -v dnf >/dev/null 2>&1; then
            dnf install -y avahi
        elif command -v pacman >/dev/null 2>&1; then
            pacman -S --noconfirm avahi
        else
            log_warn "Cannot install avahi-daemon automatically. Please install manually."
        fi
    fi
    
    # Install service file
    if [[ -f "avahi/pos.service" ]]; then
        sudo cp avahi/pos.service /etc/avahi/services/
        log_success "Avahi service installed"
    fi
    
    # Enable and restart
    sudo systemctl enable avahi-daemon
    sudo systemctl restart avahi-daemon
    log_success "Avahi configured and started"
fi

# -----------------------------------------------------------------------------
# Step 6: Generate mkcert CA (if needed)
# -----------------------------------------------------------------------------
log_info "Checking mkcert CA..."

if [[ ! -f "caddy/ca/rootCA.pem" ]]; then
    log_info "Generating mkcert CA (first run)..."
    
    # Create CA directory
    mkdir -p caddy/ca
    
    # Use Docker to generate CA (avoids needing mkcert on host)
    docker run --rm \
        -v "$PROJECT_ROOT/caddy/ca:/data" \
        ghcr.io/caddy-docker-gen/mkcert:latest \
        -install -caroot /data "pos.local" "$LAN_IP" "localhost" || {
        log_warn "Docker mkcert failed. Trying local mkcert..."
        if command -v mkcert >/dev/null 2>&1; then
            export CAROOT="$PROJECT_ROOT/caddy/ca"
            mkcert -install
            mkcert -caroot "$CAROOT" "pos.local" "$LAN_IP" "localhost"
        else
            log_warn "mkcert not available. Caddy will generate self-signed certs."
        fi
    }
    
    log_success "mkcert CA generated"
else
    log_info "Using existing mkcert CA"
fi

# -----------------------------------------------------------------------------
# Step 7: Start Docker Stack
# -----------------------------------------------------------------------------
log_info "Starting Docker stack..."

# Build and start
docker compose up -d --build

# -----------------------------------------------------------------------------
# Step 8: Wait for Health Checks
# -----------------------------------------------------------------------------
log_info "Waiting for services to become healthy..."

MAX_WAIT=120
WAITED=0
INTERVAL=5

while [[ $WAITED -lt $MAX_WAIT ]]; do
    if docker compose ps --format json | jq -e 'all(.Health == "healthy" or .Health == "")' >/dev/null 2>&1; then
        log_success "All services healthy!"
        break
    fi
    
    sleep $INTERVAL
    WAITED=$((WAITED + INTERVAL))
    echo -n "."
done

echo ""

if [[ $WAITED -ge $MAX_WAIT ]]; then
    log_error "Timeout waiting for services. Check logs:"
    docker compose ps
    docker compose logs --tail=50
    exit 1
fi

# -----------------------------------------------------------------------------
# Step 9: Verify Deployment
# -----------------------------------------------------------------------------
log_info "Verifying deployment..."

# Test HTTPS endpoint
if curl -kf "https://$LAN_IP/health" >/dev/null 2>&1; then
    log_success "HTTPS endpoint responding on $LAN_IP"
else
    log_warn "HTTPS check failed on $LAN_IP (may need CA trust)"
fi

# Test mDNS (Linux only)
if [[ "$OSTYPE" == "linux-gnu"* ]] && command -v avahi-resolve >/dev/null 2>&1; then
    if avahi-resolve -n "pos.local" >/dev/null 2>&1; then
        log_success "mDNS resolution working: pos.local"
    else
        log_warn "mDNS resolution not working yet (may need few seconds)"
    fi
fi

# -----------------------------------------------------------------------------
# Step 10: Summary
# -----------------------------------------------------------------------------
echo ""
echo "=========================================="
log_success "🎉 POS System Deployed Successfully!"
echo "=========================================="
echo ""
echo "📍 Access URLs:"
echo "   • HTTPS (mDNS):  https://pos.local"
echo "   • HTTPS (IP):    https://$LAN_IP"
echo "   • CA Download:   https://$LAN_IP/ca-cert"
echo ""
echo "🔐 Next Steps:"
echo "   1. Install CA certificate on client devices:"
echo "      → Open https://$LAN_IP/ca-cert in browser"
echo "      → Download and install rootCA.pem"
echo "   2. Access POS at https://pos.local"
echo "   3. Register first admin user (sets business type)"
echo "   4. Configure products, (ingredients/recipes if restaurant)"
echo "   5. Set up FDE (DIAN) in Settings → FDE"
echo ""
echo "📋 Useful Commands:"
echo "   • View logs:     docker compose logs -f [service]"
echo "   • Backup:        ./scripts/backup.sh"
echo "   • Restore:       ./scripts/restore.sh"
echo "   • Stop:          docker compose down"
echo "   • Restart:       docker compose restart"
echo ""

# Save detected IP for reference
echo "LAN_IP_DETECTED=$LAN_IP" >> .env