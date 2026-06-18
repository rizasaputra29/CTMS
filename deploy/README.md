# SICATA Deployment Guide

## 📋 Overview

This guide covers deploying the SICATA application to a VPS with IP-based access.

| Component | URL | Port |
|-----------|-----|------|
| Frontend (Next.js) | http://148.230.99.31:3000 | 3000 |
| Backend API (Laravel) | http://148.230.99.31:8000 | 8000 |

---

## 🚀 Quick Start

### First-Time VPS Setup

```bash
# Connect to your VPS
ssh root@148.230.99.31

# Download and run the setup script
bash deploy/vps-setup.sh
```

### Deploy Application

```bash
# From your local machine, in the project root
bash deploy/deploy-all.sh
```

### Setup SSL (Optional)

```bash
# On VPS
bash deploy/ssl-setup.sh
```

---

## 📁 Project Structure

```
/var/www/sicata/
├── backend/              # Laravel application
│   ├── .env             # Environment configuration
│   ├── config/          # Configuration files
│   ├── routes/          # API routes
│   └── ...
├── frontend/             # Next.js application
│   ├── .env.local       # Environment configuration
│   ├── ecosystem.config.js  # PM2 configuration
│   └── ...
└── deploy/               # Deployment scripts
    ├── vps-setup.sh     # VPS initial setup
    ├── deploy-backend.sh
    ├── deploy-frontend.sh
    ├── deploy-all.sh
    └── ssl-setup.sh
```

---

## 🔧 Configuration Changes Made

### Backend (.env)

```ini
# Changed from domain-based to IP-based
APP_URL=http://148.230.99.31:8000
FRONTEND_URL=http://148.230.99.31:3000

# Sanctum stateful domains
SANCTUM_STATEFUL_DOMAINS=148.230.99.31,148.230.99.31:3000,148.230.99.31:8000

# Session domain
SESSION_DOMAIN=148.230.99.31
SESSION_SECURE_COOKIE=false

# CORS origins
CORS_ALLOWED_ORIGINS=http://148.230.99.31:3000
```

### Backend (config/sanctum.php)

```php
// Removed hardcoded domains, now uses env variable
'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', sprintf(
    '%s,%s',
    'localhost,localhost:3000,127.0.0.1,127.0.0.1:8000,127.0.0.1:3000',
    Sanctum::currentApplicationUrlWithPort(),
))),
```

### Backend (bootstrap/app.php)

```php
// Added statefulApi() middleware - CRITICAL for fixing 401 errors
->withMiddleware(function (Middleware $middleware) {
    $middleware->prepend(\Illuminate\Http\Middleware\HandleCors::class);
    $middleware->prepend(\App\Http\Middleware\AssignRequestId::class);
    $middleware->statefulApi(); // ← This fixes the 401 Unauthorized
    // ...
})
```

### Frontend (src/lib/api.ts)

```typescript
// Added withXSRFToken - CRITICAL for Sanctum CSRF protection
const api = axios.create({
  baseURL: getApiUrl(),
  withCredentials: true,
  withXSRFToken: true, // ← This fixes the 401 Unauthorized
});
```

### Frontend (.env.local)

```ini
# Changed to IP-based
NEXT_PUBLIC_API_URL="http://148.230.99.31:8000/api"
NEXT_PUBLIC_BACKEND_URL="http://148.230.99.31:8000"
```

---

## 🛠️ Manual Deployment Steps

### 1. Connect to VPS

```bash
ssh root@148.230.99.31
```

### 2. Install Dependencies (First Time Only)

```bash
# PHP 8.3
apt update
apt install -y php8.3 php8.3-fpm php8.3-pgsql php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip

# Composer
curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer

# Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# PM2
npm install -g pm2

# Nginx
apt install -y nginx
```

### 3. Clone Repository

```bash
cd /var/www
git clone <your-repo-url> sicata
cd sicata
```

### 4. Deploy Backend

```bash
cd backend
composer install --no-dev --optimize-autoloader
cp .env.example .env
# Edit .env with your configuration
php artisan key:generate
php artisan migrate --force
php artisan config:clear
php artisan cache:clear
```

### 5. Deploy Frontend

```bash
cd ../frontend
npm ci
npm run build
pm2 start ecosystem.config.js --env production
pm2 save
```

### 6. Configure Nginx

