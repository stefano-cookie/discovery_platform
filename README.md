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