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
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/pm2/sicata-frontend-error.log',
      out_file: '/var/log/pm2/sicata-frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
