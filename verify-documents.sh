#!/bin/bash

# Script per verificare lo stato dei documenti dopo il deploy
# Esegui questo script sul server per verificare che i documenti siano accessibili

set -e

DEPLOY_DIR="/var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it"
UPLOADS_DIR="$DEPLOY_DIR/backend/uploads"

# Colori per output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Verifying document integrity after deployment...${NC}"

# 1. Verifica esistenza directory uploads
echo -e "${YELLOW}📁 Checking uploads directory structure...${NC}"
if [ -d "$UPLOADS_DIR" ]; then
    echo -e "${GREEN}✓ Uploads directory exists${NC}"

    # Lista sottodirectory
    for dir in contracts signed-contracts documents registrations temp-enrollment; do
        if [ -d "$UPLOADS_DIR/$dir" ]; then
            echo -e "${GREEN}✓ $dir directory exists${NC}"
        else
            echo -e "${RED}❌ $dir directory missing${NC}"
        fi
    done
else
    echo -e "${RED}❌ Uploads directory missing!${NC}"
    exit 1
fi

# 2. Conta file presenti
echo -e "${YELLOW}📊 Counting uploaded files...${NC}"
TOTAL_FILES=$(find "$UPLOADS_DIR" -type f 2>/dev/null | wc -l)
echo -e "${GREEN}✓ Total files found: $TOTAL_FILES${NC}"

if [ "$TOTAL_FILES" -gt 0 ]; then
    echo -e "${YELLOW}📋 File breakdown:${NC}"
    find "$UPLOADS_DIR" -type f -exec dirname {} \; | sort | uniq -c | while read count dir; do
        relative_dir=${dir#$UPLOADS_DIR/}
        echo -e "  $count files in $relative_dir"
    done
fi

# 3. Verifica permessi
echo -e "${YELLOW}🔐 Checking permissions...${NC}"
PERMISSIONS=$(stat -c "%a" "$UPLOADS_DIR" 2>/dev/null || stat -f "%A" "$UPLOADS_DIR" 2>/dev/null)
if [ "$PERMISSIONS" = "755" ]; then
    echo -e "${GREEN}✓ Correct permissions (755) on uploads directory${NC}"
else
    echo -e "${YELLOW}⚠️ Permissions: $PERMISSIONS (should be 755)${NC}"
fi

# 4. Test connessione database per documenti
echo -e "${YELLOW}🗄️ Testing database connection...${NC}"
cd "$DEPLOY_DIR/backend"
if [ -f ".env" ]; then
    # Carica variabili ambiente
    export $(cat .env | grep -v '^#' | xargs)

    # Test semplice connessione
    if npx prisma db execute --stdin 2>/dev/null <<< "SELECT COUNT(*) FROM \"UserDocument\";" > /dev/null; then
        echo -e "${GREEN}✓ Database connection successful${NC}"

        # Conta documenti nel database
        DB_COUNT=$(npx prisma db execute --stdin 2>/dev/null <<< "SELECT COUNT(*) FROM \"UserDocument\";" | tail -1 | grep -o '[0-9]*' || echo "0")
        echo -e "${GREEN}✓ Documents in database: $DB_COUNT${NC}"

        if [ "$DB_COUNT" -gt 0 ] && [ "$TOTAL_FILES" -eq 0 ]; then
            echo -e "${RED}❌ WARNING: Database has $DB_COUNT documents but no files found!${NC}"
        elif [ "$TOTAL_FILES" -gt 0 ] && [ "$DB_COUNT" -eq 0 ]; then
            echo -e "${YELLOW}⚠️ WARNING: Files found but no documents in database${NC}"
        fi
    else
        echo -e "${RED}❌ Database connection failed${NC}"
    fi
else
    echo -e "${RED}❌ .env file not found${NC}"
fi

# 5. Test API endpoint per documenti
echo -e "${YELLOW}🌐 Testing document API endpoint...${NC}"
if curl -s -f "http://localhost:3010/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API is responding${NC}"
else
    echo -e "${RED}❌ API not responding${NC}"
fi

echo -e "${GREEN}✅ Document verification completed!${NC}"

# Suggerimenti se ci sono problemi
if [ "$TOTAL_FILES" -eq 0 ] && [ "${DB_COUNT:-0}" -gt 0 ]; then
    echo -e "${YELLOW}💡 Suggestion: Documents may have been lost during deployment.${NC}"
    echo -e "${YELLOW}   Check backup directory: $HOME/backups/uploads_backup_*${NC}"
    echo -e "${YELLOW}   To restore: cp -r \$HOME/backups/uploads_backup_LATEST/* $UPLOADS_DIR/${NC}"
fi