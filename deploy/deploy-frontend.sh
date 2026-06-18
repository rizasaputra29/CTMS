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

echo -e "${YELLOW}[1/7] Connecting to VPS and deploying...${NC}"

ssh ${VPS_USER}@${VPS_IP} << 'REMOTE_SCRIPT'
    set -e
    
    # Navigate to project directory
    cd /var/www/sicata/frontend || {
        echo "Frontend directory not found. Creating..."
        mkdir -p /var/www/sicata/frontend
        cd /var/www/sicata/frontend
    }
    
    echo "[2/7] Pulling latest code..."
    git pull origin dev || {
        echo "Git pull failed. Please check your repository configuration."
        exit 1
    }
    
    echo "[3/7] Creating .env.local file..."
    # Create .env.local with HTTPS URLs (nginx handles SSL)
    cat > /var/www/sicata/frontend/.env.local << 'ENVFILE'
# CTMS Environment Variables - VPS Production (HTTPS via nginx)
NEXT_PUBLIC_APP_NAME=SICATA
NEXT_PUBLIC_APP_URL=https://148.230.99.31
NEXT_PUBLIC_API_URL=https://148.230.99.31/api
NEXT_PUBLIC_BACKEND_URL=https://148.230.99.31
NEXT_PUBLIC_AUTH_COOKIE_NAME=sicata_session
NEXT_PUBLIC_ENABLE_MOCK_API=false
NEXT_PUBLIC_DEBUG=false
ENVFILE
    
    echo "[4/7] Installing dependencies..."
    rm -rf node_modules .next
    npm ci --production=false
    
    echo "[5/7] Building application..."
    # Export env vars so they're available during build
    export NEXT_PUBLIC_APP_NAME=SICATA
    export NEXT_PUBLIC_APP_URL=https://148.230.99.31
    export NEXT_PUBLIC_API_URL=https://148.230.99.31/api
    export NEXT_PUBLIC_BACKEND_URL=https://148.230.99.31
    export NEXT_PUBLIC_AUTH_COOKIE_NAME=sicata_session
    export NEXT_PUBLIC_ENABLE_MOCK_API=false
    export NEXT_PUBLIC_DEBUG=false
    npm run build
    
    echo "[6/7] Setting up PM2..."
    # Create PM2 log directory if it doesn't exist
    mkdir -p /var/log/pm2
    
    # Stop existing process if running
    pm2 stop sicata-frontend 2>/dev/null || true
    pm2 delete sicata-frontend 2>/dev/null || true
    
    # Start with PM2
    cd /var/www/sicata/frontend
    pm2 start ecosystem.config.cjs --env production
    
    echo "[7/7] Saving PM2 configuration..."
    pm2 save
    
    # Setup PM2 startup (auto-start on reboot)
    pm2 startup systemd -u root --hp /root || true
    
REMOTE_SCRIPT

echo ""
echo -e "${GREEN}=========================================="
echo "Frontend deployment complete!"
echo "=========================================="
echo ""
echo "Frontend is now running at: https://${VPS_IP}"
echo ""
echo "To verify:"
echo "  curl -kI https://${VPS_IP}"
echo "==========================================${NC}"
