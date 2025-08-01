# CLAUDE.md - Piattaforma Diamante

## 🚨 PROBLEMI CRITICI DA RISOLVERE - PRIORITÀ ALTA

### 🔴 **1. SICUREZZA - Accesso Dati Utenti** (CRITICO)
**Problema**: Nel form iscrizione post-verifica email, inserendo email di altri utenti si accede ai loro dati
**Soluzione**: 
- ⬜ Implementare sistema con codice univoco post-verifica email
- ⬜ Rimuovere campo email dal form post-verifica
- ⬜ Associare token/codice alla sessione utente verificata

### 🔴 **2. CONTRATTI - Sistema Non Funzionante**
**Problemi**:
- ⬜ Anteprima contratto precompilato non funziona
- ⬜ Download contratto precompilato non funziona  
- ⬜ Upload contratto firmato non funziona
**Azioni**: Debug completo sistema contratti con verifica API endpoints

### 🟡 **3. DOCUMENTI - Sincronizzazione Area Utente**
**Problemi**:
- ⬜ Documenti caricati in iscrizione non visibili in "I miei documenti"
- ⬜ Errore caricamento documenti da area riservata
- ⬜ Validazione formato file mostra messaggio generico
**Soluzione**: Sincronizzare documenti iscrizione con area utente

---

## 🎯 ARCHITETTURA SISTEMA

### 🔄 FLUSSO REGISTRAZIONE E ISCRIZIONE - DA AGGIORNARE

**IMPORTANTE**: Il sistema separa completamente la registrazione utente (creazione profilo) dall'iscrizione ai corsi.

#### 🔧 **Registrazione Utente** - Da Modificare
- Partner invia link referral → popup registrazione → form dati completi
- Sistema crea profilo con partner permanente + email verifica
- ⬜ **NUOVO**: Post-verifica genera codice univoco per accesso form iscrizione
- ⬜ **SICUREZZA**: Form iscrizione richiede codice invece di email

#### 🔧 **Iscrizione Corso** - Da Aggiornare
- ⬜ Utenti accedono con codice univoco (non email)
- ⬜ Form TFA: aggiungere blocco informazioni diploma
- ⬜ Select università/corsi con filtro testuale
- ⬜ Rimuovere "tipo laurea triennale" quando selezionata magistrale
- ⬜ Aggiungere campi voto laurea (opzionali)
- ⬜ Aggiungere corsi vecchio ordinamento

#### ✅ **Sistema Multi-Offerta** - Implementato
- **TFA Romania**: Form completo + pagamenti fissi/personalizzati
- **Certificazioni**: Form ridotto + solo pagamenti personalizzati
- Partner configura offerte con piani rate flessibili

---

## 🎨 PANNELLO PARTNER - AGGIORNAMENTI NECESSARI

### 📊 **Dashboard Partner**

#### 🔄 **Iscrizioni Recenti** - COMPLETATO
- ✅ **Sezione rinominata**: Da "Attività recenti" a "Iscrizioni recenti"
- ✅ **Info corso aggiunta**: Mostra il corso relativo all'iscrizione
- ✅ **Card cliccabili**: Click su card → dettaglio utente completo
- ✅ **Link "Vedi tutto"**: Porta alla gestione utenti completa

### 👥 **Gestione Utenti - Da Aggiornare**

#### 📄 **Pagina Dettaglio Iscrizione** - MODIFICHE NECESSARIE

##### 🔧 **Workflow Stati - Da Modificare**
- ⬜ **Primo step**: Rinominare da "Iscrizione completata" a "Iscrizione eseguita"
- ⬜ **Piano pagamento**: Aggiungere scadenze rate visibili
- ⬜ **Rimuovere**: Blocco sincronizzazione (non necessario)

##### 🎓 **Workflow Certificazioni - Da Implementare**
Stati specifici per template Certificazioni:
1. ⬜ Iscrizione completata
2. ⬜ Pagamento completato  
3. ⬜ Iscritto all'esame (con data inserita manualmente da operatore)

