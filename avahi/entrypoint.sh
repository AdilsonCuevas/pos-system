#!/bin/sh
# Avahi Entrypoint - Publishes mDNS service for POS discovery

set -e

echo "📡 Starting Avahi mDNS publisher..."

# Wait for network to be ready
sleep 2

# The service file is already mounted at /etc/avahi/services/pos.service
# Avahi daemon will automatically pick it up

# Start avahi-daemon in foreground
exec avahi-daemon --no-drop-root --foreground