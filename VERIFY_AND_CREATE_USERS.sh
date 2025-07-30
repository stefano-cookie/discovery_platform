#!/bin/bash

echo "🔧 Verifica e Creazione Utenti Test"
echo "==================================="
echo ""
echo "Questo script verifica e crea gli utenti di test sul server"
echo ""
echo "1. Prima copia lo script sul server:"
echo "   scp create_test_users.js cfoeducation.it_f55qsn6wucc@94.143.138.213:/tmp/"
echo ""
echo "2. Poi connettiti:"
echo "   ssh cfoeducation.it_f55qsn6wucc@94.143.138.213"
echo "   # Password: lasolita123"
echo ""
echo "3. Esegui questi comandi:"
echo ""

cat << 'EOF'
# Vai alla directory backend
cd /var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it/backend

# Verifica utenti esistenti
echo "=== UTENTI ESISTENTI ==="
export DATABASE_URL="postgresql://discovery_user:Lasolita123@localhost:5432/discovery_prod_db"
psql "$DATABASE_URL" -c "SELECT email, role, \"isActive\", \"emailVerified\" FROM \"User\";"

# Copia lo script
cp /tmp/create_test_users.js .

# Installa bcryptjs se mancante
npm install bcryptjs

# Esegui lo script
echo -e "\n=== CREAZIONE UTENTI TEST ==="
node create_test_users.js

# Rimuovi lo script
rm create_test_users.js

# Verifica di nuovo gli utenti
echo -e "\n=== VERIFICA FINALE ==="
psql "$DATABASE_URL" -c "SELECT email, role, \"isActive\", \"emailVerified\" FROM \"User\" WHERE email IN ('admin@diamante.com', 'partner@diamante.com');"

# Test password hash
echo -e "\n=== TEST LOGIN DIRETTO ==="
cat > test_login.js << 'TESTJS'
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testLogin() {
  const user = await prisma.user.findUnique({
    where: { email: 'partner@diamante.com' }
  });
  
  if (user) {
    console.log('User trovato:', user.email);
    console.log('Password hash:', user.password.substring(0, 20) + '...');
    
    const validPassword = await bcrypt.compare('partner123', user.password);
    console.log('Password valida:', validPassword);
    
    if (!validPassword) {
      // Prova a verificare se il problema è bcrypt vs bcryptjs
      console.log('Verifica formato hash...');
      console.log('Hash inizia con $2b$?', user.password.startsWith('$2b$'));
      console.log('Hash inizia con $2a$?', user.password.startsWith('$2a$'));
    }
  } else {
    console.log('User NON trovato!');
  }
  
  await prisma.$disconnect();
}

testLogin();
TESTJS

node test_login.js
rm test_login.js

# Restart PM2
echo -e "\n=== RESTART PM2 ==="
pm2 restart discovery-api

# Verifica log
sleep 2
pm2 logs discovery-api --lines 20 --nostream | grep -v "at "

echo -e "\n✅ Verifica completata!"
EOF