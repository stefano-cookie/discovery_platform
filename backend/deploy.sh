#!/bin/bash

# Discovery Platform Backend Deployment Script
# This script ensures proper deployment with all necessary directories

echo "🚀 Starting Discovery Platform Backend Deployment..."

# Build the project
echo "📦 Building project..."
npm run build

# Ensure uploads directories exist in production root
echo "📁 Creating uploads directories..."
mkdir -p uploads/contracts
mkdir -p uploads/documents
mkdir -p uploads/signed-contracts
mkdir -p uploads/temp-enrollment

# Copy any existing uploads from backend to root (if running from backend dir)
if [ -d "uploads" ] && [ ! -d "../uploads" ]; then
    echo "📂 Moving uploads directory to project root..."
    cp -r uploads ../
fi

# Set proper permissions
echo "🔐 Setting permissions..."
chmod -R 755 uploads/

# Create .env.production if it doesn't exist
if [ ! -f ".env.production" ]; then
    echo "📝 Creating .env.production template..."
    cat > .env.production << EOL
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://discovery.cfoeducation.it
DATABASE_URL=postgresql://username:password@localhost:5432/discovery_db
JWT_SECRET=your-production-jwt-secret
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
EOL
    echo "⚠️  Please update .env.production with your actual production values!"
fi

echo "✅ Deployment preparation complete!"
echo "📋 Next steps:"
echo "  1. Update .env.production with your production values"
echo "  2. Start the server with: npm start"
echo "  3. Check that uploads are accessible at: http://yourserver/uploads/contracts/"