##### 📑 **Sistema Contratti** - DA RIPARARE
**Problemi identificati**:
- ⬜ Fix download contratto precompilato
- ⬜ Fix anteprima contratto
- ⬜ Fix upload contratto firmato
- ⬜ Verificare API endpoints e permessi

##### 📄 **Gestione Documenti Partner** - NUOVO
- ⬜ **CNRed**: Partner può caricare, non visibile a utente
- ⬜ **Adverintia**: Partner può caricare, non visibile a utente
- ⬜ **Card notifica**: Card colorata quando documenti caricati
- ⬜ **Verifica documenti**: Partner approva/rifiuta documenti utente
- ⬜ **Email notifica**: Invio automatico se documento rifiutato

---

## 🧑‍💼 AREA RISERVATA UTENTE - MODIFICHE

### 📁 **Gestione Documenti** - Da Fixare
- ⬜ **Sincronizzazione**: Mostrare documenti caricati in iscrizione
- ⬜ **Fix upload**: Risolvere errore caricamento documenti
- ⬜ **Validazione**: Messaggio specifico "Il file è di un formato non supportato"
- ⬜ **Stati documento**: Pending/Approvato/Rifiutato dal partner

### 💳 **Piano Pagamenti** - Da Aggiornare
- ⬜ **Scadenze dinamiche**: 
  - Acconto: 7 giorni da iscrizione
  - Prima rata: 30 giorni dopo scadenza acconto
  - Rate successive: sempre al 30 del mese
- ⬜ Non mostrare piano rate dopo selezione piano personalizzato

---

## 📊 Database Schema Aggiornamenti Necessari

```prisma
// Modifiche al modello Registration
model Registration {
  // ... campi esistenti ...
  
  // Sicurezza accesso
  verificationCode        String?   @unique // Codice univoco post-verifica
  codeExpiresAt          DateTime? // Scadenza codice
  
  // Contratti
  contractTemplateUrl     String?   
  contractSignedUrl       String?   
  contractGeneratedAt     DateTime? 
  contractUploadedAt      DateTime? 
  
  // Documenti partner (non visibili a utente)
  cnredUrl               String?
  cnredUploadedAt        DateTime?
  adverintiaUrl          String?
  adverintiaUploadedAt   DateTime?
  
  // Stati workflow estesi
  status                  RegistrationStatus @default(PENDING)
  statusHistory           StatusChange[]
  
  // Certificazioni - data esame
  examDate               DateTime? // Per workflow certificazioni
  examRegisteredBy       String?   // Partner che registra data
  
  // ... relazioni esistenti ...
}

// Nuovo modello per gestione documenti utente
model UserDocument {
  id              String   @id @default(uuid())
  userId          String
  registrationId  String?
  type            String   // CI, Diploma, etc
  url             String
  status          DocumentStatus @default(PENDING)
  verifiedBy      String?  // Partner che verifica
  verifiedAt      DateTime?
  rejectionReason String?
  uploadedAt      DateTime @default(now())
  
  user            User @relation(fields: [userId], references: [id])
  registration    Registration? @relation(fields: [registrationId], references: [id])
}

enum DocumentStatus {
  PENDING
  APPROVED
  REJECTED
}

// Aggiornamento FormData per diploma
model FormData {
  // ... campi esistenti ...
  
  // Informazioni diploma (TFA)
  diplomaDate          DateTime?
  diplomaCity          String?
  diplomaProvince      String?
  diplomaInstitute     String?
  diplomaGrade         String?
  
  // Voti laurea
  bachelorGrade        String?
  masterGrade          String?
}
```

---

## 🚀 TASK PRIORITARIE - SPRINT IMMEDIATO

### 🔴 **Sprint 1 - Sicurezza e Contratti** (CRITICO)
1. ⬜ Implementare sistema codice univoco post-verifica email
2. ⬜ Debug e fix sistema contratti (download/upload)
3. ⬜ Fix validazione formato file con messaggi specifici

