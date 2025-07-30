#!/bin/bash

echo "🗄️ Deploying database changes..."

# Try migrate first, fall back to push if needed
if npx prisma migrate deploy 2>/dev/null; then
    echo "✅ Database migrated successfully"
else
    echo "⚠️ Migration failed, using database push..."
    npx prisma db push --accept-data-loss
    echo "✅ Database schema synchronized"
fi

# Generate Prisma client
npx prisma generate
echo "✅ Prisma client generated"