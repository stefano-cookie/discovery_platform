# Discovery Platform - Documentazione Sistema

## 📝 Git Commit Guidelines

**IMPORTANT**: All git commit messages MUST be written in English.

**Commit Message Format**:
```
<type>(<scope>): <subject in English>

- bullet point 1 in English
- bullet point 2 in English

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types**: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`, `perf`

**Examples**:
- ✅ `feat(company): add cascade deletion for assigned users`
- ✅ `fix(r2): resolve multi-account document management issue`
- ❌ `feat(company): aggiunta eliminazione cascata utenti` (Italian not allowed)

---

## ✅ PRODUZIONE RIPRISTINATA - 2025-10-10

### Status Sistema

**Status**: ✅ **OPERATIVO E STABILE**

**Ultima Verifica**: 2025-10-10 10:20 CET
- ✅ **Backend API**: Running on port 3010
- ✅ **Frontend**: Operativo
- ✅ **Database**: Connesso
- ✅ **R2 Storage**: Configurato (bucket production)
- ✅ **PM2**: Processi salvati e stabili
- ⚠️ **WebSocket**: Errori JWT dopo restart (utenti devono re-login)

**Problema Risolto**: Deploy fallito aveva eliminato file `.env`, causando crash loop del backend.

### Incidente 2025-10-10
**Causa**: Deploy multipli simultanei (GitHub Actions backlog) → file `.env` eliminato → backend crash loop con `ENCRYPTION_KEY` mancante

**Risoluzione**:
1. Ripristinato `.env.production` sul server
2. Aggiornato `deploy-on-server.sh` con validazione env
3. Modificato `ecosystem.config.js` per forzare production
4. Documentato procedura in `TROUBLESHOOTING.md`

---

## 📋 Configurazione R2 Attuale (Produzione)

### Account 1 - DOCUMENTS ✅ ATTIVO
```env
CLOUDFLARE_ACCOUNT_ID=96e7e20557789c11d012aca51dc21a27
CLOUDFLARE_ACCESS_KEY_ID=d023a41ae650f8d50a9b6fae8d5fca4b
CLOUDFLARE_SECRET_ACCESS_KEY=***
CLOUDFLARE_BUCKET_NAME=discovery-documents-prod
CLOUDFLARE_ENDPOINT=https://96e7e20557789c11d012aca51dc21a27.r2.cloudflarestorage.com
```

**Utilizzo:**
- Upload documenti utente (enrollment)
- Contratti firmati
- Documenti certificazioni
- Storage primario applicazione

**Logs Verifica:**
```
[R2Factory] ✅ ACCOUNT 1 (Documents) initialized
[R2Factory]    Account ID: 96e7e20557789c11d012aca51dc21a27
[R2Factory]    Bucket: discovery-documents-prod
[R2Factory]    Environment: production
[R2Storage] Initialized - Bucket: discovery-documents-prod
[R2StorageManager] Initialized using centralized R2 factory
```

---

### Account 2 - ARCHIVE/NOTICES ✅ ATTIVO (2025-10-10)

**Status**: ✅ Configurato e operativo

**Utilizzo:**
- Notice Board attachments (upload allegati bacheca)
- Archive legacy documents
- Storage secondario applicazione

```env
R2_NOTICES_ACCOUNT_ID=11eb49867970f932827c4503411e1816
R2_NOTICES_ACCESS_KEY_ID=d8194d05713afc9cb79997710236c441
R2_NOTICES_SECRET_ACCESS_KEY=***
R2_NOTICES_ENDPOINT=https://11eb49867970f932827c4503411e1816.r2.cloudflarestorage.com
R2_NOTICES_BUCKET_NAME=notice-board-attachments
R2_NOTICES_PUBLIC_URL=https://pub-11eb49867970f932827c4503411e1816.r2.dev

R2_ARCHIVE_ACCOUNT_ID=11eb49867970f932827c4503411e1816
R2_ARCHIVE_ACCESS_KEY_ID=d8194d05713afc9cb79997710236c441
R2_ARCHIVE_SECRET_ACCESS_KEY=***
R2_ARCHIVE_ENDPOINT=https://11eb49867970f932827c4503411e1816.r2.cloudflarestorage.com
R2_ARCHIVE_BUCKET_NAME=legacy-archive-docs
R2_ARCHIVE_PUBLIC_URL=https://pub-11eb49867970f932827c4503411e1816.r2.dev
```

