# Implementazione Two-Factor Authentication (2FA) - Partner Employees

## ✅ Completato

### 1. Database Schema
- ✅ Aggiunti campi 2FA a `PartnerEmployee`:
  - `twoFactorEnabled`: Boolean flag
  - `twoFactorSecret`: Encrypted TOTP secret (AES-256-GCM)
  - `twoFactorBackupCodes`: Array JSON di recovery codes hashati
  - `twoFactorVerifiedAt`: Timestamp prima attivazione
  - Security tracking: `lastFailedTwoFactorAt`, `failedTwoFactorAttempts`, `twoFactorLockedUntil`

- ✅ Creati nuovi model:
  - `TwoFactorSession`: Sessioni temporanee (5 minuti) post-password
  - `TwoFactorAuditLog`: Log completo di tutte le azioni 2FA
  - `TwoFactorAction` enum: ENABLED, DISABLED, VERIFIED, FAILED, RECOVERY_USED, LOCKED, UNLOCKED, BACKUP_GENERATED

### 2. Backend Services

#### `src/utils/encryption.ts`
- ✅ Encryption/decryption AES-256-GCM per TOTP secrets
- ✅ Key derivation con scrypt
- ✅ Formato: `encrypted:iv:authTag`
- ✅ Validazione ENCRYPTION_KEY

#### `src/services/twoFactorService.ts`
Funzioni implementate:
- ✅ `generateTwoFactorSetup()`: Genera QR code, secret, recovery codes
- ✅ `verifyAndEnableTwoFactor()`: Attiva 2FA dopo verifica primo codice
- ✅ `verifyTwoFactorCode()`: Verifica TOTP durante login
- ✅ `verifyRecoveryCode()`: Verifica e consuma recovery code
- ✅ `createTwoFactorSession()`: Crea sessione temporanea post-password
- ✅ `verifyTwoFactorSession()`: Valida sessione temporanea
- ✅ `markSessionVerified()`: Marca sessione come completata
- ✅ `regenerateRecoveryCodes()`: Rigenera recovery codes
- ✅ `disableTwoFactor()`: Disabilita 2FA
- ✅ `cleanupExpiredSessions()`: Pulizia sessioni scadute (cron)
- ✅ `getTwoFactorStatus()`: Stato 2FA utente

Configurazione:
```typescript
{
  SECRET_LENGTH: 32,
  RECOVERY_CODES_COUNT: 10,
  RECOVERY_CODE_LENGTH: 8,
  BCRYPT_SALT_ROUNDS: 10,
  TOTP_WINDOW: 2, // ±60 secondi
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
  SESSION_DURATION_MINUTES: 5,
}
```

### 3. API Endpoints

#### Partner Employee Routes (`/api/auth/2fa/*`)
- ✅ `POST /setup`: Inizia setup 2FA (genera QR + secret + recovery codes)
- ✅ `POST /verify-setup`: Conferma setup con primo codice
- ✅ `POST /verify`: Verifica codice TOTP durante login
- ✅ `POST /recovery`: Login con recovery code
- ✅ `GET /status`: Ottieni stato 2FA corrente
- ✅ `POST /regenerate-backup`: Rigenera recovery codes (richiede password)
- ✅ `DELETE /disable`: Disabilita 2FA (richiede codice corrente)
- ✅ `GET /audit-logs`: Log audit personale

#### Admin Routes (TODO: Aggiungere autenticazione)
- ✅ `GET /admin/status`: Statistiche 2FA tutti i partner
- ✅ `POST /admin/force-reset/:employeeId`: Reset forzato emergenza

### 4. Login Flow Integrato

#### File modificato: `src/routes/auth.ts`
Flusso per PartnerEmployee:
1. Verifica email/password
2. **Se 2FA non configurato** → Risposta `requires2FASetup: true`
3. **Se 2FA abilitato** → Crea `TwoFactorSession`, risponde `requires2FA: true` + `sessionToken`
4. Frontend chiede codice 2FA
5. Verifica codice via `/api/auth/2fa/verify` con `sessionToken`
6. Se valido → JWT finale con flag `twoFactorVerified: true`

### 5. Security Features

#### Rate Limiting
- Max 5 tentativi codice errato
- Lockout 15 minuti dopo 5 fallimenti
- Reset counter su codice corretto

#### Session Security
- Sessioni temporanee: 5 minuti validità
- Token unico non riutilizzabile
- Cleanup automatico sessioni scadute

