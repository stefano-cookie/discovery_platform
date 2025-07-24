#!/bin/bash

# Manual deployment script
# Usage: ./deploy-manual.sh <user> <host>

set -e

if [ $# -lt 2 ]; then
    echo "Usage: $0 <user> <host>"
    exit 1
fi

USER=$1
HOST=$2
REMOTE_PATH="/var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it"

echo "🚀 Starting manual deployment to $USER@$HOST"

# Build frontend
echo "📦 Building frontend..."
cd frontend
npm ci
npm run build
cd ..

# Build backend  
echo "📦 Building backend..."
cd backend
npm ci
npm run build
cd ..

# Create deployment archive
echo "📦 Creating deployment archive..."
tar -czf deploy.tar.gz \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=.env \
    --exclude=backend/uploads \
    frontend/build \
    backend/dist \
    backend/prisma \
    backend/package*.json \
    nginx-production.conf \
    deploy-on-server.sh

# Upload to server
echo "📤 Uploading to server..."
scp deploy.tar.gz $USER@$HOST:~/

# Execute deployment on server
echo "🚀 Executing deployment script..."
ssh $USER@$HOST << 'EOF'
    cd ~
    tar -xzf deploy.tar.gz
    bash deploy-on-server.sh
    rm deploy.tar.gz
EOF

# Clean up local archive
rm deploy.tar.gz

echo "✅ Deployment complete!"