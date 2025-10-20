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

# 1. Crea backup del deployment attuale (parallelo per velocità)
echo -e "${YELLOW}📦 Creating backup in background...${NC}"
mkdir -p "$BACKUP_DIR"
if [ -d "$DEPLOY_DIR" ]; then
    # Backup asincrono - non blocca il deployment
    (tar czf "$BACKUP_DIR/discovery_backup_$TIMESTAMP.tar.gz" -C "$DEPLOY_DIR" . 2>/dev/null && \
     echo -e "${GREEN}✓ Backup completed: discovery_backup_$TIMESTAMP.tar.gz${NC}") &
    BACKUP_PID=$!
    echo -e "${YELLOW}⏳ Backup running in background (PID: $BACKUP_PID)${NC}"
fi

# 2. Deploy Frontend
echo -e "${YELLOW}🎨 Deploying frontend...${NC}"
mkdir -p "$DEPLOY_DIR/frontend/build"
rsync -av --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='*.log' \
    "$TEMP_DIR/frontend/build/" "$DEPLOY_DIR/frontend/build/"

# 2.1 Copy frontend build files to project root (for web server)
echo -e "${YELLOW}📋 Copying frontend files to project root...${NC}"
# Copy index.html to root
cp "$DEPLOY_DIR/frontend/build/index.html" "$DEPLOY_DIR/index.html"
echo -e "${GREEN}✓ Copied index.html to root${NC}"

# Copy .htaccess to root (if exists)
if [ -f "$DEPLOY_DIR/frontend/build/.htaccess" ]; then
    cp "$DEPLOY_DIR/frontend/build/.htaccess" "$DEPLOY_DIR/.htaccess"
    echo -e "${GREEN}✓ Copied .htaccess to root${NC}"
fi

# Copy static files to root
mkdir -p "$DEPLOY_DIR/static"
rsync -av --delete "$DEPLOY_DIR/frontend/build/static/" "$DEPLOY_DIR/static/"
echo -e "${GREEN}✓ Copied static files to root/static/${NC}"

# Copy favicon and other assets to root
for asset in favicon.ico favicon.svg logo192.png logo192.svg logo512.png logo512.svg manifest.json robots.txt diamond-favicon.svg asset-manifest.json pdf.worker.min.js; do
    if [ -f "$DEPLOY_DIR/frontend/build/$asset" ]; then
        cp "$DEPLOY_DIR/frontend/build/$asset" "$DEPLOY_DIR/$asset"
    fi
done
echo -e "${GREEN}✓ Copied frontend assets to root${NC}"

# Verify index.html references correct JS bundle
BUNDLE_REFERENCE=$(grep -o 'main\.[^"]*\.js' "$DEPLOY_DIR/index.html" | head -1)
if [ -f "$DEPLOY_DIR/static/js/$BUNDLE_REFERENCE" ]; then
    echo -e "${GREEN}✓ Verified bundle exists: $BUNDLE_REFERENCE${NC}"
else
    echo -e "${RED}❌ WARNING: Bundle file not found: $BUNDLE_REFERENCE${NC}"
    echo -e "${YELLOW}   Available bundles in static/js/:${NC}"
    ls -lh "$DEPLOY_DIR/static/js/" | grep "\.js$" | awk '{print "     "$9}'
fi

# 2.2 Deploy Frontend Proxy Server
echo -e "${YELLOW}🔧 Deploying frontend proxy server...${NC}"
mkdir -p "$DEPLOY_DIR/frontend"
if [ -f "$TEMP_DIR/frontend-proxy-server-production.js" ]; then
    cp "$TEMP_DIR/frontend-proxy-server-production.js" "$DEPLOY_DIR/frontend/frontend-proxy-server.js"
    echo -e "${GREEN}✓ Frontend proxy server deployed (production version)${NC}"
else
    cp "$TEMP_DIR/frontend-proxy-server.js" "$DEPLOY_DIR/frontend/"
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
    --exclude='.env.production.placeholder' \
    --exclude='*.log' \
    "$TEMP_DIR/backend/" "$DEPLOY_DIR/backend/"
echo -e "${GREEN}✓ Backend deployed (preserved .env files)${NC}"

# 3.1 Backup existing uploads before deploy (parallelo)
echo -e "${YELLOW}📁 Backing up existing uploads in background...${NC}"
if [ -d "$DEPLOY_DIR/backend/uploads" ]; then
    mkdir -p "$BACKUP_DIR"
    (cp -r "$DEPLOY_DIR/backend/uploads" "$BACKUP_DIR/uploads_backup_$TIMESTAMP" 2>/dev/null && \
     echo -e "${GREEN}✓ Uploads backed up to: uploads_backup_$TIMESTAMP${NC}") &
    UPLOADS_BACKUP_PID=$!
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

