#!/bin/bash

# =============================================================================
# SICATA VPS Initial Setup Script
# Run this once on a fresh Ubuntu 24.04 VPS
# =============================================================================

set -e  # Exit on error

echo "=========================================="
echo "SICATA VPS Initial Setup"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# IP Address Configuration
VPS_IP="148.230.99.31"

# Step 1: Update system
echo -e "${YELLOW}[1/12] Updating system packages...${NC}"
apt update && apt upgrade -y

# Step 2: Install essential packages
echo -e "${YELLOW}[2/12] Installing essential packages...${NC}"
apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Step 3: Install PHP 8.3
echo -e "${YELLOW}[3/12] Installing PHP 8.3...${NC}"
add-apt-repository -y ppa:ondrej/php
apt update
apt install -y php8.3 php8.3-fpm php8.3-pgsql php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip php8.3-bcmath php8.3-tokenizer php8.3-fileinfo php8.3-dom php8.3-intl php8.3-gd

# Step 4: Install Composer
echo -e "${YELLOW}[4/12] Installing Composer...${NC}"
curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer

# Step 5: Install Node.js 18+ and npm
echo -e "${YELLOW}[5/12] Installing Node.js 18...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Step 6: Install PM2 globally
echo -e "${YELLOW}[6/12] Installing PM2...${NC}"
npm install -g pm2

# Step 7: Install Nginx (if not already installed)
echo -e "${YELLOW}[7/12] Configuring Nginx...${NC}"
apt install -y nginx
systemctl enable nginx
systemctl start nginx

# Step 8: Install Certbot for SSL
echo -e "${YELLOW}[8/12] Installing Certbot...${NC}"
apt install -y certbot python3-certbot-nginx

# Step 9: Create project directory
echo -e "${YELLOW}[9/12] Creating project directory...${NC}"
mkdir -p /var/www/sicata
chown -R root:root /var/www/sicata

# Step 10: Configure firewall
echo -e "${YELLOW}[10/12] Configuring firewall...${NC}"
apt install -y ufw
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw allow 8000/tcp
echo "y" | ufw enable

# Step 11: Create log directory for PM2
echo -e "${YELLOW}[11/12] Creating log directories...${NC}"
mkdir -p /var/log/pm2
chown -R root:root /var/log/pm2

# Step 12: Verify installation
echo -e "${YELLOW}[12/12] Verifying installation...${NC}"
echo ""
echo -e "${GREEN}Installation Summary:${NC}"
echo "========================"
php --version
echo ""
node --version
echo ""
npm --version
echo ""
nginx -v
echo ""
composer --version
echo ""
pm2 --version
echo ""

echo ""
echo -e "${GREEN}=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Clone your repository: cd /var/www/sicata && git clone <repo-url> ."
echo "2. Run the backend deployment: bash deploy/deploy-backend.sh"
echo "3. Run the frontend deployment: bash deploy/deploy-frontend.sh"
echo "4. Configure SSL: bash deploy/ssl-setup.sh"
echo ""
echo "Access URLs:"
echo "- Frontend: http://${VPS_IP}:3000"
echo "- Backend API: http://${VPS_IP}:8000"
echo "=========================================="
