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
      env_file: './backend/.env',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3010,
        // Cloudflare R2 Configuration
        CLOUDFLARE_ACCOUNT_ID: '96e7e20557789c11d012aca51dc21a27',
        CLOUDFLARE_ACCESS_KEY_ID: 'd023a41ae650f8d50a9b6fae8d5fca4b',
        CLOUDFLARE_SECRET_ACCESS_KEY: '4f06ca6eb449c17ccffbda239a3e5a3f4f1ea9390a257b964bff0c9f4e763760',
        CLOUDFLARE_BUCKET_NAME: 'discovery-documents-prod',
        CLOUDFLARE_ENDPOINT: 'https://96e7e20557789c11d012aca51dc21a27.r2.cloudflarestorage.com'
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
      'post-deploy': 'mkdir -p /tmp/uploads_backup && cp -r backend/uploads/* /tmp/uploads_backup/ 2>/dev/null || true && npm install && cd frontend && npm ci && npm run build && cd ../backend && npm ci && npm run build && npx prisma generate && mkdir -p uploads && mkdir -p dist/uploads && cp -r /tmp/uploads_backup/* uploads/ 2>/dev/null || true && cp -r /tmp/uploads_backup/* dist/uploads/ 2>/dev/null || true && rm -rf /tmp/uploads_backup && cd .. && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};