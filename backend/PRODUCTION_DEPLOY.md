# 🚀 Production Deployment - New Partner System

## ⚠️ IMPORTANTE
Questo deploy modifica lo schema del database per rendere il sistema Partner corretto:
- `partnerId` → nullable (legacy, non più obbligatorio)
- `partnerCompanyId` → required (nuovo sistema)

## 📋 Pre-requisiti
1. Backup del database di produzione
2. Accesso SSH al server
3. Tunnel PostgreSQL attivo

## 🔧 Step 1: Backup Database

```bash
# Sul server di produzione
pg_dump $DATABASE_URL > backup_before_partner_system_$(date +%Y%m%d_%H%M%S).sql
```

## 🔧 Step 2: Applicare Migration

```bash
# Copia il file SQL migration sul server
scp prisma/migrations/20251006112611_init_new_partner_system/migration.sql cfoeducation.it_f55qsn6wucc@cfoeducation.it:/tmp/

# Sul server, esegui la migration
psql "postgresql://discovery_user:Lasolita123@localhost:5432/discovery_prod_db" -f /tmp/migration.sql
```

## 🔧 Step 3: Seed Dati Iniziali (se necessario)

Se il database produzione è vuoto o mancano i dati base:

```bash
# Copia lo script seed
scp prisma/seed-production.sql cfoeducation.it_f55qsn6wucc@cfoeducation.it:/tmp/

# Esegui il seed
psql "postgresql://discovery_user:Lasolita123@localhost:5432/discovery_prod_db" -f /tmp/seed-production.sql
```

## 🔧 Step 4: Verifica

```sql
-- Verifica che partnerId sia nullable
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'PartnerOffer' AND column_name IN ('partnerId', 'partnerCompanyId');

-- Output atteso:
-- partnerId | YES | text
-- partnerCompanyId | NO | text

-- Verifica i template
SELECT id, name, "offerType", "partnerId", "partnerCompanyId"
FROM "PartnerOffer"
WHERE id IN ('tfa-template-1500', 'cert-template-standard');
```

## 🔧 Step 5: Restart Backend

```bash
# Sul server
pm2 restart discovery-backend
pm2 logs discovery-backend --lines 50
```

## ✅ Checklist Post-Deploy

- [ ] Database migration applicata correttamente
- [ ] `partnerId` è nullable in `PartnerOffer`
- [ ] `partnerCompanyId` è required in `PartnerOffer`
- [ ] Template TFA e Certificazioni esistono
- [ ] Backend si avvia senza errori
- [ ] Login admin funziona
- [ ] Login partner employee funziona
- [ ] Creazione nuove offerte usa solo `partnerCompanyId`

## 🔄 Rollback (in caso di problemi)

```bash
# Ripristina il backup
psql $DATABASE_URL < backup_before_partner_system_XXXXXX.sql

# Restart backend
pm2 restart discovery-backend
```

## 📊 Schema Changes Summary

### Prima (OLD):
```
PartnerOffer {
  partnerId: String (REQUIRED)
  partnerCompanyId: String? (OPTIONAL)
}
```

### Dopo (NEW):
```
PartnerOffer {
  partnerId: String? (OPTIONAL - legacy)
  partnerCompanyId: String (REQUIRED - new system)
}
```

## 🎯 Cosa è cambiato

1. **PartnerOffer** ora usa SOLO `partnerCompanyId`
2. `partnerId` è mantenuto per compatibilità legacy ma è nullable
3. I template sono indipendenti e legati solo a PartnerCompany
4. Il vecchio modello `Partner` è deprecato (ma mantenuto per compatibilità)

## 📞 Support

In caso di problemi:
1. Controllare i log: `pm2 logs discovery-backend`
2. Verificare connessione DB: `psql $DATABASE_URL -c "SELECT NOW();"`
3. Verificare schema: Query nel Step 4