```bash
cp deploy/nginx-sicata.conf /etc/nginx/sites-available/sicata
ln -s /etc/nginx/sites-available/sicata /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

---

## 🔍 Troubleshooting

### 401 Unauthorized Error

**Symptom**: API requests return 401 "Unauthenticated"

**Causes & Fixes**:

1. **Missing `statefulApi()` middleware**
   ```bash
   # Check bootstrap/app.php has:
   $middleware->statefulApi();
   ```

2. **Missing `withXSRFToken` in frontend**
   ```typescript
   // Check frontend/src/lib/api.ts has:
   withXSRFToken: true,
   ```

3. **Wrong Sanctum stateful domains**
   ```bash
   # Check .env has:
   SANCTUM_STATEFUL_DOMAINS=148.230.99.31,148.230.99.31:3000,148.230.99.31:8000
   ```

4. **Config cache not cleared**
   ```bash
   php artisan config:clear
   php artisan cache:clear
   ```

### CORS Errors

**Symptom**: Browser console shows CORS errors

**Fix**:

1. Check `CORS_ALLOWED_ORIGINS` in `.env`
2. Verify `supports_credentials: true` in `config/cors.php`
3. Ensure frontend uses `withCredentials: true`

### Session/Cookie Issues

**Symptom**: Cookies not being sent or received

**Fix**:

1. Verify `SESSION_DOMAIN` matches (no protocol, no port)
2. Check `SESSION_SECURE_COOKIE=false` for HTTP
3. Ensure browser allows cookies for the IP address

### PHP-FPM Not Running

```bash
systemctl status php8.3-fpm
systemctl start php8.3-fpm
systemctl enable php8.3-fpm
```

### Nginx Not Starting

```bash
nginx -t  # Check for syntax errors
systemctl status nginx
systemctl restart nginx
```

### PM2 Process Not Running

```bash
pm2 status
pm2 logs sicata-frontend
pm2 restart sicata-frontend
```

---

## 🔄 Switching Between Local and Production

### Local Development

1. **Backend `.env`**:
   ```ini
   APP_URL=http://127.0.0.1:8000
   FRONTEND_URL=http://127.0.0.1:3000
   SANCTUM_STATEFUL_DOMAINS=localhost,localhost:3000,127.0.0.1,127.0.0.1:8000,127.0.0.1:3000
   SESSION_DOMAIN=127.0.0.1
   SESSION_SECURE_COOKIE=false
   CORS_ALLOWED_ORIGINS=http://127.0.0.1:3000,http://localhost:3000
   ```

2. **Frontend `.env.local`**:
   ```ini
   NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
   NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
   ```

3. Clear cache:
   ```bash
   php artisan config:clear
   ```

### Production (VPS)

1. **Backend `.env`** (current settings):
   ```ini
   APP_URL=http://148.230.99.31:8000
   FRONTEND_URL=http://148.230.99.31:3000
   SANCTUM_STATEFUL_DOMAINS=148.230.99.31,148.230.99.31:3000,148.230.99.31:8000
   SESSION_DOMAIN=148.230.99.31
   SESSION_SECURE_COOKIE=false
   CORS_ALLOWED_ORIGINS=http://148.230.99.31:3000
   ```

2. **Frontend `.env.local`** (current settings):
   ```ini
   NEXT_PUBLIC_API_URL=http://148.230.99.31:8000/api
   NEXT_PUBLIC_BACKEND_URL=http://148.230.99.31:8000
   ```

---

## 📝 File Checklist

| File | Status | Purpose |
|------|--------|---------|
| `backend/.env` | ✅ Updated | IP-based environment config |
| `backend/config/sanctum.php` | ✅ Updated | Removed hardcoded domains |
| `backend/config/cors.php` | ✅ Updated | Uses env for origins |
| `backend/bootstrap/app.php` | ✅ Updated | Added `statefulApi()` |
| `frontend/src/lib/api.ts` | ✅ Updated | Added `withXSRFToken` |
| `frontend/.env.local` | ✅ Updated | IP-based API URL |
| `frontend/ecosystem.config.js` | ✅ Created | PM2 process config |
| `deploy/vps-setup.sh` | ✅ Created | VPS initial setup |
| `deploy/nginx-sicata.conf` | ✅ Created | Nginx reverse proxy |
| `deploy/deploy-backend.sh` | ✅ Created | Backend deployment |
| `deploy/deploy-frontend.sh` | ✅ Created | Frontend deployment |
| `deploy/deploy-all.sh` | ✅ Created | Full deployment |
| `deploy/ssl-setup.sh` | ✅ Created | SSL certificate setup |
| `deploy/README.md` | ✅ Created | This documentation |

---

## 🎯 Key Fixes Applied

### Fix 1: Sanctum Stateful Domains

**Problem**: Sanctum didn't recognize IP-based requests as "stateful"

**Solution**: Updated `SANCTUM_STATEFUL_DOMAINS` to include IP with ports

```ini
SANCTUM_STATEFUL_DOMAINS=148.230.99.31,148.230.99.31:3000,148.230.99.31:8000
```

### Fix 2: Stateful API Middleware

**Problem**: Missing middleware to handle SPA authentication

**Solution**: Added `statefulApi()` in `bootstrap/app.php`

```php
$middleware->statefulApi();
```

### Fix 3: CSRF Token Header

**Problem**: Frontend not sending XSRF token with requests

**Solution**: Added `withXSRFToken: true` in axios config

```typescript
withXSRFToken: true,
```

### Fix 4: CORS Origins

**Problem**: CORS configured for domain, not IP

**Solution**: Updated to use environment variable

```ini
CORS_ALLOWED_ORIGINS=http://148.230.99.31:3000
```

---

## 📞 Support

If you encounter issues:

1. Check the logs:
   ```bash
   # Backend
   tail -f /var/log/nginx/sicata-error.log
   tail -f /var/log/php8.3-fpm.log
   
   # Frontend
   pm2 logs sicata-frontend
   ```

2. Verify services are running:
   ```bash
   systemctl status nginx
   systemctl status php8.3-fpm
   pm2 status
   ```

3. Test API:
   ```bash
   curl http://148.230.99.31:8000/api/health
   ```

---

**Last Updated**: June 18, 2026
