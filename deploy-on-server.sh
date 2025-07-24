#!/bin/bash

# Script di deploy eseguito sul server
# Questo script viene chiamato da GitHub Actions dopo il caricamento dei file

set -e

# Configurazione
DEPLOY_DIR="/var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it"
TEMP_DIR="$HOME/discovery_platform_temp"
BACKUP_DIR="$HOME/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colori per output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🚀 Starting deployment...${NC}"

# 1. Crea backup del deployment attuale
echo -e "${YELLOW}📦 Creating backup...${NC}"
mkdir -p "$BACKUP_DIR"
if [ -d "$DEPLOY_DIR" ]; then
    tar czf "$BACKUP_DIR/discovery_backup_$TIMESTAMP.tar.gz" -C "$DEPLOY_DIR" .
    echo -e "${GREEN}✓ Backup created: discovery_backup_$TIMESTAMP.tar.gz${NC}"
fi

# 2. Deploy Frontend
echo -e "${YELLOW}🎨 Deploying frontend...${NC}"
rsync -av --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='*.log' \
    "$TEMP_DIR/frontend/build/" "$DEPLOY_DIR/"

# 3. Deploy Backend
echo -e "${YELLOW}⚙️ Deploying backend...${NC}"
mkdir -p "$DEPLOY_DIR/backend"
rsync -av \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='uploads' \
    --exclude='.env' \
    --exclude='*.log' \
    "$TEMP_DIR/backend/" "$DEPLOY_DIR/backend/"

# 4. Installa dipendenze backend
echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
cd "$DEPLOY_DIR/backend"
npm ci --production

# 5. Esegui migrazioni database
echo -e "${YELLOW}🗄️ Running database migrations...${NC}"
npx prisma migrate deploy

# 6. Riavvia backend con PM2
echo -e "${YELLOW}🔄 Restarting backend service...${NC}"
pm2 restart ecosystem.config.js --update-env || pm2 start ecosystem.config.js

# 7. Salva configurazione PM2
pm2 save

# 8. Cleanup
echo -e "${YELLOW}🧹 Cleaning up...${NC}"
rm -rf "$TEMP_DIR"

# 9. Rimuovi backup vecchi (mantieni solo ultimi 5)
cd "$BACKUP_DIR"
ls -t discovery_backup_*.tar.gz | tail -n +6 | xargs -r rm

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "🌐 Site: https://discovery.cfoeducation.it"
echo -e "📊 Backend API: https://discovery.cfoeducation.it/api"

# Log deployment
echo "[$(date)] Deployment completed - Version: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" >> "$HOME/deployments.log"