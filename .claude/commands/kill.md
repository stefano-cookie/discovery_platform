# /kill Command

Elimina completamente un utente dal database con tutti i suoi riferimenti.

## Usage
```
/kill stefanojpriolo@gmail.com
```

## Command
```bash
# Uses default PostgreSQL connection from backend/.env
psql postgresql://postgres:password@localhost:5432/discovery_db -c "
BEGIN;
DELETE FROM \"PaymentDeadline\" WHERE \"registrationId\" IN (SELECT id FROM \"Registration\" WHERE \"userId\" IN (SELECT id FROM \"User\" WHERE email = '{email}'));
DELETE FROM \"UserDocument\" WHERE \"userId\" IN (SELECT id FROM \"User\" WHERE email = '{email}');
DELETE FROM \"DocumentAuditLog\" WHERE \"documentId\" IN (SELECT id FROM \"UserDocument\" WHERE \"userId\" IN (SELECT id FROM \"User\" WHERE email = '{email}'));
DELETE FROM \"Registration\" WHERE \"userId\" IN (SELECT id FROM \"User\" WHERE email = '{email}');
DELETE FROM \"UserProfile\" WHERE \"userId\" IN (SELECT id FROM \"User\" WHERE email = '{email}');
DELETE FROM \"Session\" WHERE \"userId\" IN (SELECT id FROM \"User\" WHERE email = '{email}');
DELETE FROM \"FormData\" WHERE \"userId\" IN (SELECT id FROM \"User\" WHERE email = '{email}');
DELETE FROM \"User\" WHERE email = '{email}';
COMMIT;
"
```

## What it deletes (in order of FK dependencies)
1. **DocumentAuditLog** - Document audit trail logs
2. **PaymentDeadline** - Payment deadlines for registrations  
3. **UserDocument** - User uploaded documents
4. **Registration** - User enrollments and registrations
5. **UserProfile** - User profile data
6. **Session** - User login sessions
7. **FormData** - Temporary form data
8. **User** - Main user account

⚠️ **WARNING**: This permanently deletes ALL user data including documents. Use with caution.

## Features
- ✅ **Complete cleanup** - Removes all user traces from database
- ✅ **FK-safe order** - Deletes in correct dependency order
- ✅ **Transaction safety** - All deletes in single transaction
- ✅ **Document cleanup** - Includes new document system tables
- ✅ **Direct connection** - Uses default PostgreSQL connection (no env var setup needed)
- ✅ **Readable format** - Multi-line SQL for better debugging

## Use Cases
- 🧪 **Testing**: Clean user before testing registration flow
- 🐛 **Debugging**: Remove corrupted user data
- 🔄 **Reset**: Fresh start for specific user account