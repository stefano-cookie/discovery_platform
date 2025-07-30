#!/bin/bash

# Script per risolvere il problema di login in produzione
# Eseguire questo script localmente per connettersi al server e sistemare il problema

echo "🔧 Fix Login Produzione - Discovery Platform"
echo "==========================================="

# Configurazione
SSH_USER="cfoeducation.it_f55qsn6wucc"
SSH_HOST="94.143.138.213"
SSH_PASS="lasolita123"
DB_CONNECTION="postgresql://discovery_user:Lasolita123@localhost:5432/discovery_prod_db"

# Colori
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}📡 Connessione al server...${NC}"

# Comandi da eseguire sul server
ssh ${SSH_USER}@${SSH_HOST} << 'ENDSSH'
echo "✅ Connesso al server"

# 1. Verifica stato PM2
echo -e "\n📊 Stato PM2:"
pm2 status

# 2. Controllo directory backend
echo -e "\n📁 Verifica directory backend:"
cd /var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it/backend
pwd

# 3. Verifica file .env
echo -e "\n🔐 Controllo variabili ambiente:"
if [ -f .env ]; then
    echo "✅ File .env trovato"
    # Verifica presenza DATABASE_URL e JWT_SECRET
    grep -E "(DATABASE_URL|JWT_SECRET)" .env | sed 's/=.*/=***HIDDEN***/'
else
    echo "❌ File .env NON trovato!"
fi

# 4. Verifica stato migrazioni
echo -e "\n🗄️ Stato migrazioni database:"
export DATABASE_URL="postgresql://discovery_user:Lasolita123@localhost:5432/discovery_prod_db"
npx prisma migrate status

# 5. Applica migrazioni se necessario
echo -e "\n🔄 Applicazione migrazioni pendenti..."
npx prisma migrate deploy

# 6. Rigenera Prisma Client
echo -e "\n🔧 Rigenerazione Prisma Client..."
npx prisma generate

# 7. Verifica struttura database
echo -e "\n📊 Verifica tabelle database:"
psql "postgresql://discovery_user:Lasolita123@localhost:5432/discovery_prod_db" -c "\dt" | head -20

# 8. Controlla se ci sono utenti nel database
echo -e "\n👥 Verifica presenza utenti:"
psql "postgresql://discovery_user:Lasolita123@localhost:5432/discovery_prod_db" -c "SELECT COUNT(*) as total_users FROM \"User\";"

# 9. Mostra ultimi log errori
echo -e "\n📋 Ultimi errori nei log:"
pm2 logs discovery-api --lines 50 --nostream | grep -i error | tail -10

# 10. Restart PM2
echo -e "\n🔄 Restart servizio backend..."
pm2 restart discovery-api

# 11. Verifica nuovo stato
sleep 3
echo -e "\n✅ Nuovo stato PM2:"
pm2 status

echo -e "\n🎯 Fix completato!"
ENDSSH

echo -e "\n${GREEN}✅ Script completato!${NC}"
echo "Prova ora a fare login su https://discovery.cfoeducation.it"