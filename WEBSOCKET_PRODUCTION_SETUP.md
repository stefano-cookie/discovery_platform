# WebSocket Production Setup - Discovery Platform

## 🔧 Modifiche Apportate

### Backend (`backend/src/sockets/index.ts`)
```typescript
transports: ['websocket'],           // Solo WebSocket, no polling
allowUpgrades: true,                 // Permette upgrade da HTTP
path: '/socket.io/',                 // Path standard Socket.IO
```

### Frontend (`ActivityLogsConsole.tsx`)
```typescript
// Rimuove /api dal base URL per WebSocket
const baseApiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const wsUrl = baseApiUrl.replace('/api', '');  // https://discovery.cfoeducation.it

const socket = io(`${wsUrl}/activity-logs`, {
  transports: ['websocket'],
});
```

---

## 🚀 Configurazione Nginx (Server di Produzione)

### File: `/etc/nginx/sites-available/discovery.cfoeducation.it`

Aggiungi questa sezione **PRIMA** della location `/api`:

```nginx
server {
    listen 443 ssl http2;
    server_name discovery.cfoeducation.it;

    # ... altre configurazioni SSL ...

    # ✅ WebSocket Proxy (CRITICO)
    location /socket.io/ {
        proxy_pass http://localhost:8000/socket.io/;

        # WebSocket essentials
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Headers standard
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts per long-lived connections
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;  # 5 minuti (importante!)

        # Buffering (disabilitare per WebSocket)
        proxy_buffering off;
    }

    # API esistente
    location /api {
        proxy_pass http://localhost:8000;
        # ... configurazione esistente ...
    }

    # Frontend
    location / {
        root /var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it/frontend/build;
        try_files $uri /index.html;
    }
}
```

### Comandi per applicare:
```bash
# Testa configurazione
sudo nginx -t

# Reload senza downtime
sudo systemctl reload nginx

# Oppure restart completo
sudo systemctl restart nginx
```

---

## 🔍 Verifica Configurazione

### 1. Check Nginx Config
```bash
# Verifica sintassi
sudo nginx -t

# Controlla configurazione attiva
sudo nginx -T | grep -A 20 "location /socket.io"
```

### 2. Test Backend WebSocket Endpoint
```bash
# Check che il server risponda
curl -I https://discovery.cfoeducation.it/socket.io/?EIO=4&transport=websocket

# Output atteso:
# HTTP/1.1 101 Switching Protocols
# Upgrade: websocket
# Connection: Upgrade
```

### 3. Browser DevTools
Apri la console admin e controlla:
```javascript
// Console logs attesi:
[ActivityLogsConsole] Connected to WebSocket
[ActivityLogsConsole] Subscribed with filters: { ... }
```

Se vedi errori tipo:
- `net::ERR_CONNECTION_REFUSED` → Backend non raggiungibile
- `WebSocket connection failed` → Nginx non configurato correttamente
- `404 Not Found` → Path `/socket.io/` non proxato

---

## 🐛 Troubleshooting

### Problema: `WebSocket connection failed`
**Causa**: Nginx non ha configurazione `/socket.io/`
**Fix**: Aggiungi il blocco `location /socket.io/` sopra

### Problema: `Connection timeout`
**Causa**: Firewall blocca WebSocket o timeout troppo brevi
**Fix**:
```nginx
proxy_read_timeout 300s;  # Aumenta timeout
```

### Problema: `CORS error`
**Causa**: FRONTEND_URL non corretta nel backend
**Verifica**:
```bash
# Nel server di produzione
cat /var/www/.../backend/.env.production | grep FRONTEND_URL
# Deve essere: FRONTEND_URL="https://discovery.cfoeducation.it"
```

### Problema: `405 Method Not Allowed`
**Causa**: Nginx non permette upgrade HTTP → WebSocket
**Fix**: Verifica headers:
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

---

## 📊 Monitoring

### Log Nginx (Real-time)
```bash
# Access logs
sudo tail -f /var/log/nginx/access.log | grep socket.io

# Error logs
sudo tail -f /var/log/nginx/error.log | grep socket
```

### Backend Logs
```bash
# Se usi PM2
pm2 logs discovery-backend --lines 100 | grep WebSocket

# Log raw
journalctl -u discovery-backend -f | grep -i websocket
```

### Health Check Endpoint
```bash
curl https://discovery.cfoeducation.it/api/health/websocket

# Output atteso:
{
  "status": "healthy",
  "connections": {
    "total": 5,
    "uniqueUsers": 3
  },
  "uptime": 123456.789,
  "timestamp": "2025-10-08T12:00:00.000Z"
}
```

---

## ✅ Checklist Pre-Deploy

- [ ] Modifiche backend applicate (`sockets/index.ts`)
- [ ] Modifiche frontend applicate (`ActivityLogsConsole.tsx`)
- [ ] Frontend rebuild (`npm run build`)
- [ ] Backend restart (`pm2 restart discovery-backend`)
- [ ] Nginx config aggiunta (location `/socket.io/`)
- [ ] Nginx reload (`sudo systemctl reload nginx`)
- [ ] Test connessione browser console
- [ ] Verificare log in real-time
- [ ] Test export CSV funzionante

---

## 🔐 Note di Sicurezza

1. **Rate Limiting**: Già implementato in `auth.middleware.ts`
2. **Authentication**: JWT token richiesto per connessione
3. **CORS**: Solo `FRONTEND_URL` permessa
4. **Namespace isolation**: `/activity-logs` separato da altri WS

---

## 📝 Alternative (se Nginx non è disponibile)

### Apache (con mod_proxy_wstunnel)
```apache
<VirtualHost *:443>
    ServerName discovery.cfoeducation.it

    # WebSocket proxy
    ProxyPass /socket.io/ ws://localhost:8000/socket.io/
    ProxyPassReverse /socket.io/ ws://localhost:8000/socket.io/

    # API
    ProxyPass /api http://localhost:8000
    ProxyPassReverse /api http://localhost:8000
</VirtualHost>
```

### Caddy (configurazione semplificata)
```caddyfile
discovery.cfoeducation.it {
    reverse_proxy /socket.io/* localhost:8000
    reverse_proxy /api/* localhost:8000
    root * /var/www/.../frontend/build
    file_server
    try_files {path} /index.html
}
```

---

**Versione**: 1.0.0
**Data**: 2025-10-08
**Autore**: Discovery Platform Team