#### Recovery Codes
- 10 codici generati al setup
- Formato: `XXXX-YYYY` (8 caratteri hex)
- Single-use (eliminati dopo utilizzo)
- Alert quando < 3 codici rimanenti
- Rigenerabili con password

#### Audit Logging
Tutte le azioni tracciate:
- Setup e disabilitazione 2FA
- Verifiche riuscite/fallite
- Uso recovery codes
- Lock/unlock account
- Rigenerazione backup codes

## 📋 Prossimi Step

### Frontend (da implementare)
1. **Componente Setup 2FA**
   - Display QR code
   - Input codice verifica
   - Download/copy recovery codes
   - Stepper 3 step

2. **Componente Verifica Login**
   - Input 6 cifre TOTP
   - Opzione recovery code
   - Countdown sessione (5 min)

3. **Dashboard Settings**
   - Stato 2FA corrente
   - Rigenera recovery codes
   - Disabilita 2FA
   - Audit log personale

4. **Admin Dashboard**
   - Statistiche globali 2FA
   - Lista partner con/senza 2FA
   - Reset forzato emergenza

### Testing
- [ ] Unit tests servizi 2FA
- [ ] Integration tests API endpoints
- [ ] E2E test flow completo
- [ ] Load testing rate limiting
- [ ] Security audit encryption

### Deployment
- [ ] Aggiungere ENCRYPTION_KEY al .env.production
- [ ] Setup cron job cleanup sessioni scadute
- [ ] Documentazione recovery procedure per supporto
- [ ] Email templates per eventi 2FA
- [ ] Monitoring metriche 2FA (success rate, lockouts, etc.)

## 🔐 Environment Variables

Aggiungere a `.env` e `.env.production`:
```bash
# Two-Factor Authentication Encryption Key (AES-256-GCM)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY="your-32-byte-hex-key-here"
```

## 📊 API Response Examples

### Setup 2FA
**Request:** `POST /api/auth/2fa/setup`
```json
{
  "message": "Setup 2FA generato con successo",
  "data": {
    "qrCode": "data:image/png;base64,...",
    "secret": "JBSWY3DPEHPK3PXP",
    "recoveryCodes": [
      "A1B2-C3D4",
      "E5F6-G7H8",
      ...
    ]
  }
}
```

### Login con 2FA Abilitato
**Request:** `POST /api/auth/login`
```json
{
  "requires2FA": true,
  "sessionToken": "abc123...",
  "message": "Inserisci il codice a 6 cifre dalla tua app di autenticazione"
}
```

### Verifica 2FA
**Request:** `POST /api/auth/2fa/verify`
```json
{
  "sessionToken": "abc123...",
  "code": "123456"
}
```

**Response Success:**
```json
{
  "message": "Autenticazione completata",
  "token": "jwt-token...",
  "employee": {
    "id": "...",
    "email": "...",
    "twoFactorVerified": true
  }
}
```

**Response Failed:**
```json
{
  "error": "Codice non valido",
  "remainingAttempts": 3
}
```

## 🛠️ Troubleshooting

### Problemi Comuni

#### "Codice non valido" ripetuto
- Verificare sincronizzazione orario dispositivo
- TOTP window: ±60 secondi tolleranza
- Provare codice precedente/successivo

#### Account bloccato
- Attendere 15 minuti
- Admin può sbloccare con `/admin/force-reset/:employeeId`
- Usare recovery code se disponibili

#### QR Code non scannerizza
- Fornire opzione manual entry
- Secret key copiabile in plain text
- Verificare app compatibile (Google Authenticator, Authy, etc.)

#### Recovery codes non funzionano
- Verificare formato corretto: `XXXX-YYYY`
- Controllare se già usati (single-use)
- Verificare maiuscole/minuscole non rilevanti

## 📚 Dipendenze Installate

```json
{
  "speakeasy": "^2.0.0",
  "qrcode": "^1.5.3",
  "@types/speakeasy": "^2.0.10",
  "@types/qrcode": "^1.5.5"
}
```

## ✨ Features Avanzate (Fase 2)

- [ ] SMS backup authentication (opzionale)
- [ ] Email OTP fallback
- [ ] Biometria (mobile app futura)
- [ ] Trusted devices (remember this device)
- [ ] Notifiche email per eventi 2FA critici
- [ ] Dashboard metriche real-time
- [ ] Export report audit logs
- [ ] Compliance GDPR per dati 2FA

---

**Versione:** 1.0.0
**Data Implementazione:** 2025-10-07
**Branch:** `feat/two-factor-auth`
**Status:** ✅ Backend Completato - Frontend da implementare
