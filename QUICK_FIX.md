# 🚨 QUICK FIX - Risoluzione Problema Login

## Comandi da eseguire SUBITO:

### 1. Connettiti al server:
```bash
ssh cfoeducation.it_f55qsn6wucc@94.143.138.213
# Password: lasolita123
```

### 2. Una volta connesso, esegui questi comandi in sequenza:

```bash
# Vai alla directory backend
cd /var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it/backend

# Verifica se il file .env esiste
ls -la .env

# Se NON esiste, crealo copiando da .env.production
cp .env.production .env

# Se neanche .env.production esiste, crea .env manualmente:
cat > .env << 'EOF'
NODE_ENV=production
DATABASE_URL="postgresql://discovery_user:Lasolita123@localhost:5432/discovery_prod_db"
JWT_SECRET=your-very-secret-jwt-key-here-change-in-production
PORT=3010
HOST=localhost
FRONTEND_URL=https://discovery.cfoeducation.it
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password
EMAIL_FROM=noreply@cfoeducation.it
EOF

# Applica migrazioni database
export DATABASE_URL="postgresql://discovery_user:Lasolita123@localhost:5432/discovery_prod_db"
npx prisma migrate deploy

# Rigenera Prisma Client
npx prisma generate

# Ricompila il backend (se necessario)
npm run build

# Riavvia PM2
pm2 restart discovery-api

# Controlla i log
pm2 logs discovery-api --lines 50
```

### 3. Verifica che ci siano utenti nel database:

```bash
psql "postgresql://discovery_user:Lasolita123@localhost:5432/discovery_prod_db" -c "SELECT email, role FROM \"User\" LIMIT 5;"
```

### 4. Se NON ci sono utenti, ricrea l'admin:

```bash
# Crea uno script temporaneo per aggiungere admin
cat > create_admin.js << 'EOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const admin = await prisma.user.create({
      data: {
        email: 'admin@diamante.com',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });
    
    console.log('Admin creato:', admin.email);
  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
EOF

# Esegui lo script
node create_admin.js

# Rimuovi lo script
rm create_admin.js
```

### 5. Test finale:

```bash
# Verifica che l'API risponda
curl https://discovery.cfoeducation.it/api/health

# Controlla di nuovo i log
pm2 logs discovery-api --lines 20
```

## 🎯 Dopo questi comandi dovresti poter fare login con:
- **Email**: admin@diamante.com
- **Password**: admin123

## ⚠️ Se ancora non funziona:

1. Controlla i log per errori specifici: `pm2 logs discovery-api`
2. Verifica che la porta 3010 sia in ascolto: `netstat -tlnp | grep 3010`
3. Controlla il proxy Apache: `cat /etc/apache2/sites-available/discovery.cfoeducation.it.conf`