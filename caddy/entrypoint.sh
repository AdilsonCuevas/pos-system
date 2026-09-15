#!/bin/sh
# Caddy Entrypoint - Generates mkcert CA and certificates on first run

set -e

echo "🔐 Setting up mkcert local CA..."

CA_DIR="/data/caddy/ca"
CERT_DIR="/data/caddy/certificates"

# Create directories
mkdir -p "$CA_DIR" "$CERT_DIR"

# Check if CA already exists
if [ ! -f "$CA_DIR/rootCA.pem" ] || [ ! -f "$CA_DIR/rootCA-key.pem" ]; then
    echo "📜 Generating new mkcert CA..."
    
    # Install mkcert if not present
    if ! command -v mkcert >/dev/null 2>&1; then
        echo "⬇️  Installing mkcert..."
        apk add --no-cache mkcert
    fi
    
    # Set CAROOT to our persistent directory
    export CAROOT="$CA_DIR"
    
    # Install CA into system trust store (for container)
    mkcert -install
    
    # Generate certificate for our domains
    # Include LAN IP, pos.local, and localhost
    DOMAINS="pos.local localhost $LAN_IP"
    
    echo "🔑 Generating certificates for: $DOMAINS"
    mkcert -cert-file "$CERT_DIR/pos.local.pem" -key-file "$CERT_DIR/pos.local-key.pem" $DOMAINS
    
    # Copy CA to web root for client download
    cp "$CA_DIR/rootCA.pem" "/var/www/ca-cert.pem"
    
    echo "✅ Certificates generated:"
    echo "   - CA: $CA_DIR/rootCA.pem"
    echo "   - Cert: $CERT_DIR/pos.local.pem"
    echo "   - Key: $CERT_DIR/pos.local-key.pem"
else
    echo "♻️  Using existing mkcert CA"
    export CAROOT="$CA_DIR"
    mkcert -install
    
    # Ensure cert exists for current LAN IP (may have changed)
    if [ ! -f "$CERT_DIR/pos.local.pem" ]; then
        DOMAINS="pos.local localhost $LAN_IP"
        mkcert -cert-file "$CERT_DIR/pos.local.pem" -key-file "$CERT_DIR/pos.local-key.pem" $DOMAINS
    fi
    
    # Ensure CA is available for download
    cp "$CA_DIR/rootCA.pem" "/var/www/ca-cert.pem"
fi

# Set up certificate renewal check (runs daily via cron in container)
cat > /etc/periodic/daily/renew-certs << 'EOF'
#!/bin/sh
export CAROOT="/data/caddy/ca"
if mkcert -cert-file /data/caddy/certificates/pos.local.pem -key-file /data/caddy/certificates/pos.local-key.pem pos.local localhost $LAN_IP 2>/dev/null; then
    echo "$(date): Certificates renewed" >> /var/log/cert-renewal.log
    # Signal Caddy to reload (SIGHUP)
    kill -HUP $(pidof caddy) 2>/dev/null || true
fi
EOF
chmod +x /etc/periodic/daily/renew-certs

# Start cron for certificate renewal
crond -f -l 8 &

echo "🚀 Starting Caddy..."
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile