# Discovery Platform - Troubleshooting Guide

## 🔧 Common Issues and Solutions

---

## 1. WebSocket Authentication Errors (JWT invalid signature)

### Symptoms
```
[WebSocket] Authentication error: JsonWebTokenError: invalid signature
[WebSocket] Connection error: { code: 1, message: 'Session ID unknown' }
```

### Root Cause
After a backend restart or deployment, the `JWT_SECRET` environment variable may change or be reloaded. Existing user sessions have JWT tokens signed with the **old** secret, which are no longer valid with the **new** secret.

### Solution for Users
**Users must logout and login again** to get new tokens signed with the current JWT_SECRET.

1. **Option A - Logout/Login**:
   - Navigate to the logout page
   - Login again with credentials
   - WebSocket will work correctly

2. **Option B - Clear Browser Data**:
   - Clear cookies for `discovery.cfoeducation.it`
   - Refresh page
   - Login again

### Solution for Developers
To prevent this issue:

1. **Never change `JWT_SECRET` in production** unless absolutely necessary
2. If you must change it, notify all users to re-login
3. Consider implementing JWT secret rotation with grace period

### Prevention
- Keep `JWT_SECRET` consistent in `.env.production` on server
- Never commit `.env.production` to git (it's in .gitignore)
- During deployment, the script now validates and preserves `.env.production`

---

## 2. Backend Crashes on Startup (ENCRYPTION_KEY missing)

### Symptoms
```
Error: ENCRYPTION_KEY non configurato
PM2 process restarting continuously (high restart count)
502 Bad Gateway errors
```

### Root Cause
The `.env` or `.env.production` file is missing or doesn't contain required environment variables.

### Solution
1. **Verify `.env.production` exists on server**:
   ```bash
   ssh server
   ls -la ~/discovery.cfoeducation.it/backend/.env*
   ```

2. **Check required variables**:
   ```bash
   cat ~/discovery.cfoeducation.it/backend/.env.production | grep -E '(DATABASE_URL|JWT_SECRET|ENCRYPTION_KEY)'
   ```

3. **If missing, restore from backup**:
   ```bash
   cp ~/backups/.env.production.backup_YYYYMMDD_HHMMSS ~/discovery.cfoeducation.it/backend/.env.production
   ```

4. **Create .env from .env.production**:
   ```bash
   cp ~/discovery.cfoeducation.it/backend/.env.production ~/discovery.cfoeducation.it/backend/.env
   ```

5. **Restart PM2**:
   ```bash
   cd ~/discovery.cfoeducation.it
   pm2 restart ecosystem.config.js
   pm2 save
   ```

### Required Variables
The following variables MUST be present in `.env.production`:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing
- `ENCRYPTION_KEY` - AES-256 key for 2FA encryption (32 bytes hex)
- `JWT_2FA_SECRET` - Secret for 2FA JWT tokens
- `CLOUDFLARE_ACCOUNT_ID` - R2 account ID
- `CLOUDFLARE_ACCESS_KEY_ID` - R2 access key
- `CLOUDFLARE_SECRET_ACCESS_KEY` - R2 secret key
- `EMAIL_USER` - SMTP email username
- `EMAIL_PASS` - SMTP email password

---

## 3. Backend Running on Wrong Port (3001 instead of 3010)

### Symptoms
- PM2 shows backend as "online"
- API returns 502 Bad Gateway
- `netstat -tlnp | grep 3010` shows nothing
- `netstat -tlnp | grep 3001` shows node process

### Root Cause
The `ecosystem.config.js` has `NODE_ENV: 'development'` or `PORT: 3001` in the default `env` section.

### Solution
1. **Update ecosystem.config.js on server**:
   ```bash
   nano ~/discovery.cfoeducation.it/ecosystem.config.js
   ```

2. **Ensure the `env` section has**:
   ```javascript
   env: {
     NODE_ENV: 'production',
     PORT: 3010
   }
   ```

3. **Restart PM2**:
   ```bash
   pm2 restart ecosystem.config.js
   pm2 save
   ```

4. **Verify correct port**:
   ```bash
   netstat -tlnp | grep 3010
   curl http://localhost:3010/api/health
   ```

### Prevention
The updated `deploy-on-server.sh` now automatically forces production environment.

---

## 4. SSH Connection Refused

### Symptoms
```
ssh: connect to host cfoeducation.it port 22: Connection refused
```

### Possible Causes
1. **Server overloaded** - Multiple failed deployments causing CPU/memory saturation
2. **SSH service down** - sshd service stopped
3. **Firewall blocking** - Port 22 blocked temporarily

### Solution
1. **Wait and retry** - If server is saturated, wait 2-5 minutes
2. **Use retry script**:
   ```bash
   for i in {1..5}; do
     sshpass -p 'password' ssh user@host "pm2 list" && break
     sleep 10
   done
   ```

3. **Contact hosting provider** if issue persists

---

## 5. Multiple Failed Deployments (GitHub Actions Backlog)

### Symptoms
- Multiple GitHub Actions running simultaneously
- Deploy timestamps very close together
- Server showing multiple backup files from same hour

### Solution
1. **Cancel pending GitHub Actions**:
   - Go to GitHub repository → Actions tab
   - Cancel all queued/running deployments except the latest

2. **SSH to server and check PM2**:
   ```bash
   ssh server
   pm2 list
   ```

3. **If processes stuck in crash loop**:
   ```bash
   pm2 delete all
   cd ~/discovery.cfoeducation.it
   pm2 start ecosystem.config.js
   pm2 save
   ```

4. **Verify .env.production exists**:
   ```bash
   ls -la ~/discovery.cfoeducation.it/backend/.env*
   ```

5. **Restore if needed** (see Issue #2 above)

### Prevention
- Monitor GitHub Actions before pushing multiple commits
- Use `[skip ci]` in commit messages for documentation-only changes
- Squash commits before pushing to production branch

---

## 6. Database Connection Errors

### Symptoms
```
Error: P1000: Authentication failed against database server
Connection refused at localhost:5432
```

### Solution
1. **Check PostgreSQL status**:
   ```bash
   sudo systemctl status postgresql
   ```

2. **Restart if needed**:
   ```bash
   sudo systemctl restart postgresql
   ```

3. **Verify credentials in .env.production**:
   ```bash
   cat ~/discovery.cfoeducation.it/backend/.env.production | grep DATABASE_URL
   ```

4. **Test connection manually**:
   ```bash
   psql "postgresql://user:password@localhost:5432/dbname" -c "SELECT 1;"
   ```

---

## 7. R2 Storage Errors

### Symptoms
```
[R2Storage] Upload failed: AccessDenied
[R2Factory] Bucket: discovery-documents-dev (wrong bucket!)
```

### Solution
1. **Check NODE_ENV**:
   ```bash
   pm2 logs discovery-backend --lines 20 | grep NODE_ENV
   ```
   Should show: `NODE_ENV: production`

2. **Verify R2 credentials**:
   ```bash
   cat ~/discovery.cfoeducation.it/backend/.env.production | grep CLOUDFLARE
   ```

3. **Restart with correct env**:
   ```bash
   pm2 restart ecosystem.config.js
   ```

---

## 🚨 Emergency Rollback Procedure

If deployment completely breaks the site:

```bash
# 1. SSH to server
ssh cfoeducation.it_f55qsn6wucc@cfoeducation.it

# 2. Find latest working backup
ls -lth ~/backups/ | head -5

# 3. Stop PM2
pm2 stop all

# 4. Extract backup (replace TIMESTAMP)
cd ~/discovery.cfoeducation.it
tar xzf ~/backups/discovery_backup_YYYYMMDD_HHMMSS.tar.gz

# 5. Restore .env.production from backup
cp ~/backups/.env.production.backup_YYYYMMDD_HHMMSS ~/discovery.cfoeducation.it/backend/.env.production

# 6. Create .env
cp backend/.env.production backend/.env

# 7. Restart PM2
pm2 start ecosystem.config.js
pm2 save

# 8. Verify
curl http://localhost:3010/api/health
```

---

## 📞 Getting Help

### Check Logs
```bash
# PM2 logs
pm2 logs discovery-backend --lines 100

# Specific log files
tail -100 ~/discovery.cfoeducation.it/backend/logs/backend-error-0.log
tail -100 ~/.pm2/logs/discovery-backend-error.log

# System logs
sudo journalctl -u nginx -n 50
```

### Health Checks
```bash
# Backend direct
curl http://localhost:3010/api/health

# Through nginx proxy
curl https://discovery.cfoeducation.it/api/health

# PM2 status
pm2 list
pm2 show discovery-backend

# Port check
netstat -tlnp | grep -E ':(3000|3010)'
```

### Useful Commands
```bash
# Restart everything
pm2 restart all && pm2 save

# View PM2 config
pm2 show discovery-backend

# Monitor in real-time
pm2 monit

# Check disk space
df -h

# Check memory
free -h
```

---

**Last Updated**: 2025-10-10
**Version**: 1.0
