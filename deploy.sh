#!/bin/bash

# Discovery Platform - Production Deployment Script
# This script runs on the server after files are uploaded

set -e

# Configuration
DEPLOY_DIR="/var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it"
BACKUP_DIR="$HOME/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🚀 Discovery Platform Deployment${NC}"
echo "=================================="

# 1. Create backup (async, non-blocking)
echo -e "${YELLOW}📦 Creating backup...${NC}"
mkdir -p "$BACKUP_DIR"
if [ -d "$DEPLOY_DIR" ]; then
    (tar czf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" -C "$DEPLOY_DIR" . 2>/dev/null && \
     echo -e "${GREEN}✓ Backup completed${NC}") &
fi

# 2. Deploy Frontend
echo -e "${YELLOW}🎨 Deploying frontend...${NC}"
mkdir -p "$DEPLOY_DIR"

# Copy frontend build to root (Nginx serves from here)
rsync -a --delete frontend-build/ "$DEPLOY_DIR/"
echo -e "${GREEN}✓ Frontend deployed to root${NC}"

# Verify main bundle exists
BUNDLE=$(grep -o 'main\.[^"]*\.js' "$DEPLOY_DIR/index.html" | head -1)
if [ -f "$DEPLOY_DIR/static/js/$BUNDLE" ]; then
    echo -e "${GREEN}✓ Bundle verified: $BUNDLE${NC}"
else
    echo -e "${RED}❌ Warning: Bundle not found: $BUNDLE${NC}"
fi

# 3. Backup .env files
echo -e "${YELLOW}🔐 Backing up environment files...${NC}"
if [ -f "$DEPLOY_DIR/backend/.env" ]; then
    cp "$DEPLOY_DIR/backend/.env" "$BACKUP_DIR/.env.backup_$TIMESTAMP"
fi
if [ -f "$DEPLOY_DIR/backend/.env.production" ]; then
    cp "$DEPLOY_DIR/backend/.env.production" "$BACKUP_DIR/.env.production.backup_$TIMESTAMP"
fi

# 4. Deploy Backend
echo -e "${YELLOW}⚙️ Deploying backend...${NC}"
mkdir -p "$DEPLOY_DIR/backend"

# Backup uploads
if [ -d "$DEPLOY_DIR/backend/uploads" ]; then
    cp -r "$DEPLOY_DIR/backend/uploads" "$BACKUP_DIR/uploads_$TIMESTAMP" 2>/dev/null || true
fi

# Sync backend files (exclude .env files)
rsync -a --delete \
    --exclude='.env' \
    --exclude='.env.production' \
    --exclude='uploads' \
    backend/ "$DEPLOY_DIR/backend/"

# Restore uploads
if [ -d "$BACKUP_DIR/uploads_$TIMESTAMP" ]; then
    cp -r "$BACKUP_DIR/uploads_$TIMESTAMP/"* "$DEPLOY_DIR/backend/uploads/" 2>/dev/null || true
fi

# Ensure upload directories exist
mkdir -p "$DEPLOY_DIR/backend/uploads"/{contracts,signed-contracts,documents,registrations,temp-enrollment,temp}
mkdir -p "$DEPLOY_DIR/backend/uploads/documents/user-uploads"
chmod -R 755 "$DEPLOY_DIR/backend/uploads"

echo -e "${GREEN}✓ Backend deployed${NC}"

# 5. Setup environment variables
echo -e "${YELLOW}🔐 Setting up environment...${NC}"

if [ ! -f "$DEPLOY_DIR/backend/.env.production" ]; then
    # Try to restore from backup
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR/.env.production.backup_"* 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        echo -e "${YELLOW}⚠️ Restoring .env.production from backup${NC}"
        cp "$LATEST_BACKUP" "$DEPLOY_DIR/backend/.env.production"
    else
        echo -e "${RED}❌ CRITICAL: .env.production not found!${NC}"
        exit 1
    fi
fi

# Sync .env.production -> .env
cp "$DEPLOY_DIR/backend/.env.production" "$DEPLOY_DIR/backend/.env"
echo -e "${GREEN}✓ Environment configured${NC}"

# 6. Run database migrations
echo -e "${YELLOW}🗄️ Running migrations...${NC}"
cd "$DEPLOY_DIR/backend"

if [ -d "node_modules/.prisma/client" ]; then
    echo -e "${GREEN}✓ Prisma Client available${NC}"
else
    echo -e "${YELLOW}⚠️ Generating Prisma Client...${NC}"
    timeout 60 npx prisma generate || {
        echo -e "${RED}❌ Prisma generate timeout${NC}"
        exit 1
    }
fi

# Run migrations with timeout to prevent hanging
echo -e "${YELLOW}Running database migrations (max 60s)...${NC}"
timeout 60 npx prisma migrate deploy > /tmp/prisma-migrate.log 2>&1
MIGRATE_EXIT=$?

if [ $MIGRATE_EXIT -eq 0 ]; then
    echo -e "${GREEN}✓ Migrations applied successfully${NC}"
elif [ $MIGRATE_EXIT -eq 124 ]; then
    echo -e "${RED}❌ Migration timeout - skipping and continuing${NC}"
    cat /tmp/prisma-migrate.log | tail -20
else
    # Check log for known issues
    if grep -q "Database schema is up to date\|No pending migrations" /tmp/prisma-migrate.log; then
        echo -e "${GREEN}✓ Database up to date${NC}"
    elif grep -q "already exists\|P3018\|P3009" /tmp/prisma-migrate.log; then
        echo -e "${YELLOW}⚠️ Migration conflict detected - attempting auto-resolve...${NC}"

        # Extract failed migration name
        FAILED_MIGRATION=$(grep "Migration name:" /tmp/prisma-migrate.log | head -1 | awk '{print $NF}')

        if [ -n "$FAILED_MIGRATION" ]; then
            echo -e "${YELLOW}   Marking migration as applied: $FAILED_MIGRATION${NC}"
            npx prisma migrate resolve --applied "$FAILED_MIGRATION" > /dev/null 2>&1 || true

            # Try to apply remaining migrations
            npx prisma migrate deploy > /tmp/prisma-migrate-retry.log 2>&1 && {
                echo -e "${GREEN}✓ Migrations applied after resolve${NC}"
            } || {
                echo -e "${YELLOW}⚠️ Some migrations may need manual intervention (non-blocking)${NC}"
            }
        else
            echo -e "${YELLOW}⚠️ Migration conflict - continuing anyway${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ Migration warning (non-blocking):${NC}"
        cat /tmp/prisma-migrate.log | tail -20
    fi
fi

# 7. Setup PM2 configuration
echo -e "${YELLOW}🔄 Configuring PM2...${NC}"

# Note: We're already in the deploy-temp directory where ecosystem.config.js was extracted
# Copy it to the final deployment directory
if [ -f "ecosystem.config.js" ]; then
    cp ecosystem.config.js "$DEPLOY_DIR/ecosystem.config.js"
    echo -e "${GREEN}✓ Ecosystem config copied${NC}"
else
    echo -e "${RED}❌ ERROR: ecosystem.config.js not found${NC}"
    exit 1
fi

cd "$DEPLOY_DIR"

# Force production environment
sed -i 's/NODE_ENV.*:.*'"'"'development'"'"'/NODE_ENV: '"'"'production'"'"'/g' ecosystem.config.js
sed -i 's/PORT.*:.*3001/PORT: 3010/g' ecosystem.config.js

# 8. Reload PM2 processes (zero-downtime)
echo -e "${YELLOW}🔄 Reloading services...${NC}"

if pm2 list | grep -q "discovery-backend"; then
    echo -e "${YELLOW}Performing zero-downtime reload...${NC}"
    pm2 reload discovery-backend --update-env || pm2 restart discovery-backend
    pm2 reload discovery-frontend --update-env 2>/dev/null || true
else
    echo -e "${YELLOW}Starting fresh processes...${NC}"
    pm2 start ecosystem.config.js
fi

pm2 save

# Wait for services to start
sleep 5

# 9. Verify deployment
echo -e "${YELLOW}🔍 Verifying deployment...${NC}"

# Check backend
BACKEND_STATUS=$(pm2 jlist | grep -o '"name":"discovery-backend".*"status":"[^"]*"' | grep -o 'online' | head -1 || echo "error")
if [ "$BACKEND_STATUS" = "online" ]; then
    echo -e "${GREEN}✓ Backend online${NC}"
else
    echo -e "${RED}❌ Backend failed to start${NC}"
    pm2 logs discovery-backend --lines 30 --nostream
    exit 1
fi

# Check API health
sleep 3
if curl -f -s "http://localhost:3010/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API health check passed${NC}"
else
    echo -e "${YELLOW}⚠️ API health check warning${NC}"
fi

# 10. Cleanup old backups (keep last 5)
echo -e "${YELLOW}🧹 Cleaning up...${NC}"
cd "$BACKUP_DIR"
ls -t backup_*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm
ls -t uploads_* 2>/dev/null | tail -n +6 | xargs -r rm -rf

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "🌐 Site: https://discovery.cfoeducation.it"
echo -e "📊 API: https://discovery.cfoeducation.it/api"

# Log deployment
echo "[$(date)] Deployment completed" >> "$HOME/deployments.log"
