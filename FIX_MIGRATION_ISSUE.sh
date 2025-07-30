#!/bin/bash

echo "🔧 Fixing Prisma migration issue in production..."
echo ""

# Opzione 1: Database Push (Più Sicura)
echo "📦 Option 1: Database Push"
echo "Run this command in your production environment:"
echo "npx prisma db push --accept-data-loss"
echo ""

# Opzione 2: Migration Baseline
echo "📦 Option 2: Migration Baseline" 
echo "Run these commands in your production environment:"
echo "npx prisma migrate resolve --applied 20241210000000_init"
echo "npx prisma migrate resolve --applied [other-migration-names]"
echo "npx prisma migrate deploy"
echo ""

# Opzione 3: Reset e Re-seed (Solo se i dati non sono critici)
echo "📦 Option 3: Complete Reset (⚠️ DESTROYS DATA)"
echo "npx prisma migrate reset --force"
echo "npx prisma db seed"
echo ""

echo "✅ Choose the option that best fits your production environment"
echo "⚠️  Option 1 (db push) is recommended for production with existing data"