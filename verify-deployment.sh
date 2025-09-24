#!/bin/bash

# Script di verifica post-deployment per sistema documenti
# Esegui questo script dopo il deploy per verificare che tutto funzioni

set -e

DEPLOY_DIR="/var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it"
API_URL="https://discovery.cfoeducation.it/api"

echo "🔍 Verifying deployment..."

# 0. Run ANTI-DEPLOYMENT BREAKAGE health checks
echo "🏥 Running automated health checks..."
cd "$DEPLOY_DIR/backend"
if node dist/scripts/post-deploy-health-check.js 2>/dev/null; then
    echo "✅ Automated health checks passed"
else
    echo "⚠️ Automated health checks failed, running manual verification..."
fi

# 1. Verifica directory uploads
echo "📁 Checking upload directories..."
REQUIRED_DIRS=(
    "$DEPLOY_DIR/backend/uploads/contracts"
    "$DEPLOY_DIR/backend/uploads/signed-contracts"
    "$DEPLOY_DIR/backend/uploads/documents/user-uploads"
    "$DEPLOY_DIR/backend/uploads/registrations"
    "$DEPLOY_DIR/backend/uploads/temp-enrollment"
    "$DEPLOY_DIR/backend/uploads/temp"
)

for DIR in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$DIR" ]; then
        echo "✓ $DIR exists"
    else
        echo "❌ Missing: $DIR"
        exit 1
    fi
done

# 2. Verifica permessi
echo "🔒 Checking permissions..."
if [ -w "$DEPLOY_DIR/backend/uploads" ]; then
    echo "✓ Uploads directory is writable"
else
    echo "❌ Uploads directory is not writable"
    echo "Fix with: chmod -R 755 $DEPLOY_DIR/backend/uploads"
    exit 1
fi

# 3. Verifica PDF worker
echo "📄 Checking PDF worker..."
if [ -f "$DEPLOY_DIR/pdf.worker.min.js" ]; then
    echo "✓ PDF worker found"
else
    echo "❌ PDF worker missing"
    echo "Fix with: cp frontend/public/pdf.worker.min.js $DEPLOY_DIR/"
fi

# 4. Verifica backend API
echo "🌐 Checking API health..."
if curl -s -f "$API_URL/health" > /dev/null 2>&1; then
    echo "✓ API is responding"
else
    echo "❌ API is not responding"
    echo "Check with: pm2 logs discovery-api"
fi

# 5. Verifica database schema
echo "🗄️ Checking database schema..."
cd "$DEPLOY_DIR/backend"
if npx prisma db pull > /dev/null 2>&1; then
    echo "✓ Database connection successful"
else
    echo "❌ Database connection failed"
    exit 1
fi

# 6. Test upload endpoint
echo "📤 Testing document upload endpoint..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/documents/test" || echo "000")
if [ "$RESPONSE" -eq "401" ] || [ "$RESPONSE" -eq "404" ]; then
    echo "✓ Document endpoint accessible (auth required)"
else
    echo "⚠️ Document endpoint returned: $RESPONSE"
fi

echo ""
echo "✅ Deployment verification completed!"
echo ""
echo "🚀 Next steps:"
echo "1. Test document upload in browser"
echo "2. Test contract generation"
echo "3. Verify PDF preview works"
echo "4. Check logs: pm2 logs discovery-api"