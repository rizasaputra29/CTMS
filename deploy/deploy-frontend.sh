#!/bin/bash

# =============================================================================
# SICATA Frontend Deployment Script
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=========================================="
echo "SICATA Frontend Deployment"
echo "==========================================${NC}"

# SSH connection details
VPS_IP="148.230.99.31"
VPS_USER="root"
REMOTE_DIR="/var/www/sicata/frontend"

echo -e "${YELLOW}[1/6] Connecting to VPS and deploying...${NC}"

ssh ${VPS_USER}@${VPS_IP} << 'REMOTE_SCRIPT'
    set -e
    
    # Navigate to project directory
    cd /var/www/sicata/frontend || {
        echo "Frontend directory not found. Creating..."
        mkdir -p /var/www/sicata/frontend
        cd /var/www/sicata/frontend
    }
    
    echo "[2/6] Pulling latest code..."
    git pull origin main || {
        echo "Git pull failed. Please check your repository configuration."
        exit 1
    }
    
    echo "[3/6] Installing dependencies..."
    npm ci --production=false
    
    echo "[4/6] Building application..."
    npm run build
    
    echo "[5/6] Setting up PM2..."
    # Create PM2 log directory if it doesn't exist
    mkdir -p /var/log/pm2
    
    # Stop existing process if running
    pm2 stop sicata-frontend 2>/dev/null || true
    pm2 delete sicata-frontend 2>/dev/null || true
    
    # Start with PM2
    cd /var/www/sicata/frontend
    pm2 start ecosystem.config.js --env production
    
    echo "[6/6] Saving PM2 configuration..."
    pm2 save
    
    # Setup PM2 startup (auto-start on reboot)
    pm2 startup systemd -u root --hp /root || true
    
REMOTE_SCRIPT

echo ""
echo -e "${GREEN}=========================================="
echo "Frontend deployment complete!"
echo "=========================================="
echo ""
echo "Frontend is now running at: http://${VPS_IP}:3000"
echo ""
echo "To verify:"
echo "  curl -I http://${VPS_IP}:3000"
echo "==========================================${NC}"
