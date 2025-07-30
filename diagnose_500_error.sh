#!/bin/bash

# Script di diagnosi errore 500 login
echo "🔍 Diagnosi Errore 500 - Login API"
echo "=================================="

# Configurazione SSH
SSH_CMD="ssh cfoeducation.it_f55qsn6wucc@94.143.138.213"

echo "📡 Connessione al server..."
echo ""
echo "Esegui questi comandi dopo esserti connesso:"
echo ""
echo "ssh cfoeducation.it_f55qsn6wucc@94.143.138.213"
echo "# Password: lasolita123"
echo ""
echo "Poi copia e incolla questi comandi:"
echo ""
cat << 'EOF'
# 1. Vai alla directory backend
cd /var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it/backend

# 2. Mostra gli ultimi errori
echo "=== ULTIMI ERRORI PM2 ==="
pm2 logs discovery-api --err --lines 50 --nostream

# 3. Verifica se .env esiste
echo -e "\n=== VERIFICA FILE .ENV ==="
if [ -f .env ]; then
    echo "✅ .env esiste"
    echo "Contenuto (nascosto):"
    grep -E "(DATABASE_URL|JWT_SECRET|NODE_ENV|PORT)" .env | sed 's/=.*/=***/'
else
    echo "❌ .env NON ESISTE!"
    
    # Crea .env se non esiste
    echo "Creazione .env..."
    cat > .env << 'ENVFILE'
NODE_ENV=production
DATABASE_URL="postgresql://discovery_user:Lasolita123@localhost:5432/discovery_prod_db"
JWT_SECRET=your-very-secret-jwt-key-here-change-in-production-2024
PORT=3010
HOST=localhost
FRONTEND_URL=https://discovery.cfoeducation.it
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password
EMAIL_FROM=noreply@cfoeducation.it
ENVFILE
    echo "✅ .env creato"
fi

# 4. Test connessione database
echo -e "\n=== TEST CONNESSIONE DATABASE ==="
export DATABASE_URL="postgresql://discovery_user:Lasolita123@localhost:5432/discovery_prod_db"
npx prisma db pull > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Connessione database OK"
else
    echo "❌ Errore connessione database"
fi

# 5. Verifica tabelle
echo -e "\n=== VERIFICA TABELLA USER ==="
psql "postgresql://discovery_user:Lasolita123@localhost:5432/discovery_prod_db" -c "SELECT COUNT(*) as users FROM \"User\";" 2>/dev/null

# 6. Verifica se bcryptjs è installato
echo -e "\n=== VERIFICA DIPENDENZE ==="
if [ -d "node_modules/bcryptjs" ]; then
    echo "✅ bcryptjs installato"
else
    echo "❌ bcryptjs NON installato - installazione..."
    npm install bcryptjs
fi

# 7. Verifica build
echo -e "\n=== VERIFICA BUILD ==="
if [ -f "dist/server.js" ]; then
    echo "✅ Build presente"
    ls -la dist/server.js
else
    echo "❌ Build mancante - ricompilazione..."
    npm run build
fi

# 8. Applica migrazioni
echo -e "\n=== APPLICAZIONE MIGRAZIONI ==="
npx prisma migrate deploy

# 9. Rigenera Prisma Client
echo -e "\n=== RIGENERAZIONE PRISMA CLIENT ==="
npx prisma generate

# 10. Restart PM2
echo -e "\n=== RESTART PM2 ==="
pm2 restart discovery-api

# 11. Attendi e mostra nuovi log
sleep 3
echo -e "\n=== NUOVI LOG DOPO RESTART ==="
pm2 logs discovery-api --lines 20 --nostream

# 12. Test endpoint
echo -e "\n=== TEST ENDPOINT API ==="
curl -s https://discovery.cfoeducation.it/api/health || echo "❌ API non risponde"

echo -e "\n✅ Diagnosi completata!"
EOF