#!/usr/bin/env bash
# POS System - CA Certificate Installation Script
# Run on client devices to trust the local mkcert CA

set -euo pipefail

CA_URL="${1:-https://pos.local/ca-cert/rootCA.pem}"
CA_FILE="/tmp/rootCA.pem"

echo "🔐 POS System - CA Certificate Installation"
echo "============================================"
echo ""

# Download CA
echo "📥 Downloading CA from $CA_URL..."
if ! curl -kf -o "$CA_FILE" "$CA_URL"; then
    echo "❌ Failed to download CA. Trying alternative..."
    CA_URL="${CA_URL%/ca-cert/rootCA.pem}/ca-cert"
    if ! curl -kf -o "$CA_FILE" "$CA_URL/rootCA.pem"; then
        echo "❌ Could not download CA certificate"
        echo "   Please manually download from: $CA_URL"
        exit 1
    fi
fi

echo "✅ CA downloaded to $CA_FILE"
echo ""

# Detect OS
OS="$(uname -s)"

case "$OS" in
    Linux*)
        echo "🐧 Detected Linux"
        echo ""
        echo "Installing CA certificate..."
        
        # Copy to system CA directory
        sudo cp "$CA_FILE" /usr/local/share/ca-certificates/pos-local-rootCA.crt
        
        # Update certificate store
        sudo update-ca-certificates
        
        echo "✅ CA installed system-wide"
        echo ""
        echo "🔄 Please restart your browser for changes to take effect"
        ;;
        
    Darwin*)
        echo "🍎 Detected macOS"
        echo ""
        echo "Installing CA certificate..."
        
        # Add to System keychain (requires sudo)
        sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "$CA_FILE"
        
        echo "✅ CA installed in System keychain"
        echo ""
        echo "🔄 Please restart your browser for changes to take effect"
        ;;
        
    CYGWIN*|MINGW*|MSYS*)
        echo "🪟 Detected Windows (Git Bash/MSYS)"
        echo ""
        echo "Please run the following in PowerShell as Administrator:"
        echo ""
        echo "  certutil -addstore Root \"$CA_FILE\""
        echo ""
        echo "Or manually:"
        echo "  1. Double-click $CA_FILE"
        echo "  2. Click 'Install Certificate...'"
        echo "  3. Select 'Local Machine' → 'Trusted Root Certification Authorities'"
        echo "  4. Complete the wizard"
        ;;
        
    *)
        echo "❓ Unknown OS: $OS"
        echo "Please manually install $CA_FILE as a trusted root CA"
        ;;
esac

echo ""
echo "📱 For mobile devices:"
echo "   1. Open https://pos.local/ca-cert on your phone"
echo "   2. Download rootCA.pem"
echo "   3. iOS: Settings → General → VPN & Device Management → Download Profile"
echo "   4. Android: Settings → Security → Install from storage → CA certificate"
echo ""
echo "✨ After installation, https://pos.local should show a lock icon (no warning)"