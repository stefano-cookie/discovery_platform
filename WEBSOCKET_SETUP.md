# WebSocket Infrastructure Setup Guide

## 📦 Fase 1: Infrastruttura Base (COMPLETATA)

### ✅ Installazione Dipendenze

**Backend:**
```bash
cd backend
npm install socket.io
```

**Frontend:**
```bash
npm install socket.io-client
```

---

## 🏗️ Architettura Implementata

### Backend Structure

```
backend/src/sockets/
├── index.ts                      # Socket.IO server initialization
├── auth.middleware.ts            # JWT authentication for WebSocket
├── rooms.manager.ts              # Room management & auto-join logic
├── types.ts                      # TypeScript types & event definitions
└── events/
    └── notice.events.ts          # Notice Board event handlers
```

### Frontend Structure

```
frontend/src/
├── contexts/
│   └── SocketContext.tsx         # WebSocket connection provider
└── hooks/
    ├── useSocket.ts              # Generic hook for events
    ├── useSocketEmit.ts          # Hook to emit events
    └── useRealtimeNotices.ts     # Notice Board real-time hook
```

---

## 🔧 Integrazione nel Server

Il server Express è stato modificato per supportare WebSocket:

**File:** `backend/src/server.ts`

```typescript
import http from 'http';
import { initializeSocketIO, setSocketIOInstance, getWebSocketHealth } from './sockets';

// Create HTTP server
const httpServer = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocketIO(httpServer);
setSocketIOInstance(io);

// Health check endpoint
app.get('/api/health/websocket', (_req, res) => {
  const health = getWebSocketHealth(io);
  res.json(health);
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server ready on ws://localhost:${PORT}`);
});
```

---

## 🔒 Autenticazione

### Backend Middleware

Il middleware `authenticateSocket` valida il JWT token durante l'handshake:

```typescript
// In auth.middleware.ts
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Unauthorized'));

  const decoded = jwt.verify(token, JWT_SECRET);
  socket.data.user = await getUserById(decoded.userId);
  next();
});
```

### Frontend Connection

Il `SocketProvider` invia automaticamente il token JWT:

```typescript
const token = localStorage.getItem('token');

const socket = io(BACKEND_URL, {
  auth: { token },
  transports: ['websocket', 'polling'],
  reconnection: true,
});
```

---

## 🏠 Sistema Rooms

### Auto-Join Logic

Quando un utente si connette, viene automaticamente assegnato alle sue rooms:

**Admin:**
- `admin:global` - Riceve notifiche admin
- `notices:global` - Riceve post bacheca

**Partner:**
- `partner:{partnerId}` - Riceve aggiornamenti partner
- `notices:global` - Riceve post bacheca

**User:**
- `user:{userId}` - Riceve notifiche personali
- `notices:global` - Riceve post bacheca
- `registration:{regId}` - Riceve aggiornamenti iscrizioni

---

## 📡 Eventi Implementati

### Notice Board Events

#### Server → Client

```typescript
// Nuovo post pubblicato
socket.on('notice:new', (notice) => {
  // Aggiungi alla lista notices
});

// Post modificato
socket.on('notice:updated', ({ id, changes }) => {
  // Aggiorna notice
});

// Post eliminato
socket.on('notice:deleted', ({ id }) => {
  // Rimuovi notice
});

// Qualcuno ha letto (solo admin)
socket.on('notice:acknowledged', (data) => {
  // Aggiorna statistiche
});
```

#### Client → Server

```typescript
// Conferma lettura
socket.emit('notice:acknowledge', { noticeId });
```

---

## 🚀 Utilizzo Frontend

### 1. Setup Provider in App.tsx

```tsx
import { SocketProvider } from './contexts/SocketContext';

function App() {
  return (
    <SocketProvider>
      <Router>
        {/* Your app */}
      </Router>
    </SocketProvider>
  );
}
```

### 2. Hook nei Componenti

**Bacheca Partner/Staff:**

```tsx
import { useRealtimeNotices } from '@/hooks/useRealtimeNotices';

