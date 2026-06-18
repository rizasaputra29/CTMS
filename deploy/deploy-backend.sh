#!/bin/bash

# =============================================================================
# SICATA Backend Deployment Script
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=========================================="
echo "SICATA Backend Deployment"
echo "==========================================${NC}"

# SSH connection details
VPS_IP="148.230.99.31"
VPS_USER="root"
REMOTE_DIR="/var/www/sicata/backend"

# Check if SSH key exists
if [ ! -f ~/.ssh/id_rsa ] && [ ! -f ~/.ssh/id_ed25519 ]; then
    echo -e "${RED}Error: No SSH key found. Please set up SSH key authentication first.${NC}"
    exit 1
fi

echo -e "${YELLOW}[1/6] Connecting to VPS and deploying...${NC}"

ssh ${VPS_USER}@${VPS_IP} << 'REMOTE_SCRIPT'
    set -e
    
    # Navigate to project directory
    cd /var/www/sicata/backend || {
        echo "Backend directory not found. Creating..."
        mkdir -p /var/www/sicata/backend
        cd /var/www/sicata/backend
    }
    
    echo "[2/6] Pulling latest code..."
    git pull origin dev || {
        echo "Git pull failed. Please check your repository configuration."
        exit 1
    }
    
    echo "[3/6] Installing dependencies..."
    composer install --no-dev --optimize-autoloader --no-interaction
    
    echo "[4/6] Setting permissions..."
    chown -R www-data:www-data storage bootstrap/cache
    chmod -R 775 storage bootstrap/cache
    
    echo "[5/6] Clearing caches..."
    php artisan config:clear
    php artisan cache:clear
    php artisan route:clear
    php artisan view:clear
    
    echo "[6/6] Running migrations..."
    php artisan migrate --force
    
    echo ""
    echo "Optimizing application..."
    php artisan optimize
    
    echo ""
    echo "Restarting PHP-FPM..."
    systemctl restart php8.3-fpm
    systemctl reload nginx
    
REMOTE_SCRIPT

echo ""
echo -e "${GREEN}=========================================="
echo "Backend deployment complete!"
echo "=========================================="
echo ""
echo "Backend API is now running at: http://${VPS_IP}:8000"
echo ""
echo "To verify:"
echo "  curl http://${VPS_IP}:8000/api/health"
echo "==========================================${NC}"
