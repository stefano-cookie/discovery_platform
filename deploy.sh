#!/bin/bash

# Deploy script per discovery.cfoeducation.it
# Uso: ./deploy.sh [produzione|staging]

set -e

# Configurazione
ENVIRONMENT=${1:-produzione}
SERVER_USER="cfoeducation.it_f55qsn6wucc"
SERVER_HOST="cfoeducation.it"
SERVER_PATH="/var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it"
PM2_APP_NAME="discovery-backend"

echo "🚀 Inizio deployment per ambiente: $ENVIRONMENT"

# 1. Build Frontend
echo "📦 Building frontend..."
cd frontend
npm run build

# 2. Build Backend
echo "📦 Building backend..."
cd ../backend
npm run build

# 3. Crea archivio deployment
echo "📦 Creazione archivio deployment..."
cd ..
tar -czf deployment.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='uploads/*' \
  --exclude='*.env' \
  --exclude='*.env.local' \
  --exclude='deployment.tar.gz' \
  backend/dist \
  backend/package*.json \
  backend/prisma \
  frontend/build \
  frontend/package*.json

# 4. Upload su server
echo "📤 Upload su server..."
scp deployment.tar.gz $SERVER_USER@$SERVER_HOST:$SERVER_PATH/

# 5. Esegui comandi remoti
echo "🔧 Configurazione server..."
ssh $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd $SERVER_PATH

# Backup precedente
if [ -d "backend_backup" ]; then
  rm -rf backend_backup.old
  mv backend_backup backend_backup.old
fi
if [ -d "frontend_backup" ]; then
  rm -rf frontend_backup.old
  mv frontend_backup frontend_backup.old
fi

# Backup attuale
cp -r backend backend_backup
cp -r frontend frontend_backup

# Estrai nuovo deployment
tar -xzf deployment.tar.gz

# Installa dipendenze backend
cd backend
npm ci --production
npx prisma generate

# Migra database (solo se necessario)
# npx prisma migrate deploy

# Riavvia backend con PM2
pm2 restart $PM2_APP_NAME || pm2 start dist/server.js --name $PM2_APP_NAME

# Torna alla root
cd ..

# Frontend è servito staticamente, nessun restart necessario

# Cleanup
rm deployment.tar.gz

echo "✅ Deployment completato!"
ENDSSH

# 6. Cleanup locale
rm -f deployment.tar.gz

echo "✅ Deployment completato con successo!"
echo "🌐 Sito live: https://discovery.cfoeducation.it"