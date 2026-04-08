#!/bin/bash

# Wait for database to be ready
echo "Waiting for database connection..."
while ! php -r "try { new PDO('mysql:host=${DB_HOST};port=${DB_PORT};dbname=${DB_DATABASE}', '${DB_USERNAME}', '${DB_PASSWORD}'); echo 'Connected'; } catch (Exception \$e) { exit(1); }" 2>/dev/null; do
  sleep 1
done
echo "Database is ready!"

# Ensure proper permissions on the application directory
echo "Setting permissions..."
chown -R www-data:www-data /var/www/html
chmod -R 755 /var/www/html

# Ensure storage and cache directories are writable
mkdir -p /var/www/html/storage/framework/cache/data \
    /var/www/html/storage/framework/sessions \
    /var/www/html/storage/framework/views \
    /var/www/html/storage/logs \
    /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

# Create .env file if it doesn't exist
if [ ! -f /var/www/html/.env ]; then
    echo "Creating .env file..."
    cat > /var/www/html/.env <<EOF
APP_NAME=${APP_NAME}
APP_ENV=${APP_ENV}
APP_DEBUG=${APP_DEBUG}
APP_URL=${APP_URL}
APP_PORT=${APP_PORT}

LOG_CHANNEL=${LOG_CHANNEL}
LOG_LEVEL=${LOG_LEVEL}

DB_CONNECTION=${DB_CONNECTION}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_DATABASE=${DB_DATABASE}
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}

BROADCAST_DRIVER=${BROADCAST_DRIVER}
CACHE_DRIVER=${CACHE_DRIVER}
FILESYSTEM_DISK=${FILESYSTEM_DISK}
QUEUE_CONNECTION=${QUEUE_CONNECTION}
SESSION_DRIVER=${SESSION_DRIVER}
SESSION_LIFETIME=${SESSION_LIFETIME}

SANCTUM_STATEFUL_DOMAINS=${SANCTUM_STATEFUL_DOMAINS}
SESSION_DOMAIN=${SESSION_DOMAIN}
EOF
fi

# Ensure .env is readable/writable by www-data
chown www-data:www-data /var/www/html/.env
chmod 644 /var/www/html/.env

# Generate application key if not set
if ! grep -q "^APP_KEY=" /var/www/html/.env || grep -q "^APP_KEY=\s*$" /var/www/html/.env; then
    echo "Generating application key..."
    su -s /bin/bash www-data -c "php artisan key:generate --no-interaction" || true
fi

# Create storage link if it doesn't exist
if [ ! -L /var/www/html/public/storage ]; then
    echo "Creating storage link..."
    su -s /bin/bash www-data -c "php artisan storage:link" || true
fi

# Run migrations (continue even if migrations fail)
echo "Running migrations..."
su -s /bin/bash www-data -c "php artisan migrate --force --no-interaction" || echo "Warning: Some migrations failed, but continuing..."

# Clear and cache config
echo "Caching configuration..."
su -s /bin/bash www-data -c "php artisan config:cache" || true
su -s /bin/bash www-data -c "php artisan route:cache" || true
su -s /bin/bash www-data -c "php artisan view:cache" || true

# Update Apache to run as www-data
sed -i 's/^User .*/User www-data/' /etc/apache2/apache2.conf 2>/dev/null || true
sed -i 's/^Group .*/Group www-data/' /etc/apache2/apache2.conf 2>/dev/null || true

# Start Apache as root (it will drop privileges to www-data)
echo "Starting Apache..."
exec apache2-foreground
