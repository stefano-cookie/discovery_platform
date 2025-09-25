module.exports = {
  apps: [
    {
      name: 'discovery-backend',
      script: 'dist/server.js',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3010
      },
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log'
    },
    {
      name: 'discovery-frontend',
      script: 'frontend-proxy-server.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log'
    }
  ],

  deploy: {
    production: {
      user: 'node',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:username/discovery_platform.git',
      path: '/var/www/discovery_platform',
      'pre-deploy-local': '',
      'post-deploy': 'mkdir -p backend/uploads_backup && cp -r backend/uploads/* backend/uploads_backup/ 2>/dev/null || true && npm install && cd frontend && npm ci && npm run build && cd ../backend && npm ci && npm run build && npx prisma generate && mkdir -p uploads && cp -r uploads_backup/* uploads/ 2>/dev/null || true && rm -rf uploads_backup && cd .. && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};