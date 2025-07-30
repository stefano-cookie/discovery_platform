#!/bin/bash

echo "🔧 FIX Errore 500 - Problema bcrypt/bcryptjs"
echo "==========================================="
echo ""
echo "PROBLEMA IDENTIFICATO: Il codice usa 'bcrypt' ma probabilmente è installato 'bcryptjs'"
echo ""
echo "Connettiti al server ed esegui questi comandi:"
echo ""
echo "ssh cfoeducation.it_f55qsn6wucc@94.143.138.213"
echo "# Password: lasolita123"
echo ""
echo "Poi esegui:"
echo ""

cat << 'EOF'
# 1. Vai alla directory backend
cd /var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it/backend

# 2. Verifica quale libreria è installata
echo "=== VERIFICA LIBRERIE BCRYPT ==="
ls -la node_modules | grep bcrypt

# 3. Installa entrambe per sicurezza
echo -e "\n=== INSTALLAZIONE DIPENDENZE ==="
npm install bcrypt bcryptjs

# 4. Verifica quale import è usato nel codice
echo -e "\n=== VERIFICA IMPORT NEL CODICE ==="
grep -r "from 'bcrypt" src/ | head -5

# 5. FIX RAPIDO: Crea un alias simbolico
echo -e "\n=== CREAZIONE ALIAS (FIX TEMPORANEO) ==="
cd node_modules
if [ -d "bcryptjs" ] && [ ! -d "bcrypt" ]; then
    ln -s bcryptjs bcrypt
    echo "✅ Alias creato: bcrypt -> bcryptjs"
fi
cd ..

# 6. Ricompila il progetto
echo -e "\n=== RICOMPILAZIONE ==="
npm run build

# 7. Restart PM2
echo -e "\n=== RESTART SERVIZIO ==="
pm2 restart discovery-api

# 8. Mostra log per verificare
sleep 2
echo -e "\n=== VERIFICA LOG ==="
pm2 logs discovery-api --lines 30 --nostream

# 9. Test login endpoint
echo -e "\n=== TEST LOGIN ENDPOINT ==="
curl -X POST https://discovery.cfoeducation.it/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\n✅ Fix completato!"
echo ""
echo "Se ancora non funziona, potrebbe essere necessario:"
echo "1. Modificare il codice sorgente per usare bcryptjs invece di bcrypt"
echo "2. Verificare che JWT_SECRET sia impostato nel file .env"
EOF

echo ""
echo "=== ALTERNATIVA: Fix permanente nel codice ==="
echo ""
echo "Se il problema persiste, modifica backend/src/routes/auth.ts:"
echo "Cambia: import bcrypt from 'bcrypt';"
echo "In:     import bcrypt from 'bcryptjs';"