# Analisi Problema Contratto in Produzione

## Problema Riportato
- **Errore**: `GET https://discovery.cfoeducation.it/api/partners/download-contract/{id} 500 (Internal Server Error)`
- **Funziona**: In locale
- **Non funziona**: In produzione

## Log Aggiunti per Debug

### 1. Partner Routes (`backend/src/routes/partner.ts`)
- `[CONTRACT_DOWNLOAD]` - Log completi per download endpoint
- `[CONTRACT_PREVIEW]` - Log già presenti per preview endpoint
- Tracciamento percorsi file e verifica esistenza

### 2. Contract Service (`backend/src/services/contractService.ts`)
- `[CONTRACT_SERVICE]` - Log generazione contratto
- `[CONTRACT_SAVE]` - Log dettagliati salvataggio file con percorsi
- Puppeteer executable path logging

## Possibili Cause del Problema

### 1. **Puppeteer Non Installato/Configurato**
**Sintomi**: Errore durante `puppeteer.launch()`
**Soluzione**:
```bash
# In produzione, installare dipendenze Chromium
apt-get update && apt-get install -y \
  chromium \
  chromium-sandbox \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libx11-6 \
  libxcomposite1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxrandr2 \
  libxss1 \
  libxtst6 \
  xdg-utils
```

### 2. **Percorsi File Differenti**
**Sintomi**: File non trovato dopo salvataggio
**Verifiche**:
- Check `__dirname` in produzione vs locale
- Verificare che `/uploads/contracts/` esista e abbia permessi scrittura
- Path resolution potrebbe essere diverso in ambiente containerizzato

### 3. **Permessi File System**
**Sintomi**: Errore durante `fs.writeFileSync`
**Soluzione**:
```bash
# Verificare e correggere permessi
chmod -R 755 uploads/
chown -R node:node uploads/
```

### 4. **Template HTML Non Trovato**
**Sintomi**: Template file not found
**Verifiche**:
- Il file `contract-template.html` deve essere presente in `backend/src/templates/`
- Verificare che sia incluso nel build di produzione

### 5. **Memoria Insufficiente**
**Sintomi**: Puppeteer crash durante generazione PDF
**Soluzione**:
- Aumentare memoria disponibile al container/server
- Aggiungere flag `--single-process` a Puppeteer (già fatto)

## Come Verificare i Log

### 1. Accedere ai log di produzione
```bash
# Se usi PM2
pm2 logs backend

# Se usi Docker
docker logs <container-id>

# Se usi systemd
journalctl -u backend -f
```

### 2. Cercare i pattern di log
- `[CONTRACT_DOWNLOAD]` - Per problemi download
- `[CONTRACT_PREVIEW]` - Per problemi anteprima
- `[CONTRACT_SERVICE]` - Per problemi generazione
- `[CONTRACT_SAVE]` - Per problemi salvataggio

## Test da Eseguire in Produzione

### 1. Test Puppeteer
```bash
# SSH nel server di produzione
node -e "const puppeteer = require('puppeteer'); puppeteer.launch().then(b => { console.log('OK'); b.close(); }).catch(e => console.error(e))"
```

### 2. Test Percorsi
```bash
# Verificare directory uploads
ls -la uploads/contracts/
```

### 3. Test Permessi
```bash
# Test scrittura
touch uploads/contracts/test.txt && rm uploads/contracts/test.txt
```

## Soluzione Temporanea

Se Puppeteer è il problema, considerare:
1. Usare un servizio esterno per generazione PDF
2. Pre-generare i contratti in locale e caricarli
3. Usare un container separato per la generazione PDF

## Prossimi Passi

1. **Deploy** le modifiche con i log
2. **Monitorare** i log di produzione
3. **Identificare** l'errore specifico dai log
4. **Applicare** la soluzione appropriata dalla lista sopra

## Note Importanti

- I log aggiunti NON impattano le performance in modo significativo
- Possono essere rimossi dopo aver risolto il problema
- Salvare i log per future reference

## Comandi Utili

```bash
# Tail dei log in tempo reale (PM2)
pm2 logs backend --lines 100

# Grep per CONTRACT nei log
pm2 logs backend | grep CONTRACT

# Verificare stato servizio
pm2 status backend
```