**Logs Verifica:**
```
[R2Factory] ✅ ACCOUNT 2 (Archive) initialized
[R2Factory]    Account ID: 11eb49867970f932827c4503411e1816
[R2Factory]    Bucket: legacy-archive-docs
[R2Factory] ✅ ACCOUNT 2 (Notices) initialized
[R2Factory]    Account ID: 11eb49867970f932827c4503411e1816
[R2Factory]    Bucket: notice-board-attachments
```

---

## 🗑️ R2 Automatic Cleanup System - 2025-10-10

### Overview
Implementato sistema di cleanup automatico per prevenire file orfani in R2 storage quando i record del database vengono eliminati.

**Problema Risolto**: File rimanevano in R2 anche dopo eliminazione dal database, causando saturazione dello spazio storage.

### Integrazione Automatica

Il servizio `R2CleanupService` è integrato nei seguenti punti di eliminazione:

1. **Notice Deletion** ([notices/index.ts](backend/src/routes/notices/index.ts#L244))
   - Elimina tutti gli allegati dalla Notice prima di eliminare il record DB
   - Account: `R2Account.NOTICES`

2. **UserDocument Deletion** ([unifiedDocumentService.ts](backend/src/services/unifiedDocumentService.ts#L474))
   - Elimina file documento da R2 prima di eliminare record DB
   - Account: `R2Account.DOCUMENTS`

3. **User Deletion** ([auth.ts](backend/src/routes/auth.ts#L1050))
   - Elimina TUTTI i documenti utente + contratti
   - Include tutti i documenti legati alle registrations
   - Account: `R2Account.DOCUMENTS`

4. **Registration Deletion** (via `DocumentCleanupService`)
   - Gestito automaticamente quando si elimina una registration
   - Elimina documenti enrollment + contratti firmati

### Service API

```typescript
import { R2CleanupService } from './services/r2CleanupService';

// Cleanup Notice attachments
await R2CleanupService.cleanupNoticeAttachments(noticeId);

// Cleanup single UserDocument
await R2CleanupService.cleanupUserDocument(documentId);

// Cleanup ALL documents for a Registration
await R2CleanupService.cleanupRegistrationDocuments(registrationId);

// Cleanup ALL documents for a User (documents + contracts)
await R2CleanupService.cleanupUserDocuments(userId);

// Cleanup Archive files
await R2CleanupService.cleanupArchiveFiles(archiveId);
```

### Manual Cleanup Script

Per file orfani esistenti (creati prima dell'implementazione):

```bash
# DRY RUN - solo visualizza file orfani
cd backend
npx ts-node scripts/cleanup-orphaned-r2-files.ts

# DELETE - elimina effettivamente i file
npx ts-node scripts/cleanup-orphaned-r2-files.ts --delete
```

### Behavior

- ✅ **Non-blocking**: Se R2 cleanup fallisce, l'eliminazione DB procede comunque
- ✅ **Idempotent**: Chiamate multiple non causano errori
- ✅ **Logged**: Ogni cleanup è loggato nei backend logs
- ✅ **Batch support**: Supporta eliminazione batch per performance

### File Paths Gestiti

```
R2Account.DOCUMENTS:
  - documents/{userId}/{type}/{filename}
  - contracts/{registrationId}/{filename}

R2Account.NOTICES:
  - notices/{filename}

R2Account.ARCHIVE:
  - archive/{filename}
```

---

## 🔧 Comandi Utili Server Produzione

### SSH Access
```bash
# Metodo 1: SSH con password (usa sshpass per automazione)
sshpass -p 'lasolita123' ssh cfoeducation.it_f55qsn6wucc@cfoeducation.it

# Metodo 2: SSH con tunnel
ssh -L 7777:localhost:7777 cfoeducation.it_f55qsn6wucc@cfoeducation.it

# Nota: SSH può essere temporaneamente inaccessibile se server saturo da deploy falliti
# Soluzione: Attendere 2-5 minuti e riprovare con retry automatico
```

---

## ⚠️ Problemi Noti e Soluzioni

### WebSocket: JWT Invalid Signature

**Sintomo**: Errori nei logs partner/admin dashboard
```
[WebSocket] Authentication error: JsonWebTokenError: invalid signature
[WebSocket] Connection error: { code: 1, message: 'Session ID unknown' }
```

**Causa**: Dopo restart del backend, i token JWT esistenti sono firmati con il vecchio `JWT_SECRET` e non sono più validi.

**Soluzione**:
- **Utenti devono fare LOGOUT e RE-LOGIN** per ottenere nuovi token
- Oppure: Clearare i cookie del browser per `discovery.cfoeducation.it`

**Prevenzione**:
- Non modificare mai `JWT_SECRET` in produzione senza notificare gli utenti
- Il file `.env.production` sul server deve rimanere stabile

### PM2 Management
```bash
# Lista processi
pm2 list

# Logs in tempo reale
pm2 logs discovery-backend

# Restart applicazione
pm2 restart discovery-backend

# Stop applicazione
pm2 stop discovery-backend

# Start applicazione
cd ~/discovery.cfoeducation.it/backend
pm2 start dist/server.js --name discovery-backend --env production

# Salva configurazione PM2
pm2 save
```

### Verifica R2 Configuration
```bash
# Verifica variabili R2
cat ~/discovery.cfoeducation.it/backend/.env | grep CLOUDFLARE

# Verifica logs R2
pm2 logs discovery-backend --lines 50 | grep -i r2

# Verifica uploads recenti
ls -lht ~/discovery.cfoeducation.it/backend/uploads | head -10
```

---

## 📚 Struttura File Produzione

```
~/discovery.cfoeducation.it/
├── backend/
│   ├── .env                    # Configurazione attiva
│   ├── .env.production         # Template produzione
│   ├── dist/                   # Build compilato
│   │   └── server.js          # Entry point
│   ├── src/                    # Codice sorgente
│   ├── uploads/                # Upload temporanei locali
│   └── package.json
└── frontend/
    └── build/                  # Build frontend statico
```

---

## 🎯 Checklist Deployment

### Pre-Deployment
- [ ] Testare build locale: `npm run build`
- [ ] Verificare variabili .env produzione
- [ ] Committare modifiche a Git

### Deployment
- [ ] Push codice a repository
- [ ] SSH su server produzione
- [ ] Pull ultimo codice: `git pull`
- [ ] Install dipendenze: `npm install`
- [ ] Build applicazione: `npm run build`
- [ ] Restart PM2: `pm2 restart discovery-backend`
- [ ] Verificare logs: `pm2 logs`

### Post-Deployment
- [ ] Testare upload documenti
- [ ] Verificare logs errori R2
- [ ] Confermare applicazione responsive

---

## 🔐 Credenziali e Accessi

### Database Produzione
```env
DATABASE_URL=postgresql://discovery_user:Lasolita123@localhost:5432/discovery_prod_db
```

### Email Service
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=stebbijpriolo@gmail.com
```

### Cloudflare R2
- Dashboard: https://dash.cloudflare.com/96e7e20557789c11d012aca51dc21a27/r2
- Account: stefanojpriolo@gmail.com
- Bucket: discovery-documents-prod

---

**Versione**: 10.0.0
**Branch**: master
**Ultima verifica**: 2025-10-09 12:40 CET
**Status**: ✅ Produzione Operativa