function NoticeBoardView() {
  const { notices, unreadCount, acknowledgeNotice, loading } = useRealtimeNotices();

  const handleRead = (noticeId: string) => {
    acknowledgeNotice(noticeId);
  };

  // notices si aggiornano automaticamente in real-time!
}
```

**Eventi Custom:**

```tsx
import { useSocket, useSocketEmit } from '@/hooks/useSocket';

function MyComponent() {
  const emit = useSocketEmit();

  useSocket('custom:event', (data) => {
    console.log('Event received:', data);
  });

  const sendEvent = () => {
    emit('custom:action', { data: 'test' });
  };
}
```

---

## 🧪 Testing

### 1. Verifica Connessione

**Backend health check:**
```bash
curl http://localhost:8000/api/health/websocket
```

Response:
```json
{
  "status": "healthy",
  "connections": {
    "total": 3,
    "uniqueUsers": 3
  },
  "uptime": 1234.56,
  "timestamp": "2025-10-06T..."
}
```

### 2. Test con Browser Console

```javascript
// Nel browser (dopo login)
const socket = io('http://localhost:8000', {
  auth: { token: localStorage.getItem('token') }
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('welcome', (data) => {
  console.log('Authenticated:', data);
});
```

---

## 🔜 Next Steps (Fase 2)

### Integrazione Bacheca

1. **Modificare Controller Notices**
   - Emettere `notice:new` dopo POST
   - Emettere `notice:updated` dopo PATCH
   - Emettere `notice:deleted` dopo DELETE

2. **Aggiornare Componenti Frontend**
   - [NoticeBoard.tsx] - Admin riceve stats live
   - [NoticeBoardView.tsx] - Partner vede post in real-time

3. **Testare E2E**
   - Admin pubblica → Partner vede subito + badge
   - Partner legge → Admin vede stat aggiornata

---

## 📊 Performance Considerations

### Rate Limiting

Implementato rate limiting di **100 eventi/minuto** per client:

```typescript
export const checkRateLimit = (socket, maxEvents = 100, windowMs = 60000);
```

### Connection Pooling

- Auto-reconnect con backoff esponenziale
- Max 5 tentativi di riconnessione
- Cleanup automatico su disconnect

### Scalabilità Futura

Per multi-server deployment, aggiungere **Redis Adapter**:

```bash
npm install @socket.io/redis-adapter redis
```

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

---

## 🐛 Troubleshooting

### Client non si connette

1. Verificare token JWT valido in localStorage
2. Controllare CORS in backend (`FRONTEND_URL` in .env)
3. Verificare firewall/proxy non blocchi WebSocket

### Eventi non arrivano

1. Verificare che il client sia nella room corretta
2. Controllare logs backend per errori auth
3. Verificare rate limiting non attivo

### Disconnessioni frequenti

1. Aumentare `pingTimeout` in server options
2. Verificare stabilità rete
3. Controllare logs per errori JWT expired

---

## 📝 Environment Variables

**Backend (.env):**
```bash
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:3000
PORT=8000
```

**Frontend (.env):**
```bash
REACT_APP_API_URL=http://localhost:8000
```

---

## ✅ Checklist Fase 1

- [x] Installare Socket.IO (backend + frontend)
- [x] Creare struttura file backend
- [x] Implementare JWT authentication middleware
- [x] Implementare rooms manager
- [x] Integrare Socket.IO con Express
- [x] Creare SocketContext frontend
- [x] Creare hooks generici (useSocket, useSocketEmit)
- [x] Creare hook useRealtimeNotices
- [x] Implementare auto-reconnect logic
- [x] Testare compilazione TypeScript
- [x] Documentare architettura

**Status:** ✅ FASE 1 COMPLETATA

---

**Versione:** 1.0.0
**Data:** 2025-10-06
**Branch:** feat/web-sockets
