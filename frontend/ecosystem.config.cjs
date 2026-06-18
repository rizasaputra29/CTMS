module.exports = {
  apps: [
    {
      name: 'sicata-frontend',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/sicata/frontend',
      instances: 1,
      autorefront: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Environment variables must be available at BUILD TIME
        // Update these values when deploying to different environments
        NEXT_PUBLIC_APP_NAME: 'SICATA',
        NEXT_PUBLIC_APP_URL: 'https://148.230.99.31:3000',
        NEXT_PUBLIC_API_URL: 'https://148.230.99.31:8000/api',
        NEXT_PUBLIC_BACKEND_URL: 'https://148.230.99.31:8000',
        NEXT_PUBLIC_AUTH_COOKIE_NAME: 'sicata_session',
        NEXT_PUBLIC_ENABLE_MOCK_API: 'false',
        NEXT_PUBLIC_DEBUG: 'false',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_PUBLIC_APP_NAME: 'SICATA',
        NEXT_PUBLIC_APP_URL: 'https://148.230.99.31:3000',
        NEXT_PUBLIC_API_URL: 'https://148.230.99.31:8000/api',
        NEXT_PUBLIC_BACKEND_URL: 'https://148.230.99.31:8000',
        NEXT_PUBLIC_AUTH_COOKIE_NAME: 'sicata_session',
        NEXT_PUBLIC_ENABLE_MOCK_API: 'false',
        NEXT_PUBLIC_DEBUG: 'false',
      },
      error_file: '/var/log/pm2/sicata-frontend-error.log',
      out_file: '/var/log/pm2/sicata-frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