### 🟡 **Sprint 2 - Form Iscrizione**
1. ⬜ Aggiungere blocco informazioni diploma (TFA)
2. ⬜ Implementare select con filtro testuale per università/corsi
3. ⬜ Fix logica selezione laurea magistrale/triennale
4. ⬜ Aggiungere campi voto laurea opzionali
5. ⬜ Integrare corsi vecchio ordinamento

### 🟡 **Sprint 3 - Pannello Partner**
1. ⬜ Rinominare primo step workflow
2. ⬜ Aggiungere scadenze rate nel piano pagamento
3. ⬜ Implementare workflow certificazioni con data esame
4. ⬜ Sistema upload CNRed/Adverintia
5. ⬜ Verifica/rifiuto documenti con notifiche

### 🟢 **Sprint 4 - Area Utente**
1. ⬜ Sincronizzare documenti iscrizione con area utente
2. ⬜ Fix errore upload documenti
3. ⬜ Implementare stati documento (pending/approved/rejected)
4. ⬜ Aggiornare calcolo scadenze pagamenti

---

## 🔧 API Endpoints Da Implementare/Fixare

### Partner Routes (`/api/partners`)
```typescript
// 🔴 DA FIXARE
GET /download-contract/:registrationId
POST /upload-signed-contract

// 🟡 DA IMPLEMENTARE
POST /registrations/:id/documents/cnred
POST /registrations/:id/documents/adverintia
POST /registrations/:id/verify-document
POST /registrations/:id/reject-document
POST /registrations/:id/exam-date

// ✅ FUNZIONANTI
GET /registrations/:registrationId
GET /registrations/:registrationId/documents
GET /stats
GET /recent-users
```

### User Routes (`/api/users`)
```typescript
// 🟡 DA IMPLEMENTARE
POST /verify-code // Verifica codice accesso form
GET /documents/all // Include documenti da iscrizione
POST /documents/upload // Con validazione migliorata
```

### Auth Routes (`/api/auth`)
```typescript
// 🟡 DA MODIFICARE
POST /verify-email // Deve generare codice univoco
```

---

## 📁 Struttura File Frontend - MODIFICHE NECESSARIE

```
frontend/src/components/
├── Enrollment/
│   ├── EnrollmentForm.tsx       🔧 Sostituire email con codice
│   ├── EducationFields.tsx      🔧 Aggiungere filtro testuale
│   ├── DiplomaFields.tsx        🟡 NUOVO - Info diploma
│   └── PaymentPlanDisplay.tsx   🔧 Non mostrare per personalizzato
├── Partner/
│   ├── EnrollmentDetail/
│   │   ├── EnrollmentFlow.tsx   🔧 Fix stati e workflow
│   │   ├── ContractSection.tsx  🔴 Fix download/upload
│   │   ├── DocumentVerify.tsx   🟡 NUOVO - Verifica docs
│   │   └── PartnerDocs.tsx      🟡 NUOVO - CNRed/Adverintia
│   └── UserManagement/
│       └── PaymentSchedule.tsx  🔧 Mostrare scadenze rate
└── User/
    └── Documents/
        ├── DocumentList.tsx      🔧 Includere docs iscrizione
        └── DocumentUpload.tsx    🔧 Fix validazione
```

---

## 🚀 Quick Start

```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run dev

# Frontend (nuovo terminale)
cd frontend
npm install
npm start
```

## 🌐 URLs e Credenziali

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001/api
- **Admin**: admin@diamante.com / admin123
- **Partner**: partner@diamante.com / partner123

---

## 📊 METRICHE PROGETTO

### 🔴 **Problemi Critici**: 3
- Sicurezza accesso dati
- Sistema contratti non funzionante
- Sincronizzazione documenti

### 🟡 **Miglioramenti Necessari**: 15+
- Form iscrizione (6 modifiche)
- Pannello partner (5 modifiche)
- Area utente (4 modifiche)

### ✅ **Funzionalità Complete**: 
- Dashboard base
- Sistema coupon
- Registrazione/login
- Gestione offerte

---

*⚠️ ATTENZIONE: Risolvere prima i problemi di sicurezza e contratti prima di procedere con altre implementazioni.*