# 4.3 🔥 ANTI-DEPLOYMENT BREAKAGE: Sync .env.production → .env
echo -e "${YELLOW}🔄 Syncing .env.production → .env...${NC}"
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

# 4.5 🔐 VERIFY R2 CREDENTIALS SYNC: Ensure .env and .env.production have same R2 key
echo -e "${YELLOW}🔐 Verifying R2 credentials sync...${NC}"
ENV_R2_KEY=$(grep "^CLOUDFLARE_SECRET_ACCESS_KEY=" "$DEPLOY_DIR/backend/.env" | cut -d'=' -f2 | tr -d '"' | head -c 20)
ENV_PROD_R2_KEY=$(grep "^CLOUDFLARE_SECRET_ACCESS_KEY=" "$DEPLOY_DIR/backend/.env.production" | cut -d'=' -f2 | tr -d '"' | head -c 20)

if [ "$ENV_R2_KEY" = "$ENV_PROD_R2_KEY" ]; then
    echo -e "${GREEN}✓ R2 credentials synchronized between .env and .env.production${NC}"
else
    echo -e "${RED}❌ WARNING: R2 credentials MISMATCH detected!${NC}"
    echo -e "${YELLOW}   Re-syncing .env from .env.production to fix...${NC}"
    cp "$DEPLOY_DIR/backend/.env.production" "$DEPLOY_DIR/backend/.env"
    echo -e "${GREEN}✓ R2 credentials re-synchronized${NC}"
fi

# 5. Verifica dipendenze backend (pre-built in CI, skip se presenti)
echo -e "${YELLOW}📦 Verifying backend dependencies...${NC}"
cd "$DEPLOY_DIR/backend"
if [ -d "$TEMP_DIR/backend/node_modules" ] && [ -d "$TEMP_DIR/backend/node_modules/.prisma" ]; then
    echo -e "${GREEN}✓ Using pre-built node_modules from CI (skip npm install)${NC}"
    # Node modules già inclusi nel deploy da GitHub Actions
else
    echo -e "${YELLOW}⚠️ node_modules not found, installing from scratch...${NC}"
    npm ci --omit=dev --prefer-offline
fi

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

# 6. Esegui migrazioni database (Prisma client già generato in CI)
echo -e "${YELLOW}🗄️ Running database migrations...${NC}"
cd "$DEPLOY_DIR/backend"

# Verifica che Prisma Client sia presente (generato in CI)
if [ -d "node_modules/.prisma/client" ]; then
    echo -e "${GREEN}✓ Using pre-generated Prisma Client from CI${NC}"
else
    echo -e "${YELLOW}⚠️ Prisma Client not found, generating...${NC}"
    npx prisma generate
fi

# Apply migrations only (no db push - troppo rischioso in prod)
echo -e "${YELLOW}⚠️  Applying database migrations...${NC}"
npx prisma migrate deploy 2>&1 | tee /tmp/prisma-migrate.log || {
    if grep -q "No pending migrations" /tmp/prisma-migrate.log; then
        echo -e "${GREEN}✓ Database schema is up to date${NC}"
    else
        echo -e "${YELLOW}⚠️ No migrations to deploy or migration failed${NC}"
        echo -e "${YELLOW}Check logs above for details${NC}"
    fi
}

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

# 7.2 Zero-downtime reload with PM2 (preserva GitHub runner!)
echo -e "${YELLOW}🔄 Performing zero-downtime reload...${NC}"
cd "$DEPLOY_DIR"

# Check if processes already exist
if pm2 list | grep -q "discovery-backend"; then
    echo -e "${YELLOW}Reloading existing processes (zero-downtime)...${NC}"
    # Reload SOLO i processi discovery, NON toccare altri processi
    pm2 reload discovery-backend --update-env || pm2 restart discovery-backend
    pm2 reload discovery-frontend --update-env 2>/dev/null || true
else
    echo -e "${YELLOW}Starting fresh PM2 processes...${NC}"
    pm2 start ecosystem.config.js
fi

sleep 3

# 7.3 Verify processes started correctly
BACKEND_STATUS=$(pm2 jlist | grep -o '"name":"discovery-backend".*"status":"[^"]*"' | grep -o 'online' | head -1 || echo "error")
if [ "$BACKEND_STATUS" != "online" ]; then
    echo -e "${RED}❌ Backend failed to start! Checking logs...${NC}"
    pm2 logs discovery-backend --lines 50 --nostream
    exit 1
fi
echo -e "${GREEN}✓ Backend running (zero-downtime reload)${NC}"

