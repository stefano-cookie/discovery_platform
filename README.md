# Piattaforma Diamante

Sistema di gestione iscrizioni per corsi con gestione partner e commissioni multi-livello.

## Architettura

- **Backend**: Node.js + Express + TypeScript + Prisma
- **Frontend**: React + TypeScript + TailwindCSS
- **Database**: PostgreSQL
- **Auth**: JWT

## Setup

```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run dev

# Frontend
cd frontend
npm install
npm start
```

## Funzionalità

- Sistema multi-partner con commissioni a livelli
- Form multi-step per registrazione utenti
- Upload documenti
- Gestione pagamenti e scadenze
- Dashboard partner
- Chat integrata (Telegram)

## 🚀 Deploy Semplice

### ✅ Setup Iniziale Server (Una volta sola)

```bash
# Sul server (via SSH o console IONOS)
cd /var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it
git clone https://github.com/stefano-cookie/discovery_platform.git .
cd frontend && npm install
```

### 🔄 Deploy Automatico

Ogni push su `master` esegue automaticamente:

```bash
git add .
git commit -m "your changes"  
git push origin master
```

**Cosa succede automaticamente:**
1. GitHub Actions si connette al server via SSH
2. Esegue `git pull origin master`
3. Fa `npm ci && npm run build` del frontend
4. Sito aggiornato!

### 🔧 Deploy Manuale (se serve)

```bash
# Sul server
cd /var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it
git pull origin master
cd frontend && npm run build
```

### 🌐 Verifica

- **Sito**: https://discovery.cfoeducation.it
- **Test**: Cerca il banner blu di deploy

### 📋 Setup Secrets GitHub

Repository → Settings → Secrets → Actions:
- `SERVER_HOST`: 94.143.138.213  
- `SERVER_USER`: root (o utente server)
- `SERVER_SSH_KEY`: Chiave privata SSH