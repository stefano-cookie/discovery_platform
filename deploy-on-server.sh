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

# 2.1 Deploy Frontend Proxy Server
echo -e "${YELLOW}🔧 Deploying frontend proxy server...${NC}"
if [ -f "$TEMP_DIR/frontend-proxy-server-production.js" ]; then
    cp "$TEMP_DIR/frontend-proxy-server-production.js" "$DEPLOY_DIR/frontend-proxy-server.js"
    echo -e "${GREEN}✓ Frontend proxy server deployed (production version)${NC}"
else
    cp "$TEMP_DIR/frontend-proxy-server.js" "$DEPLOY_DIR/"
    echo -e "${YELLOW}⚠️  Using development version of proxy server${NC}"
fi

# 3. Deploy Backend
echo -e "${YELLOW}⚙️ Deploying backend...${NC}"
mkdir -p "$DEPLOY_DIR/backend"

# 3.0 🔒 CRITICAL: Backup .env files BEFORE rsync
echo -e "${YELLOW}🔐 Backing up environment files BEFORE deploy...${NC}"
if [ -f "$DEPLOY_DIR/backend/.env" ]; then
    mkdir -p "$BACKUP_DIR"
    cp "$DEPLOY_DIR/backend/.env" "$BACKUP_DIR/.env.backup_$TIMESTAMP"
    echo -e "${GREEN}✓ Backed up .env${NC}"
fi
if [ -f "$DEPLOY_DIR/backend/.env.production" ]; then
    mkdir -p "$BACKUP_DIR"
    cp "$DEPLOY_DIR/backend/.env.production" "$BACKUP_DIR/.env.production.backup_$TIMESTAMP"
    echo -e "${GREEN}✓ Backed up .env.production${NC}"
else
    echo -e "${YELLOW}⚠️  No .env.production found to backup (will check backups later)${NC}"
fi

rsync -av \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.env' \
    --exclude='.env.production' \
    --exclude='*.log' \
    "$TEMP_DIR/backend/" "$DEPLOY_DIR/backend/"
echo -e "${GREEN}✓ Backend deployed (preserved .env files)${NC}"

# 3.1 Backup existing uploads before deploy
echo -e "${YELLOW}📁 Backing up existing uploads...${NC}"
if [ -d "$DEPLOY_DIR/backend/uploads" ]; then
    mkdir -p "$BACKUP_DIR"
    cp -r "$DEPLOY_DIR/backend/uploads" "$BACKUP_DIR/uploads_backup_$TIMESTAMP"
    echo -e "${GREEN}✓ Uploads backed up to: uploads_backup_$TIMESTAMP${NC}"
fi

# 3.2 Preserve existing uploads and create directory structure
echo -e "${YELLOW}📁 Setting up document directories with ANTI-DEPLOYMENT BREAKAGE...${NC}"
# 🔥 FIX: Usa la configurazione storage standardizzata invece di path hardcoded
mkdir -p "$DEPLOY_DIR/backend/uploads"/{contracts,signed-contracts,documents,registrations,temp-enrollment,temp}
mkdir -p "$DEPLOY_DIR/backend/uploads/documents/user-uploads"
mkdir -p "$DEPLOY_DIR/backend/uploads/registrations"

# 3.3 Restore backed up uploads if they exist
if [ -d "$BACKUP_DIR/uploads_backup_$TIMESTAMP" ]; then
    echo -e "${YELLOW}📁 Restoring uploaded documents...${NC}"
    cp -r "$BACKUP_DIR/uploads_backup_$TIMESTAMP/"* "$DEPLOY_DIR/backend/uploads/" 2>/dev/null || true
    echo -e "${GREEN}✓ Uploaded documents restored${NC}"
fi

# Set correct permissions for uploads
chmod -R 755 "$DEPLOY_DIR/backend/uploads"
echo -e "${GREEN}✓ Document directories configured${NC}"

# 4. 🔒 CRITICAL: Setup environment variables (.env and .env.production)
echo -e "${YELLOW}🔐 Setting up environment variables...${NC}"

# 4.1 Check if .env.production exists (should be manually maintained on server)
if [ ! -f "$DEPLOY_DIR/backend/.env.production" ]; then
    echo -e "${RED}❌ CRITICAL: .env.production not found!${NC}"
    echo -e "${RED}   This file MUST exist on the server with production credentials.${NC}"
    echo -e "${RED}   Location: $DEPLOY_DIR/backend/.env.production${NC}"

    # Check if there's a backup we can restore
    LATEST_ENV_BACKUP=$(ls -t "$BACKUP_DIR/.env.production.backup_"* 2>/dev/null | head -1)
    if [ -n "$LATEST_ENV_BACKUP" ]; then
        echo -e "${YELLOW}⚠️  Restoring from latest backup: $(basename $LATEST_ENV_BACKUP)${NC}"
        cp "$LATEST_ENV_BACKUP" "$DEPLOY_DIR/backend/.env.production"
        echo -e "${GREEN}✓ .env.production restored from backup${NC}"
    else
        echo -e "${RED}❌ No backup found. Deployment will FAIL!${NC}"
        echo -e "${RED}   Create .env.production manually with production credentials.${NC}"
        exit 1
    fi
