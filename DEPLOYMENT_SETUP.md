# Setup Deploy Automatico

## Configurazione GitHub Secrets

Per abilitare il deploy automatico, devi configurare i seguenti secrets nel repository GitHub:

1. Vai su GitHub → Settings → Secrets and variables → Actions
2. Aggiungi i seguenti secrets:

### SSH_PRIVATE_KEY
La chiave privata SSH per connettersi al server.
```bash
# Sul tuo computer locale, copia il contenuto della chiave:
cat ~/.ssh/discovery_deploy
```

### REMOTE_HOST
L'hostname del server:
```
cfoeducation.it
```

### REMOTE_USER
L'username SSH:
```
cfoeducation.it_f55qsn6wucc
```

## Verifica Configurazione Server

Assicurati che sul server siano installati:
- Node.js 20+
- PM2 (`npm install -g pm2`)
- PostgreSQL
- Git

## Come Funziona

1. **Push su master** → GitHub Actions si attiva automaticamente
2. **Build** → Frontend e Backend vengono compilati
3. **Upload** → File caricati in directory temporanea via SSH
4. **Deploy** → Script sul server gestisce backup, deploy e restart
5. **Cleanup** → File temporanei rimossi

## Test Deploy Manuale

Per testare il deploy manualmente:
```bash
# Sul server
cd ~/discovery_platform_temp
bash deploy-on-server.sh
```

## Monitoraggio

- **Logs Backend**: `pm2 logs discovery-api`
- **Status**: `pm2 status`
- **Monit**: `pm2 monit`

## Rollback

In caso di problemi:
```bash
# Sul server
cd ~/backups
tar xzf discovery_backup_TIMESTAMP.tar.gz -C /var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it/
pm2 restart discovery-api
```