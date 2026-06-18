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

echo -e "${YELLOW}[1/8] Connecting to VPS and deploying...${NC}"

ssh ${VPS_USER}@${VPS_IP} << 'REMOTE_SCRIPT'
    set -e
    
    # Navigate to project directory
    cd /var/www/sicata/backend || {
        echo "Backend directory not found. Creating..."
        mkdir -p /var/www/sicata/backend
        cd /var/www/sicata/backend
    }
    
    echo "[2/8] Pulling latest code..."
    git pull origin dev || {
        echo "Git pull failed. Please check your repository configuration."
        exit 1
    }
    
    echo "[3/8] Creating .env file..."
    # Create .env for HTTPS (nginx handles SSL, backend runs HTTP internally)
    cat > /var/www/sicata/backend/.env << 'ENVFILE'
APP_NAME=SICATA
APP_ENV=production
APP_KEY=base64:FNTDeAJlnVNJ7pp0u19DP5pWvEPxdiev5nxi3L93C4Y=
APP_DEBUG=false
APP_URL=https://148.230.99.31

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

APP_MAINTENANCE_DRIVER=file

BCRYPT_ROUNDS=12

LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=debug

DB_CONNECTION=pgsql
DB_HOST=ep-dawn-hall-a16jx8v9-pooler.ap-southeast-1.aws.neon.tech
DB_PORT=5432
DB_DATABASE=neondb
DB_USERNAME=neondb_owner
DB_PASSWORD=npg_3LXrd6bNHFAB
DB_SSLMODE=require

DB_PERSISTENT=true
DB_CONNECT_TIMEOUT=10
DB_STATEMENT_TIMEOUT=30
DB_POOL_MIN=1
DB_POOL_MAX=5

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_SECURE_COOKIE=true
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=none
SESSION_DOMAIN=148.230.99.31

SANCTUM_STATEFUL_DOMAINS=148.230.99.31
SANCTUM_TOKEN_PREFIX=prod_

CORS_ALLOWED_ORIGINS=https://148.230.99.31

FRONTEND_URL=https://148.230.99.31

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=database

CACHE_STORE=database

MEMCACHED_HOST=127.0.0.1

REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

MAIL_MAILER=log
MAIL_SCHEME=null
MAIL_HOST=127.0.0.1
MAIL_PORT=2525
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_FROM_ADDRESS="hello@example.com"
MAIL_FROM_NAME="${APP_NAME}"

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_USE_PATH_STYLE_ENDPOINT=false

VITE_APP_NAME="${APP_NAME}"
ENVFILE

    echo "[4/8] Installing dependencies..."
    composer install --no-dev --optimize-autoloader --no-interaction
    
    echo "[5/8] Setting permissions..."
    chown -R www-data:www-data storage bootstrap/cache
    chmod -R 775 storage bootstrap/cache
    
    echo "[6/8] Clearing caches..."
    php artisan config:clear
    php artisan cache:clear
    php artisan route:clear
    php artisan view:clear
    
    echo "[7/8] Running migrations..."
    php artisan migrate --force
    
    echo ""
    echo "Optimizing application..."
    php artisan optimize
    
    echo ""
    echo "[8/8] Restarting PHP-FPM..."
    systemctl restart php8.3-fpm
    systemctl reload nginx
    
REMOTE_SCRIPT

echo ""
echo -e "${GREEN}=========================================="
echo "Backend deployment complete!"
echo "=========================================="
echo ""
echo "Backend API is now available at: https://${VPS_IP}/api"
echo ""
echo "To verify:"
echo "  curl -k https://${VPS_IP}/api/health"
echo "==========================================${NC}"
