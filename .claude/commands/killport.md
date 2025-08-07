# /killport Command

Libera tutte le porte utilizzate da Claude per server e client.

## Usage
```
/killport
```

## Command
```bash
pkill -f "node.*3000" || true; pkill -f "node.*3001" || true; pkill -f "node.*8000" || true; pkill -f "node.*9000" || true; lsof -ti :3000 | xargs kill -9 2>/dev/null || true; lsof -ti :3001 | xargs kill -9 2>/dev/null || true; lsof -ti :8000 | xargs kill -9 2>/dev/null || true; lsof -ti :9000 | xargs kill -9 2>/dev/null || true
```

## Ports freed
- 3000 (Frontend)
- 3001 (Backend)  
- 8000 (Dev server)
- 9000 (Alternative port)

💡 **TIP**: Use this before starting development if you get "port already in use" errors.