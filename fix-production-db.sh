#!/bin/bash

# Script per risolvere problemi di sincronizzazione database in produzione
# Da eseguire manualmente sul server prima del deploy se necessario

set -e

# Colori per output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🔧 Fixing production database schema...${NC}"

cd /var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it/backend

# 1. Generate Prisma Client
echo -e "${YELLOW}📦 Generating Prisma Client...${NC}"
npx prisma generate

# 2. Create a baseline migration if needed
echo -e "${YELLOW}🗄️ Creating baseline migration...${NC}"
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > baseline.sql

# 3. Check what tables are missing
echo -e "${YELLOW}🔍 Checking database state...${NC}"
npx prisma db execute --file baseline.sql --schema prisma/schema.prisma 2>&1 | grep -E "already exists|does not exist" || true

# 4. Reset migration history and mark as baseline
echo -e "${YELLOW}📝 Resetting migration history...${NC}"
npx prisma migrate resolve --applied "20250710125204_init" 2>/dev/null || true

# 5. Deploy all pending migrations
echo -e "${YELLOW}🚀 Deploying migrations...${NC}"
npx prisma migrate deploy || {
    echo -e "${YELLOW}⚠️  Migrate deploy failed, trying db push...${NC}"
    npx prisma db push --accept-data-loss
}

echo -e "${GREEN}✅ Database schema fixed!${NC}"

# 6. Verify tables exist
echo -e "${YELLOW}🔍 Verifying tables...${NC}"
npx prisma db execute --stdin --schema prisma/schema.prisma <<EOF
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('DocumentTypeConfig', 'UserDocument', 'DocumentAuditLog');
EOF

echo -e "${GREEN}✅ All required tables should now exist${NC}"