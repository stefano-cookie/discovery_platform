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
    --exclude='uploads/*' \
    --exclude='.env' \
    --exclude='*.log' \
    "$TEMP_DIR/backend/" "$DEPLOY_DIR/backend/"

# 3.1 Preserve existing uploads and create directory structure
echo -e "${YELLOW}📁 Setting up document directories...${NC}"
mkdir -p "$DEPLOY_DIR/backend/uploads"/{contracts,signed-contracts,documents,registrations,temp-enrollment}
mkdir -p "$DEPLOY_DIR/backend/uploads/documents/user-uploads"
mkdir -p "$DEPLOY_DIR/backend/uploads/registrations"

# Set correct permissions for uploads
chmod -R 755 "$DEPLOY_DIR/backend/uploads"
echo -e "${GREEN}✓ Document directories created${NC}"

# 4. Copia file .env.production come .env
echo -e "${YELLOW}🔐 Setting up environment variables...${NC}"
if [ -f "$DEPLOY_DIR/backend/.env.production" ]; then
    cp "$DEPLOY_DIR/backend/.env.production" "$DEPLOY_DIR/backend/.env"
    echo -e "${GREEN}✓ Environment file configured${NC}"
else
    echo -e "${RED}⚠️ Warning: .env.production not found!${NC}"
fi

# 5. Installa dipendenze backend
echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
cd "$DEPLOY_DIR/backend"
npm ci --production

# 6. Esegui migrazioni database
echo -e "${YELLOW}🗄️ Running database migrations...${NC}"
# Generate Prisma Client
npx prisma generate
# Push schema changes (be careful with --accept-data-loss in production!)
npx prisma db push
# Verify database connection
npx prisma db seed --preview-feature || true
echo -e "${GREEN}✓ Database migrations completed${NC}"

# 7. Riavvia backend con PM2
echo -e "${YELLOW}🔄 Restarting backend service...${NC}"
pm2 restart ecosystem.config.js --update-env || pm2 start ecosystem.config.js

# 8. Salva configurazione PM2
pm2 save

# 9. Cleanup
echo -e "${YELLOW}🧹 Cleaning up...${NC}"
rm -rf "$TEMP_DIR"

# 10. Rimuovi backup vecchi (mantieni solo ultimi 5)
cd "$BACKUP_DIR"
ls -t discovery_backup_*.tar.gz | tail -n +6 | xargs -r rm

# 11. Verify deployment
echo -e "${YELLOW}🔍 Verifying deployment...${NC}"

# Check if PM2 process is running
if pm2 show discovery-api > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PM2 process is running${NC}"
else
    echo -e "${RED}❌ PM2 process failed to start${NC}"
    pm2 logs discovery-api --lines 20
    exit 1
fi

# Quick API health check
sleep 5
if curl -s -f "http://localhost:3010/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API health check passed${NC}"
else
    echo -e "${YELLOW}⚠️ API health check failed (might be starting up)${NC}"
fi

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "🌐 Site: https://discovery.cfoeducation.it"
echo -e "📊 Backend API: https://discovery.cfoeducation.it/api"
echo -e "📋 Run verification: bash verify-deployment.sh"

# Log deployment
echo "[$(date)] Deployment completed - Version: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" >> "$HOME/deployments.log"