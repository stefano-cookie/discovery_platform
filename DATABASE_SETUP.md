# Database Setup per Discovery Platform

## Informazioni Database Necessarie

Per completare il deployment, hai bisogno delle credenziali del database PostgreSQL dal tuo hosting provider (IONOS/Plesk).

### Opzione 1: Database già esistente
Se il tuo hosting ha già creato un database PostgreSQL, ti servono:
- **Host**: probabilmente `localhost` o un indirizzo specifico
- **Nome Database**: il nome assegnato dal provider
- **Username**: l'utente del database
- **Password**: la password del database
- **Porta**: solitamente 5432

### Opzione 2: Creare nuovo database
Se puoi creare database tramite Plesk:
1. Accedi a Plesk
2. Vai su "Database"
3. Crea nuovo database PostgreSQL
4. Annota le credenziali fornite

### Aggiornare la configurazione

Una volta ottenute le credenziali, aggiorna il file sul server:

```bash
ssh cfoeducation.it_f55qsn6wucc@94.143.138.213
nano /var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it/backend/.env.production
```

Modifica la riga DATABASE_URL con le tue credenziali:
```
DATABASE_URL="postgresql://TUO_USER:TUA_PASSWORD@HOST:PORTA/NOME_DATABASE"
```

### Test della connessione

Dopo aver aggiornato le credenziali, testa la connessione:

```bash
cd /var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it/backend
npx prisma db push
```

Questo comando creerà le tabelle necessarie nel database.