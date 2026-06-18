#!/bin/bash

# =============================================================================
# SICATA SSL Setup Script (Let's Encrypt)
# Run this AFTER the main deployment is working
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

# IP Address (for self-signed cert since Let's Encrypt doesn't support bare IPs)
VPS_IP="148.230.99.31"

echo -e "${YELLOW}[1/4] Checking Certbot installation...${NC}"
if ! command -v certbot &> /dev/null; then
    echo "Certbot not found. Installing..."
    apt update
    apt install -y certbot python3-certbot-nginx
fi

echo -e "${YELLOW}[2/4] Note: Let's Encrypt does not support bare IP addresses.${NC}"
echo -e "${YELLOW}       For IP-based HTTPS, we'll create a self-signed certificate.${NC}"
echo -e "${YELLOW}       For production, use a domain name instead.${NC}"
echo ""

echo -e "${YELLOW}[3/4] Creating self-signed certificate...${NC}"
mkdir -p /etc/ssl/sicata

# Create self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/sicata/privkey.pem \
    -out /etc/ssl/sicata/fullchain.pem \
    -subj "/C=ID/ST=JawaTengah/L=Semarang/O=SICATA/CN=${VPS_IP}"

echo -e "${YELLOW}[4/4] Updating Nginx configuration...${NC}"

# Update nginx config with SSL
cat > /etc/nginx/sites-available/sicata << 'NGINX_SSL'
server {
    listen 80;
    listen [::]:80;
    server_name 148.230.99.31;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name 148.230.99.31;
    
    root /var/www/sicata/backend/public;
    index index.php;

    # SSL Configuration (Self-signed)
    ssl_certificate /etc/ssl/sicata/fullchain.pem;
    ssl_certificate_key /etc/ssl/sicata/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # CORS headers
    add_header 'Access-Control-Allow-Origin' 'https://148.230.99.31:3000' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'DNT,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization' always;

    # Logging
    access_log /var/log/nginx/sicata-access.log;
    error_log /var/log/nginx/sicata-error.log;

    # Max upload size
    client_max_body_size 64M;

    # Frontend routes (Next.js)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API routes
    location /api/ {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # Sanctum CSRF cookie endpoint
    location /sanctum/ {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # PHP handling
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_hide_header X-Powered-By;
        fastcgi_buffers 16 16k;
        fastcgi_buffer_size 32k;
    }

    # Deny hidden files
    location ~ /\.(?!well-known).* {
        deny all;
    }

    # Deny sensitive files
    location ~* (composer\.json|composer\.lock|\.env|\.env\.example|webpack\.mix\.js|vite\.config\.) {
        deny all;
    }
}
NGINX_SSL

# Test and reload nginx
nginx -t
systemctl reload nginx

echo ""
echo -e "${GREEN}=========================================="
echo "SSL Setup Complete!"
echo "=========================================="
echo ""
echo "Your application is now available at:"
echo "  Frontend: https://${VPS_IP}:3000"
echo "  Backend:  https://${VPS_IP}:8000"
echo ""
echo "Note: You may see a security warning because"
echo "we're using a self-signed certificate."
echo "For production, use a domain name with Let's Encrypt."
echo "==========================================${NC}"
