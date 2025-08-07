# 📄 Document System Deployment Guide

## ⚠️ REQUISITI CRITICI PRE-DEPLOY

### 1. Directory Structure
Il sistema documenti richiede queste directory sul server:
```
/var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it/backend/uploads/
├── contracts/              # Contratti generati
├── signed-contracts/       # Contratti firmati caricati
├── documents/
│   └── user-uploads/       # Documenti caricati da utenti
├── registrations/          # Documenti per registrazione
└── temp-enrollment/        # File temporanei durante iscrizione
```

### 2. Permessi File System
```bash
# Sul server
chmod -R 755 /var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it/backend/uploads
```

### 3. Database Schema
Verificare che le tabelle siano create:
- `UserDocument` (nuovo sistema unificato)
- Campi aggiunti a `Registration` (contractTemplateUrl, contractSignedUrl, etc.)

### 4. PDF Worker
Il file `pdf.worker.min.js` deve essere presente in `/public/` per l'anteprima PDF.

## 🚀 PROCESSO DEPLOY

### Deploy Automatico (Raccomandato)
```bash
git add .
git commit -m "feat: document system improvements"
git push origin master
```

### Deploy Manuale
```bash
# 1. Build locale
cd frontend && npm run build
cd ../backend && npm run build

# 2. Sync al server
rsync -avz --exclude='node_modules' --exclude='.git' \
  --exclude='backend/uploads/*' \
  ./ user@server:/var/www/vhosts/.../discovery_platform_temp/

# 3. Deploy sul server
ssh user@server 'cd /var/www/.../discovery_platform_temp && bash deploy-on-server.sh'
```

## ✅ VERIFICA POST-DEPLOY

### 1. Esegui script di verifica
```bash
ssh user@server
bash verify-deployment.sh
```

### 2. Test manuali
- [ ] Login come partner
- [ ] Vai a dettaglio registrazione
- [ ] Testa anteprima contratto
- [ ] Testa download contratto
- [ ] Testa upload contratto firmato
- [ ] Verifica area documenti utente

### 3. Check logs
```bash
# Su server
pm2 logs discovery-api
tail -f /var/www/.../backend/logs/combined.log
```

## 🔧 TROUBLESHOOTING

### Problema: Anteprima PDF non funziona
```bash
# Verifica worker
curl -I https://discovery.cfoeducation.it/pdf.worker.min.js
# Se 404, copia il file
cp frontend/public/pdf.worker.min.js /var/www/.../discovery.cfoeducation.it/
```

### Problema: Upload documenti fallisce
```bash
# Verifica permessi
ls -la /var/www/.../backend/uploads/
chmod -R 755 /var/www/.../backend/uploads/
```

### Problema: Database errors
```bash
cd /var/www/.../backend/
npx prisma db push
npx prisma generate
```

### Problema: Contratti non generabili
```bash
# Verifica Puppeteer
npm install puppeteer --unsafe-perm=true
# O usa Chrome headless system
apt-get install chromium-browser
```

## 📋 CHECKLIST DEPLOY

Pre-deploy:
- [ ] Test sistema documenti in locale
- [ ] Verifica build frontend/backend senza errori
- [ ] Backup database produzione
- [ ] Verifica spazio disco server (documenti occupano spazio)

Post-deploy:
- [ ] Eseguito `verify-deployment.sh`
- [ ] Test upload documento
- [ ] Test anteprima contratto
- [ ] Test download contratto
- [ ] Verifica logs senza errori
- [ ] Test da mobile/diversi browser

## 🗄️ MIGRAZIONE DATI

Se necessario migrare documenti esistenti:
```bash
# Sul server
cd /var/www/.../backend/
node migrate_documents.js
```

## 📊 MONITORING

Metriche da monitorare:
- Dimensione directory `/uploads/`
- Errori upload in logs
- Performance generazione PDF
- Spazio disco disponibile
- Memory usage (Puppeteer consuma RAM)

## 🔒 SECURITY

Verifiche di sicurezza:
- [ ] File upload limitati per tipo MIME
- [ ] Directory uploads non accessibili via web
- [ ] Token JWT per accesso documenti
- [ ] Sanitizzazione nomi file
- [ ] Limiti dimensione upload (10MB)