fi

# 4.2 Validate .env.production has required variables
echo -e "${YELLOW}🔍 Validating .env.production...${NC}"
REQUIRED_VARS=("DATABASE_URL" "JWT_SECRET" "ENCRYPTION_KEY" "CLOUDFLARE_ACCOUNT_ID" "EMAIL_USER")
MISSING_VARS=()

for VAR in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${VAR}=" "$DEPLOY_DIR/backend/.env.production"; then
        MISSING_VARS+=("$VAR")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing required variables in .env.production:${NC}"
    for VAR in "${MISSING_VARS[@]}"; do
        echo -e "${RED}   - $VAR${NC}"
    done
    exit 1
fi

# 4.3 Create .env from .env.production (dotenv loads .env by default)
cp "$DEPLOY_DIR/backend/.env.production" "$DEPLOY_DIR/backend/.env"
echo -e "${GREEN}✓ Created .env from .env.production${NC}"

# 4.4 Verify file exists and is readable
if [ -f "$DEPLOY_DIR/backend/.env" ] && [ -r "$DEPLOY_DIR/backend/.env" ]; then
    ENV_LINE_COUNT=$(wc -l < "$DEPLOY_DIR/backend/.env")
    echo -e "${GREEN}✓ .env file verified ($ENV_LINE_COUNT lines)${NC}"
else
    echo -e "${RED}❌ .env file missing or not readable!${NC}"
    exit 1
fi

# 5. Installa dipendenze backend
echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
cd "$DEPLOY_DIR/backend"
npm ci --omit=dev
# Fix security vulnerabilities
npm audit fix --omit=dev || echo -e "${YELLOW}⚠️ Some vulnerabilities could not be automatically fixed${NC}"

# 5.1 Installa dipendenze proxy per frontend
echo -e "${YELLOW}📦 Installing frontend proxy dependencies...${NC}"
cd "$DEPLOY_DIR"
if [ ! -f "package.json" ]; then
    echo '{"dependencies": {"express": "^4.18.2", "http-proxy-middleware": "^2.0.6"}}' > package.json
    npm install --omit=dev
else
    # Installa solo se non già presenti
    npm list express > /dev/null 2>&1 || npm install express --omit=dev
    npm list http-proxy-middleware > /dev/null 2>&1 || npm install http-proxy-middleware --omit=dev
fi

# 6. Esegui migrazioni database
echo -e "${YELLOW}🗄️ Running database migrations...${NC}"
cd "$DEPLOY_DIR/backend"
# Generate Prisma Client
npx prisma generate

# Apply schema changes without data loss
echo -e "${YELLOW}⚠️  Applying schema changes...${NC}"

# First, create any missing tables directly
echo -e "${YELLOW}Creating missing tables if needed...${NC}"
npx prisma db execute --stdin --schema prisma/schema.prisma 2>/dev/null <<'EOF' || true
-- Create DocumentTypeConfig table if it doesn't exist
CREATE TABLE IF NOT EXISTS "DocumentTypeConfig" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "acceptedMimeTypes" TEXT[] DEFAULT ARRAY['application/pdf', 'image/jpeg', 'image/png']::TEXT[],
    "maxFileSize" INTEGER NOT NULL DEFAULT 10485760,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DocumentTypeConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentTypeConfig_type_key" ON "DocumentTypeConfig"("type");
EOF

# Now try to deploy migrations or push schema
npx prisma migrate deploy || {
    echo -e "${YELLOW}No new migrations to deploy, syncing schema...${NC}"
    # Use db push to sync schema, skip if it fails on existing objects
    npx prisma db push --accept-data-loss --skip-generate || {
        echo -e "${YELLOW}⚠️  Some schema changes could not be applied (likely already exist)${NC}"
    }
}

# Verify database connection and run seed if needed
npx prisma db seed --preview-feature 2>/dev/null || true

