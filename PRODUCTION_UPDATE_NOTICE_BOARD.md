# 🚀 Aggiornamento Produzione: Notice Board con Rich Text Editor

## 📋 Riepilogo Modifiche

Merge del branch `feat/notice-board` in `master` - aggiunta funzionalità rich text editor e allegati al sistema Bacheca.

### Nuove Funzionalità
- **Rich Text Editor** con formattazione avanzata (grassetto, corsivo, liste, link, immagini)
- **Upload allegati multipli** per i post della bacheca
- **Rendering HTML** dei contenuti formattati

---

## ✅ Pre-Deploy Checklist

### 1. Variabili Ambiente (`.env.production`)

**✅ Nessuna nuova variabile richiesta** - La configurazione esistente è sufficiente.

Le credenziali R2 esistenti verranno utilizzate per salvare gli allegati:
```bash
CLOUDFLARE_ACCOUNT_ID="96e7e20557789c11d012aca51dc21a27"
CLOUDFLARE_ACCESS_KEY_ID="d023a41ae650f8d50a9b6fae8d5fca4b"
CLOUDFLARE_SECRET_ACCESS_KEY="4f06ca6eb449c17ccffbda239a3e5a3f4f1ea9390a257b964bff0c9f4e763760"
CLOUDFLARE_BUCKET_NAME="discovery-documents-prod"
CLOUDFLARE_ENDPOINT="https://96e7e20557789c11d012aca51dc21a27.r2.cloudflarestorage.com"
```

### 2. Migrazioni Database

**Due nuove migration da eseguire**:
- `20251006132345_add_notice_board_system` - Sistema Notice Board base
- `20251006135527_add_notice_attachments_and_html` - Campi `contentHtml` e `attachments`

```bash
cd /var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it/backend
npx prisma migrate deploy
```

### 3. Nuove Dipendenze

**Backend** (`backend/package.json`):
```json
{
  "form-data": "^4.0.4",
  "node-fetch": "^2.7.0"
}
```

**Frontend** (`frontend/package.json`):
```json
{
  "@tiptap/extension-image": "^3.6.5",
  "@tiptap/extension-link": "^3.6.5",
  "@tiptap/react": "^3.6.5",
  "@tiptap/starter-kit": "^3.6.5"
}
```

---

## 🔧 Procedura Deploy

### Step 1: Backup Database
```bash
pg_dump -U discovery_user -d discovery_prod_db > backup_pre_notice_board_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Pull Codice
```bash
cd /var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it
git pull origin master
```

### Step 3: Install Dipendenze Backend
```bash
cd backend
npm install
npx prisma generate
npm run build
```

### Step 4: Esegui Migrazioni
```bash
npx prisma migrate deploy
```

**Output atteso**:
```
The following migration(s) have been applied:
migrations/
  └─ 20251006132345_add_notice_board_system/
     └─ migration.sql
  └─ 20251006135527_add_notice_attachments_and_html/
     └─ migration.sql
```

### Step 5: Install Dipendenze Frontend
```bash
cd ../frontend
npm install
npm run build
```

### Step 6: Restart Server
```bash
pm2 restart discovery-backend
pm2 restart discovery-frontend  # se usato
```

### Step 7: Verifica Deploy
```bash
# Check backend
curl https://discovery.cfoeducation.it/api/notices

# Check frontend build
ls -lh ../frontend/build/static/js/main.*.js
```

---

## 🧪 Test Post-Deploy

### Test 1: Accesso Bacheca
1. Login come ADMIN
2. Vai su `/admin/notices`
3. ✅ Verifica caricamento pagina senza errori

### Test 2: Creazione Post con Rich Text
1. Click "Nuovo Post"
2. Prova formattazione testo (grassetto, liste, link)
3. ✅ Verifica preview HTML rendering

### Test 3: Upload Allegato
1. Nella form post, click "Allega File"
2. Seleziona file (PDF, immagine, doc)
3. ✅ Verifica upload su R2 bucket
4. ✅ Verifica URL allegato salvato in DB

### Test 4: Visualizzazione Partner
1. Login come Partner
2. Vai su `/dashboard` → tab "Bacheca"
3. ✅ Verifica visualizzazione post con HTML
4. ✅ Verifica download allegati funzionante

---

## 🛡️ Bucket R2 Configuration

Gli allegati verranno salvati nel bucket esistente:
- **Bucket**: `discovery-documents-prod`
- **Path**: `notices/attachments/{filename}`
- **Public Access**: Configurato automaticamente dal codice esistente

**Verifica bucket setup**:
```bash
# Da backend/
node -e "
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const client = new S3Client({
  region: 'auto',
  endpoint: 'https://96e7e20557789c11d012aca51dc21a27.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: 'd023a41ae650f8d50a9b6fae8d5fca4b',
    secretAccessKey: '4f06ca6eb449c17ccffbda239a3e5a3f4f1ea9390a257b964bff0c9f4e763760'
  }
});
client.send(new ListBucketsCommand({})).then(console.log);
"
```

---

## ⚠️ Note Importanti

### Security
- Upload allegati **solo per ADMIN** (middleware `isAdmin`)
- Max file size: **10MB** (configurabile in `upload.ts`)
- Tipi file ammessi: PDF, immagini, documenti (verificare `ALLOWED_MIME_TYPES`)

### Performance
- Rich text editor aggiunge **~150KB** al bundle frontend
- Build size: **792KB** (gzipped) - accettabile per funzionalità
- Considera implementare code splitting se bundle supera 1MB

### Backward Compatibility
- Vecchia tabella `ChatConversation` **non toccata** - rimane per storico
- Campo `content` (plain text) mantenuto per fallback
- Tutte le API esistenti **non modificate**

---

## 🆘 Rollback Plan

Se deploy fallisce:

### Rollback Codice
```bash
cd /var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it
git reset --hard HEAD~1
cd backend && npm install && npm run build
cd ../frontend && npm install && npm run build
pm2 restart all
```

### Rollback Database
```bash
# Le migrazioni Prisma non supportano rollback automatico
# Usare backup SQL:
psql -U discovery_user -d discovery_prod_db < backup_pre_notice_board_YYYYMMDD_HHMMSS.sql
```

---

## 📊 Monitoring

### Log da Monitorare
```bash
# Backend logs
pm2 logs discovery-backend --lines 100

# Cerca errori upload R2
grep "R2Storage" ~/.pm2/logs/discovery-backend-error.log

# Cerca errori notice routes
grep "notices" ~/.pm2/logs/discovery-backend-error.log
```

### Metriche
- Upload allegati: verificare latency < 2s
- Rendering rich text: verificare no layout shift
- Statistiche lettura: verificare query performance

---

## ✅ Test Locali Completati

- ✅ Backend build: SUCCESS
- ✅ Backend startup: SUCCESS (server avviato correttamente)
- ✅ Frontend build: SUCCESS (con warnings minori non bloccanti)
- ✅ Database migration: GIÀ APPLICATA in dev
- ✅ Merge master: COMPLETATO (commit `889aae9`)

---

## 📞 Supporto

In caso di problemi durante il deploy:

1. **Controllare logs PM2**: `pm2 logs discovery-backend`
2. **Verificare connessione R2**: test con script Node sopra
3. **Controllare migration status**: `npx prisma migrate status`
4. **Rollback se critico**: seguire "Rollback Plan"

---

**Preparato**: 2025-10-06
**Branch**: `feat/notice-board` → `master`
**Commit**: `889aae9`
**Testato**: ✅ Ambiente locale