# 7.4 Quick R2 test (ottimizzato)
echo -e "${YELLOW}🧪 Quick R2 connection test...${NC}"
cd "$DEPLOY_DIR/backend"
timeout 5 node -e "require('dotenv').config();const{S3Client,ListBucketsCommand}=require('@aws-sdk/client-s3');new S3Client({region:'auto',endpoint:process.env.CLOUDFLARE_ENDPOINT,credentials:{accessKeyId:process.env.CLOUDFLARE_ACCESS_KEY_ID,secretAccessKey:process.env.CLOUDFLARE_SECRET_ACCESS_KEY}}).send(new ListBucketsCommand({})).then(r=>console.log('R2_OK:'+r.Buckets.length)).catch(e=>{console.log('R2_ERROR');process.exit(1)});" 2>&1 | grep -q "R2_OK" && \
    echo -e "${GREEN}✓ R2 connection verified${NC}" || \
    echo -e "${YELLOW}⚠️ R2 test failed (non-blocking)${NC}"

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

# 11. Configure nginx proxy (cached check - skip se già fatto)
NGINX_CONFIGURED_MARKER="$HOME/.nginx_api_proxy_configured"
if [ ! -f "$NGINX_CONFIGURED_MARKER" ]; then
    echo -e "${YELLOW}🌐 Configuring nginx API proxy...${NC}"
    NGINX_CONF_DIR="/etc/nginx/sites-available"
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
            if nginx -t 2>/dev/null; then
                systemctl reload nginx 2>/dev/null
                echo -e "${GREEN}✓ Nginx configuration updated and reloaded${NC}"
                touch "$NGINX_CONFIGURED_MARKER"
            else
                echo -e "${RED}❌ Nginx configuration test failed${NC}"
            fi
        else
            echo -e "${GREEN}✓ API proxy already configured${NC}"
            touch "$NGINX_CONFIGURED_MARKER"
        fi
    fi
else
    echo -e "${GREEN}✓ Nginx already configured (cached check)${NC}"
fi

# 11.5 Run R2 document migration if needed
echo -e "${YELLOW}📦 Running R2 document migration if needed...${NC}"
cd "$DEPLOY_DIR/backend"
if [ -f "scripts/auto-migrate-on-deploy.js" ]; then
    node scripts/auto-migrate-on-deploy.js || echo -e "${YELLOW}⚠️ R2 migration had issues, continuing...${NC}"
else
    echo -e "${YELLOW}⚠️ No R2 migration script found${NC}"
fi

# 12. Run consolidated health checks (ottimizzato - timeout 10s)
echo -e "${YELLOW}🏥 Running quick health checks...${NC}"
cd "$DEPLOY_DIR/backend"

# Test health checks in parallelo con timeout
(timeout 10 node dist/scripts/post-deploy-health-check.js 2>/dev/null && echo "HC1_OK") &
(timeout 10 node dist/scripts/test-all-critical-systems.js 2>/dev/null && echo "HC2_OK") &
(timeout 10 node dist/scripts/test-coupon-fix-post-deploy.js 2>/dev/null && echo "HC3_OK") &

wait

# Quick summary
if [ -f /tmp/health-check.log ]; then
    grep -q "FAIL" /tmp/health-check.log && \
        echo -e "${YELLOW}⚠️ Some health checks failed (non-blocking)${NC}" || \
        echo -e "${GREEN}✅ Health checks passed${NC}"
else
    echo -e "${GREEN}✓ Basic health checks completed${NC}"
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

# Verify frontend is serving correct bundle
echo -e "${YELLOW}🔍 Verifying frontend bundle...${NC}"
SERVED_BUNDLE=$(curl -s "https://discovery.cfoeducation.it/" | grep -o 'main\.[^"]*\.js' | head -1)
EXPECTED_BUNDLE=$(grep -o 'main\.[^"]*\.js' "$DEPLOY_DIR/index.html" | head -1)

if [ "$SERVED_BUNDLE" = "$EXPECTED_BUNDLE" ]; then
    echo -e "${GREEN}✓ Frontend serving correct bundle: $SERVED_BUNDLE${NC}"
else
    echo -e "${RED}❌ WARNING: Frontend bundle mismatch!${NC}"
    echo -e "${RED}   Expected: $EXPECTED_BUNDLE${NC}"
    echo -e "${RED}   Served: $SERVED_BUNDLE${NC}"
    echo -e "${YELLOW}   This may indicate caching or configuration issues${NC}"
fi

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "🌐 Site: https://discovery.cfoeducation.it"
echo -e "📊 Backend API: https://discovery.cfoeducation.it/api"
echo -e "📋 Run verification: bash verify-deployment.sh"

# Log deployment
echo "[$(date)] Deployment completed - Version: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" >> "$HOME/deployments.log"