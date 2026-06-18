#!/bin/bash

# =============================================================================
# SICATA SSL Setup Script (Self-signed for IP-based HTTPS)
# Run this ONCE on the VPS to enable HTTPS
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=========================================="
echo "SICATA SSL Certificate Setup"
echo "==========================================${NC}"

VPS_IP="148.230.99.31"

echo -e "${YELLOW}[1/4] Creating SSL directory and self-signed certificate...${NC}"
mkdir -p /etc/ssl/sicata

# Create self-signed certificate
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/ssl/sicata/privkey.pem \
    -out /etc/ssl/sicata/fullchain.pem \
    -subj "/C=ID/ST=JawaTengah/L=Semarang/O=SICATA/CN=${VPS_IP}" \
    -addext "subjectAltName=IP:${VPS_IP}"

echo -e "${YELLOW}[2/4] Installing nginx config...${NC}"

# Copy the nginx config from the repo
cp /var/www/sicata/deploy/nginx-sicata.conf /etc/nginx/sites-available/sicata

# Remove default site if it exists
rm -f /etc/nginx/sites-enabled/default

# Enable sicata site
ln -sf /etc/nginx/sites-available/sicata /etc/nginx/sites-enabled/sicata

# Make sure port 80 and 443 are open
echo -e "${YELLOW}[3/4] Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp 2>/dev/null || true
    ufw allow 443/tcp 2>/dev/null || true
    echo "Firewall rules added for ports 80 and 443"
fi

echo -e "${YELLOW}[4/4] Testing and reloading nginx...${NC}"
nginx -t
systemctl reload nginx

echo ""
echo -e "${GREEN}=========================================="
echo "SSL Setup Complete!"
echo "=========================================="
echo ""
echo "Your application is now available at:"
echo "  https://${VPS_IP}"
echo ""
echo "Both frontend and backend are served through"
echo "nginx on port 443 (HTTPS)."
echo ""
echo "Note: You may see a security warning because"
echo "we're using a self-signed certificate."
echo "Click 'Advanced' → 'Proceed' to continue."
echo "==========================================${NC}"