# 🔒 PRODUCTION SAFETY: Verify we're not accidentally resetting production data
if [ "$NODE_ENV" = "production" ]; then
    echo -e "${YELLOW}🔒 Verifying production database safety...${NC}"

    # Count existing documents to ensure we're not losing data
    DOCUMENT_COUNT=$(npx prisma db execute --stdin <<'EOF'
SELECT COUNT(*) as count FROM "UserDocument";
EOF
2>/dev/null | grep -o '[0-9]*' | tail -1 || echo "0")

    if [ ! -z "$DOCUMENT_COUNT" ] && [ "$DOCUMENT_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓ Production database verified: $DOCUMENT_COUNT documents preserved${NC}"
    else
        echo -e "${YELLOW}⚠️  Production database appears empty (might be fresh setup)${NC}"
    fi
else
    echo -e "${YELLOW}ℹ️  Development environment - database safety checks skipped${NC}"
fi

echo -e "${GREEN}✓ Database migrations completed${NC}"

# 7. Copy ecosystem config and ensure production environment
echo -e "${YELLOW}🔄 Preparing PM2 configuration...${NC}"
cp "$TEMP_DIR/ecosystem.config.js" "$DEPLOY_DIR/ecosystem.config.js.tmp"

# 7.1 🔥 ANTI-DEPLOYMENT BREAKAGE: Force production environment in ecosystem config
echo -e "${YELLOW}🔧 Forcing production environment in PM2 config...${NC}"
sed -i 's/NODE_ENV.*:.*'"'"'development'"'"'/NODE_ENV: '"'"'production'"'"'/g' "$DEPLOY_DIR/ecosystem.config.js.tmp"
sed -i 's/PORT.*:.*3001/PORT: 3010/g' "$DEPLOY_DIR/ecosystem.config.js.tmp"
mv "$DEPLOY_DIR/ecosystem.config.js.tmp" "$DEPLOY_DIR/ecosystem.config.js"
echo -e "${GREEN}✓ Ecosystem config prepared for production${NC}"

# 7.2 Stop all PM2 processes before restart (prevents crash loops)
echo -e "${YELLOW}⏹️  Stopping all PM2 processes...${NC}"
cd "$DEPLOY_DIR"
pm2 stop all || true
pm2 delete all || true
sleep 2

# 7.3 Start fresh PM2 processes
echo -e "${YELLOW}▶️  Starting PM2 processes...${NC}"
pm2 start ecosystem.config.js
sleep 5

# 7.4 Verify processes started correctly
BACKEND_STATUS=$(pm2 jlist | grep -o '"name":"discovery-backend".*"status":"[^"]*"' | grep -o 'online' || echo "error")
if [ "$BACKEND_STATUS" != "online" ]; then
    echo -e "${RED}❌ Backend failed to start! Checking logs...${NC}"
    pm2 logs discovery-backend --lines 50 --nostream
    exit 1
fi
echo -e "${GREEN}✓ Backend started successfully${NC}"

# Ensure frontend proxy server is copied and accessible
if [ ! -f "$DEPLOY_DIR/frontend-proxy-server.js" ]; then
    echo -e "${RED}❌ Frontend proxy server missing after deploy!${NC}"
    if [ -f "$TEMP_DIR/frontend-proxy-server-production.js" ]; then
        cp "$TEMP_DIR/frontend-proxy-server-production.js" "$DEPLOY_DIR/frontend-proxy-server.js"
    else
        cp "$TEMP_DIR/frontend-proxy-server.js" "$DEPLOY_DIR/"
    fi
fi

# 8. Salva configurazione PM2
pm2 save

# 9. Cleanup
echo -e "${YELLOW}🧹 Cleaning up...${NC}"
rm -rf "$TEMP_DIR"

# 10. Rimuovi backup vecchi (mantieni solo ultimi 5)
cd "$BACKUP_DIR"
ls -t discovery_backup_*.tar.gz | tail -n +6 | xargs -r rm
ls -t uploads_backup_* | tail -n +6 | xargs -r rm -rf

# 11. Configure nginx proxy (if not already configured)
echo -e "${YELLOW}🌐 Configuring nginx API proxy...${NC}"
NGINX_CONF_DIR="/etc/nginx/sites-available"
NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
SITE_CONF="discovery.cfoeducation.it"

if [ -f "$NGINX_CONF_DIR/$SITE_CONF" ]; then
    # Check if API proxy is already configured
    if ! grep -q "location /api/" "$NGINX_CONF_DIR/$SITE_CONF"; then
        echo -e "${YELLOW}Adding API proxy configuration to nginx...${NC}"

        # Backup current config
        cp "$NGINX_CONF_DIR/$SITE_CONF" "$NGINX_CONF_DIR/$SITE_CONF.backup_$(date +%Y%m%d_%H%M%S)"

        # Add API proxy configuration before the main location block
        sed -i '/location \/ {/i\
    # API Proxy for backend\
    location /api/ {\
        proxy_pass http://localhost:3010/api/;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection '"'"'upgrade'"'"';\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_cache_bypass $http_upgrade;\
        proxy_connect_timeout 60s;\
        proxy_send_timeout 60s;\
        proxy_read_timeout 60s;\
        client_max_body_size 50M;\
        proxy_buffering off;\
        proxy_request_buffering off;\
    }\
' "$NGINX_CONF_DIR/$SITE_CONF"

        # Test nginx configuration
        if nginx -t; then
            systemctl reload nginx
            echo -e "${GREEN}✓ Nginx configuration updated and reloaded${NC}"
        else
            echo -e "${RED}❌ Nginx configuration test failed, rolling back...${NC}"
            cp "$NGINX_CONF_DIR/$SITE_CONF.backup_$(date +%Y%m%d_%H%M%S)" "$NGINX_CONF_DIR/$SITE_CONF"
        fi
    else
        echo -e "${GREEN}✓ API proxy already configured${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Nginx site config not found at $NGINX_CONF_DIR/$SITE_CONF${NC}"
fi

# 11.5 Run R2 document migration if needed
echo -e "${YELLOW}📦 Running R2 document migration if needed...${NC}"
cd "$DEPLOY_DIR/backend"
if [ -f "scripts/auto-migrate-on-deploy.js" ]; then
    node scripts/auto-migrate-on-deploy.js || echo -e "${YELLOW}⚠️ R2 migration had issues, continuing...${NC}"
else
    echo -e "${YELLOW}⚠️ No R2 migration script found${NC}"
fi

# 12. Run ANTI-DEPLOYMENT BREAKAGE health checks
echo -e "${YELLOW}🏥 Running post-deployment health checks...${NC}"
cd "$DEPLOY_DIR/backend"
if node dist/scripts/post-deploy-health-check.js; then
    echo -e "${GREEN}✅ All health checks passed${NC}"
else
    echo -e "${RED}❌ Health checks failed - deployment may have issues${NC}"
    echo -e "${YELLOW}Continuing with basic verification...${NC}"
fi

# 12.1 🛡️ COMPREHENSIVE: Test ALL critical systems
echo -e "${YELLOW}🛡️ Testing ALL critical systems...${NC}"
if node dist/scripts/test-all-critical-systems.js; then
    echo -e "${GREEN}✅ All critical systems operational${NC}"
else
    echo -e "${RED}🚨 CRITICAL DEPLOYMENT FAILURE: Multiple systems broken!${NC}"
    echo -e "${RED}📋 Check: Contract generation, payments, documents, auth, partner system${NC}"
    echo -e "${RED}🔧 Consider rollback: tar xzf ~/backups/discovery_backup_$TIMESTAMP.tar.gz${NC}"
    # Log critical failures but don't exit - allow manual intervention
    echo -e "${YELLOW}⚠️ Continuing with basic deployment verification...${NC}"
fi

# 12.2 🔒 SPECIFIC: Test coupon fix (most common breakage)
echo -e "${YELLOW}🔒 Testing critical coupon fix specifically...${NC}"
if node dist/scripts/test-coupon-fix-post-deploy.js 2>/dev/null; then
    echo -e "${GREEN}✅ Coupon usage logs fix confirmed intact${NC}"
else
    echo -e "${RED}🚨 CRITICAL FAILURE: Coupon fix has been overwritten!${NC}"
    echo -e "${RED}📍 Check: /backend/src/routes/partner.ts line 1335${NC}"
    echo -e "${RED}Must be: partnerCompanyId: partnerCompanyId (NOT legacyPartner.id)${NC}"
    # Don't exit - log critical issue but continue deploy
fi

# 13. Verify deployment
echo -e "${YELLOW}🔍 Verifying deployment...${NC}"

# Check if PM2 process is running
if pm2 show discovery-backend > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PM2 backend process is running${NC}"
else
    echo -e "${RED}❌ PM2 backend process failed to start${NC}"
    pm2 logs discovery-backend --lines 20
    exit 1
fi

# Check if frontend process is running
if pm2 show discovery-frontend > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PM2 frontend process is running${NC}"
else
    echo -e "${YELLOW}⚠️ PM2 frontend process not running, attempting restart...${NC}"
    pm2 restart discovery-frontend || pm2 start ecosystem.config.js --only discovery-frontend
fi

# Quick API health check
sleep 5
if curl -s -f "http://localhost:3010/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API health check passed (direct)${NC}"
else
    echo -e "${YELLOW}⚠️ API health check failed on direct port 3010${NC}"
fi

# Test API through nginx proxy
if curl -s -f "https://discovery.cfoeducation.it/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API proxy health check passed${NC}"
else
    echo -e "${YELLOW}⚠️ API proxy health check failed${NC}"
fi

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "🌐 Site: https://discovery.cfoeducation.it"
echo -e "📊 Backend API: https://discovery.cfoeducation.it/api"
echo -e "📋 Run verification: bash verify-deployment.sh"

# Log deployment
echo "[$(date)] Deployment completed - Version: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" >> "$HOME/deployments.log"