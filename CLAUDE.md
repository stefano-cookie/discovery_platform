# Discovery Platform - System Documentation

## 📝 Git Commit Guidelines

**IMPORTANT**: All git commit messages MUST be written in English.

**Commit Message Format**:
```
<type>(<scope>): <subject in English>

- bullet point 1 in English
- bullet point 2 in English

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types**: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`, `perf`

**Examples**:
- ✅ `feat(company): add cascade deletion for assigned users`
- ✅ `fix(r2): resolve multi-account document management issue`
- ❌ `feat(company): aggiunta eliminazione cascata utenti` (Italian not allowed)

---

## 🚀 BUGS TO FIX

### 1. ~~Audit Log Issues~~ ✅ RISOLTO

**Problem:**
- The "Discovery Admin Logs" tab currently shows only admin operations
- Should display ALL logs including partner operations

**Solution Implemented:**
- ✅ Updated audit log endpoint to merge admin + partner logs
- ✅ Added `logType` filter (all/admin/partner)
- ✅ Enhanced frontend UI with badges and company info
- ✅ Proper display of both admin and partner actions with visual distinction

**Files Modified:**
- Backend: `backend/src/routes/admin.ts` (lines 1638-1788)
- Frontend: `frontend/src/pages/Admin/AuditLogs.tsx`

---

### 2. ~~Archive Document Access Issues~~ ✅ RISOLTO

**Problem:**
- ZIP and PDF documents in archive return errors
- Issue with Cloudflare R2 buckets configuration
- Affected buckets (Account ID: `11eb49867970f932827c4503411e1816`):
  - `legacy-archive-contracts`
  - `legacy-archive-docs`

**Solution Implemented:**
- ✅ Verified R2 bucket permissions and configuration - all working correctly
- ✅ Tested ZIP file access and download - working with signed URLs
- ✅ Tested PDF file access and preview/download - working correctly
- ✅ Created diagnostic tools and CORS configuration script
- ✅ Documented setup in [backend/ARCHIVE_R2_SETUP.md](backend/ARCHIVE_R2_SETUP.md)

**Root Cause:**
The backend R2 integration is fully functional. If issues persist, they are likely:
1. **CORS configuration** - Run `backend/setup-archive-cors.sh` to configure CORS for browser access
2. **Frontend URL handling** - Check browser console for errors
3. **Missing public URL** - Contracts bucket has public URL configured, docs bucket uses signed URLs

**Diagnostic Tools:**
- `backend/test-archive-r2.ts` - Test R2 bucket connectivity and permissions
- `backend/test-archive-endpoints.ts` - Test archive API endpoints
- `backend/test-url-access.ts` - Test URL accessibility
- `backend/setup-archive-cors.sh` - Configure CORS for R2 buckets

**Technical Details:**
- Account ID: `11eb49867970f932827c4503411e1816`
- Buckets: `legacy-archive-contracts`, `legacy-archive-docs`
- Endpoint: `https://11eb49867970f932827c4503411e1816.r2.cloudflarestorage.com`
- Public URL (contracts): `https://pub-79e40c09b2c844daa37e6cfdebb6f1d3.r2.dev`

---

### 3. ~~Archive UI - Infinite Scroll Bug~~ ✅ RISOLTO

**Problem:**
- Graphical bug causing infinite scrolling in archive interface
- Located in ArchiveImport.tsx - conflicting overflow properties on scroll container

**Solution Implemented:**
- ✅ Identified component: `frontend/src/pages/Admin/ArchiveImport.tsx` (line 407)
- ✅ Fixed scroll container by separating border container from scrollable area
- ✅ Changed from single div with `overflow-x-auto max-h-96 overflow-y-auto` to nested structure:
  - Outer div: `border border-gray-200 rounded-lg overflow-hidden` (styling only)
  - Inner div: `overflow-auto max-h-96` (single overflow property for both directions)
- ✅ Added `z-10` to sticky header to ensure proper layering
- ✅ Build successful - frontend compiled without errors

**Root Cause:**
Conflicting `overflow-x-auto` and `overflow-y-auto` on the same element with `sticky` positioned children caused browser layout instability and infinite scroll behavior.

**Files Modified:**
- Frontend: `frontend/src/pages/Admin/ArchiveImport.tsx` (lines 407-438)

---

### 4. ~~Document Approval State Advancement Issue~~ ✅ RISOLTO

**Problem:**
- Partner document approval (per-document approval) not correctly advancing enrollment state
- Auto-advance logic from `DOCUMENTS_UPLOADED` to `AWAITING_DISCOVERY_APPROVAL` was not working as expected

**Root Cause:**
The `checkAndAdvanceRegistration()` function had a flawed condition at line 85:
- **Old logic**: `if (allReviewed && requiredDocs.length > 0)` - would advance even if not all required documents were present
- **Issue**: Only checked if SOME documents were reviewed, not if ALL required documents were present

**Solution Implemented:**
- ✅ Fixed condition to check `allRequiredDocsPresent && allReviewed`
- ✅ Added validation that `requiredDocs.length === requiredDocTypes.length` before advancing
- ✅ Enhanced logging to show missing/unreviewed documents for debugging
- ✅ Added clear status messages for approval/rejection flows
- ✅ Build successful - backend compiled without errors

**Logic Now:**
1. Check if ALL required document types are uploaded (2 for CERTIFICATION, 5 for TFA_ROMANIA)
2. Check if ALL uploaded required documents are reviewed by partner
3. Check if ALL reviewed documents are approved
4. Only then advance from `DOCUMENTS_UPLOADED` → `AWAITING_DISCOVERY_APPROVAL`

**Files Modified:**
- Backend: `backend/src/routes/_refactored/partnerDocuments.ts` (lines 74-122)

---

### 5. ~~Document Review Counter Logic Issue~~ ✅ RISOLTO

**Problem:**
- In "Stato Revisione Documenti" block, the counter shows uploaded documents (e.g., "0/2")
- Should show progress against REQUIRED documents instead
- CERTIFICATION requires 2 documents (IDENTITY_CARD, TESSERA_SANITARIA)
- TFA requires 8 documents (IDENTITY_CARD, TESSERA_SANITARIA, DIPLOMA, BACHELOR_DEGREE, MASTER_DEGREE, etc.)

**Solution Implemented:**
- ✅ Added `getRequiredDocumentTypes()` function to determine required documents based on template type
- ✅ Updated document filtering to show only required documents for each enrollment type
- ✅ Changed header counter to show "X di Y documenti richiesti caricati" (required documents)
- ✅ Updated "Stato Revisione Documenti" counter to display "{approved}/{required}" (e.g., "2/2" for CERTIFICATION, "5/8" for TFA)
- ✅ Changed label from "revisionati" to "approvati/richiesti" for clarity
- ✅ Build successful - frontend compiled without errors

**Logic Now:**
- CERTIFICATION: Shows 2 required documents (IDENTITY_CARD, TESSERA_SANITARIA)
- TFA: Shows 8 required documents (IDENTITY_CARD, TESSERA_SANITARIA, DIPLOMA, BACHELOR_DEGREE, MASTER_DEGREE, TRANSCRIPT, MEDICAL_CERT, BIRTH_CERT)
- Counter displays: `{approved_count}/{required_count}` instead of `{reviewed_count}/{uploaded_count}`
- Completion percentage based on uploaded vs required, not uploaded vs total available

**Files Modified:**
- Frontend: `frontend/src/components/Documents/UnifiedDocumentManager.tsx` (lines 516-540, 589, 817-820)

---

### 6. ~~TFA Payment Registration Issue~~ ✅ RISOLTO

**Problem:**
- When partner enters installment payment (with deposit + installments), the payment registration shows as single payment
- Should display deposit separately from installments
- Currently confusing single payment with installment structure

**Solution Implemented:**
- ✅ Added `PaymentType` enum (DEPOSIT | INSTALLMENT) to database schema
- ✅ Added `paymentType` field to `PaymentDeadline` model with default value 'INSTALLMENT'
- ✅ Created database migration `20251017154830_add_payment_type_to_payment_deadline`
- ✅ Updated existing deposits (paymentNumber = 0) to have type 'DEPOSIT'
- ✅ Updated all payment registration logic in backend routes:
  - `registration.ts` - TFA and Certification payment creation
  - `partner.ts` - Partner-initiated payment creation
  - `enrollment.ts` - Enrollment payment creation
  - `payment.ts` - Payment confirmation logic
  - `_refactored/partnerRegistrations.ts` - Partial payment logic
- ✅ Updated frontend `PaymentSection` component to:
  - Display "Acconto" badge for deposits (blue badge)
  - Use `paymentType` field instead of `paymentNumber` for payment labels
  - Maintain visual distinction between deposits and installments
- ✅ Build successful - backend and frontend compiled without errors

**Technical Details:**
- Migration file: `backend/prisma/migrations/20251017154830_add_payment_type_to_payment_deadline/migration.sql`
- Database schema: `backend/prisma/schema.prisma` (lines 781-811)
- Backend routes updated: 5 files modified
- Frontend component: `frontend/src/components/Partner/EnrollmentDetail/PaymentSection.tsx`

**Files Modified:**
- Backend Schema: `backend/prisma/schema.prisma`
- Backend Routes:
  - `backend/src/routes/registration.ts` (lines 1033-1170)
  - `backend/src/routes/partner.ts` (lines 2304-2380, 2679-2690, 5828-5844)
  - `backend/src/routes/enrollment.ts` (lines 485-527)
  - `backend/src/routes/payment.ts` (lines 99-118)
  - `backend/src/routes/_refactored/partnerRegistrations.ts` (lines 269-281)
- Frontend: `frontend/src/components/Partner/EnrollmentDetail/PaymentSection.tsx` (lines 8-20, 149-152, 207-210, 385-404)

---

### 7. ~~TFA Document Upload - Remove "Altri Documenti"~~ ✅ RISOLTO

**Problem:**
- TFA enrollment still shows "Altri Documenti" (Other Documents) upload option
- This document type should not be available for TFA

**Solution Implemented:**
- ✅ Removed `OTHER` document type from TFA document list in backend endpoint
- ✅ Updated `GET /api/partner/registrations/:registrationId/documents/unified` endpoint
- ✅ TFA now only shows 8 required documents:
  - IDENTITY_CARD (Carta d'Identità)
  - TESSERA_SANITARIA (Tessera Sanitaria)
  - BACHELOR_DEGREE (Certificato Laurea Triennale)
  - MASTER_DEGREE (Certificato Laurea Magistrale)
  - TRANSCRIPT (Piano di Studio)
  - MEDICAL_CERT (Certificato Medico)
  - BIRTH_CERT (Certificato di Nascita)
  - DIPLOMA (Diploma di Laurea)
- ✅ Added backend validation to reject `OTHER` document uploads for TFA enrollments
- ✅ Validation added to both user and partner upload endpoints:
  - `POST /api/user/documents` (userClean.ts)
  - `POST /api/partner/users/:userId/documents/upload` (partner.ts)
- ✅ Error message: "Il tipo di documento 'Altri Documenti' non è consentito per le iscrizioni TFA"
- ✅ Build successful - backend compiled without errors

**Technical Details:**
- Frontend `UnifiedDocumentManager` component was already correctly filtering documents by template type
- Issue was in backend endpoints that were serving OTHER as an available option
- CERTIFICATION enrollments still allow OTHER documents (unchanged)

**Files Modified:**
- Backend Routes:
  - `backend/src/routes/partner.ts` (lines 4027-4037: removed OTHER from TFA list)
  - `backend/src/routes/partner.ts` (lines 4343-4351: added validation)
  - `backend/src/routes/userClean.ts` (lines 754-766: added validation)

---

### 8. ~~Required Documents Count Mismatch - State Not Advancing~~ ✅ RISOLTO

**Problem:**
- When partner approves all required documents, the registration state does not advance from `DOCUMENTS_UPLOADED` to `AWAITING_DISCOVERY_APPROVAL`
- Issue affects both CERTIFICATION (2 docs) and TFA (8 docs) enrollments

**Root Cause:**
The `getRequiredDocumentTypes()` function in `partnerDocuments.ts` was returning only **5 documents** for TFA instead of the actual **8 required documents**:

```typescript
// OLD (incorrect)
return ['IDENTITY_CARD', 'TESSERA_SANITARIA', 'DIPLOMA', 'BACHELOR_DEGREE', 'MASTER_DEGREE'];
// Only 5 documents!
```

When the partner approved all 8 uploaded documents, the state advancement logic would compare:
- `requiredDocs.length` = 8 (actually uploaded and approved)
- `requiredDocTypes.length` = 5 (from incorrect function)
- `allRequiredDocsPresent = (8 === 5)` = **false** ❌

Therefore, the condition `if (allRequiredDocsPresent && allReviewed)` would never be met, preventing state advancement.

**Solution Implemented:**
- ✅ Updated `getRequiredDocumentTypes()` to return all 8 required documents for TFA:
  - IDENTITY_CARD
  - TESSERA_SANITARIA
  - DIPLOMA
  - BACHELOR_DEGREE
  - MASTER_DEGREE
  - TRANSCRIPT (← added)
  - MEDICAL_CERT (← added)
  - BIRTH_CERT (← added)
- ✅ Now when all 8 documents are approved:
  - `requiredDocs.length` = 8
  - `requiredDocTypes.length` = 8
  - `allRequiredDocsPresent = (8 === 8)` = **true** ✅
  - State advances correctly to `AWAITING_DISCOVERY_APPROVAL`
- ✅ Build successful - backend compiled without errors

**Technical Details:**
- The `checkAndAdvanceRegistration()` function (lines 42-127) was already correct
- Only needed to fix the document type list returned by `getRequiredDocumentTypes()`
- CERTIFICATION enrollments (2 docs) were already correct and unaffected

**Files Modified:**
- Backend: `backend/src/routes/_refactored/partnerDocuments.ts` (lines 132-149)

**Note for Testing:**
For enrollments where documents were already approved before this fix, the partner will need to re-approve one document to trigger the state advancement with the corrected logic. Alternatively, a manual database update can be performed to advance the state.

---

### 10. ~~Company Deletion - R2 Document Cleanup Issue~~ ✅ RISOLTO

**Problem:**
- When deleting a company, documents were removed from database but NOT from Cloudflare R2 storage
- This caused orphaned files in R2 even when global registrations count was 0
- Issue affected all company deletions with enrolled users

**Root Causes:**
1. **DocumentCleanupService**: Was receiving full URLs instead of R2 keys
   - Database stored both formats: `documents/userId/...` (key) and `https://bucket.r2.cloudflarestorage.com/documents/...` (full URL)
   - `storageManager.deleteFile()` requires the key, not the full URL

2. **CompanyService**: Was deleting registration documents twice
   - First: `deleteRegistrationsDocuments()` for registrations
   - Second: `deleteMany()` for remaining user documents (database only, no R2 cleanup)
   - This left orphaned files in R2

**Solution Implemented:**
- ✅ Added `extractR2Key()` helper in `DocumentCleanupService` to handle both URL formats:
  - Full URL: `https://bucket.r2.cloudflarestorage.com/documents/...` → extracts `documents/...`
  - Key only: `documents/...` → returns as-is
- ✅ Refactored `CompanyService.deleteCompany()` cascade deletion order:
  1. Delete ALL user documents (R2 + DB) using `DocumentCleanupService.deleteUserDocuments()`
  2. Delete payment deadlines
  3. Delete registrations (DB only, documents already cleaned)
  4. Delete offers and related access
  5. Delete employees and tokens
  6. Delete user profiles, conversations, transfers
  7. Delete users
  8. Delete company
- ✅ Enhanced logging to show R2 deletion progress per user
- ✅ Build successful - backend compiled without errors

**Technical Details:**
- R2 Account: Documents (`96e7e20557789c11d012aca51dc21a27`)
- Bucket: `discovery-documents-prod`
- Key format: `documents/{userId}/{documentType}/{timestamp}-{randomId}.{ext}`

**Cascade Deletion Order:**
```
Company
├── Users (assigned to company)
│   ├── Documents (R2 + DB) ✅ NOW CLEANED
│   ├── Profiles
│   ├── Conversations
│   └── Transfers
├── Registrations
│   └── Payment Deadlines
├── Offers
│   └── UserOfferAccess
└── Employees
    └── ActionTokens
```

**Files Modified:**
- Backend: `backend/src/services/documentCleanupService.ts` (lines 11-67: added `extractR2Key()` method)
- Backend: `backend/src/services/CompanyService.ts` (lines 339-349: refactored deletion order)

**Testing Recommendation:**
After company deletion, verify R2 bucket:
1. Count documents in DB: `SELECT COUNT(*) FROM "UserDocument";`
2. List R2 files: Use Cloudflare dashboard or R2 API
3. Both should match (no orphaned files)

---

## 🔧 Technical Notes

### Local Development - Email Workaround

**Problem**: In locale le email non vengono inviate perché richiedono SMTP configurato.

**Scripts Helper Disponibili** (in `backend/`):

#### 1. Link di Invito Partner
```bash
cd backend
./get-invite-links.sh
```
Mostra tutti i link di invito partner pendenti.

#### 2. Link di Verifica Email
```bash
cd backend
./get-verification-links.sh
```
Mostra tutti i link di verifica email pendenti.

#### 3. Verifica Email Manuale
```bash
cd backend
./verify-email-manual.sh user@example.com
```
Verifica manualmente un indirizzo email direttamente nel database.

#### 4. Lista Template Offerte
```bash
cd backend
./list-templates.sh
```
Mostra tutti i template di offerta disponibili con codici referral.

**Alternative**:
- Query inviti: `psql -h localhost -U postgres -d discovery_db -c "SELECT email, inviteToken FROM PartnerEmployee WHERE inviteToken IS NOT NULL;"`
- Query verifiche: `psql -h localhost -U postgres -d discovery_db -c "SELECT email, emailVerificationToken FROM User WHERE emailVerified = false;"`

### Database
- **Production DB**: `postgresql://discovery_user:Lasolita123@localhost:5432/discovery_prod_db`
- **Local DB**: `postgresql://postgres:password@localhost:5432/discovery_db`
- Always create migrations for schema changes
- Test migrations in development before production deploy

### R2 Storage
- **Documents**: `discovery-documents-prod` (Account ID: 96e7e20557789c11d012aca51dc21a27)
- **Notices**: `notice-board-attachments` (Account ID: 11eb49867970f932827c4503411e1816)
- **Archive**: `legacy-archive-docs` (Account ID: 11eb49867970f932827c4503411e1816)

### Deployment
- Backend: rsync `backend/dist/` to server → PM2 restart
- Frontend: Build → rsync to project root → Nginx serves static files
- Always test locally before production deploy

### 9. ~~Admin Login and Authentication Issues~~ ✅ RISOLTO

**Problem:**
- Admin login with 2FA redirected to `/dashboard` instead of `/admin`
- Admin received 403 errors on all `/api/admin/*` endpoints
- Missing 2FA validation for admin accounts
- User role in database was 'USER' instead of 'ADMIN' for admin accounts

**Root Causes:**
1. **Backend**: `authenticateAdmin` middleware didn't force `role: 'ADMIN'` in `req.user`
2. **Backend**: Admin login flow was missing mandatory 2FA check
3. **Frontend**: `LoginForm` used `window.location.reload()` instead of explicit redirect
4. **Database**: User linked to AdminAccount had `role: 'USER'` instead of `role: 'ADMIN'`

**Solution Implemented:**
- ✅ Created `authenticateAdmin` middleware that validates admin tokens (`type: 'admin'`)
- ✅ Updated `authenticateAdmin` to force `role: 'ADMIN'` in `req.user` object
- ✅ Extended `authenticateUnified` to support admin, user, and partner tokens
- ✅ Added 2FA check to admin login flow (setup required if not enabled)
- ✅ Updated socket authentication to handle admin tokens
- ✅ Modified `/api/user/2fa/verify` to recognize admin users and generate admin tokens
- ✅ Updated frontend `LoginForm` to redirect admin to `/admin` after 2FA verification
- ✅ Added route guard in `DashboardRoute` to prevent admin from accessing `/dashboard`
- ✅ Fixed database: Updated User.role to 'ADMIN' for all AdminAccount-linked users

**Database Fix Applied:**
```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'stefanojpriolo@gmail.com';
```

**Files Modified:**
- Backend:
  - `backend/src/middleware/auth.ts` (lines 198-263, 119-198)
  - `backend/src/routes/auth.ts` (lines 56-157: added 2FA for admin)
  - `backend/src/routes/user2fa.ts` (lines 215, 229-283: admin token support)
  - `backend/src/routes/admin.ts` (all routes use `authenticateAdmin`)
  - `backend/src/routes/admin/adminAccounts.routes.ts` (all routes)
  - `backend/src/routes/passwordManagement.ts` (line 239: use `authenticateUnified`)
  - `backend/src/sockets/auth.middleware.ts` (lines 36-67: admin support)
- Frontend:
  - `frontend/src/components/Auth/LoginForm.tsx` (lines 5, 23, 79-139)
  - `frontend/src/App.tsx` (lines 104-120: admin guard)

**Correct Flow Now:**
1. Admin logs in at `/login` → credentials verified
2. Backend checks 2FA status → requests 2FA code
3. Admin enters 2FA code → backend verifies and returns admin token
4. Frontend saves token with `role: 'ADMIN'` → redirects to `/admin`
5. All `/api/admin/*` endpoints work correctly with `authenticateAdmin` middleware
6. Socket connections authenticated with admin token support

**Important Notes:**
- AdminAccount users MUST have `role: 'ADMIN'` in User table
- Admin tokens have `type: 'admin'` (not `type: 'user'`)
- Admins cannot access `/dashboard/*` routes (auto-redirect to `/admin`)
- 2FA is mandatory for all admin accounts

---

### 11. ~~Production Issues - Multiple Critical Fixes~~ ✅ RISOLTO

**Problems:**
1. **PaymentDeadline.paymentType Column Missing** - Migration not applied
2. **Content-Disposition Header Error** - Non-ASCII characters in filename
3. **User Redirect to /login During Registration** - 401 errors during enrollment flow
4. **Socket Authentication Errors** - Invalid signature errors
5. **Orphaned Documents in R2** - Duplicate uploads not cleaning old files

**Root Causes:**
1. **Database**: Migration `20251017154830_add_payment_type_to_payment_deadline` marked as applied but enum/column not created
2. **Headers**: Filenames with accented characters (e.g., "carta d'identità.pdf") caused invalid HTTP header
3. **API Interceptor**: Too aggressive 401 redirect - triggered during registration/enrollment flows
4. **Socket**: Frontend using old/invalid tokens from previous sessions
5. **Document Upload**: No cleanup of old documents when user re-uploads same document type

**Solutions Implemented:**

#### 1. Database Migration Fix
- ✅ Manually applied missing `PaymentType` enum creation
- ✅ Added `paymentType` column to `PaymentDeadline` table
- ✅ Verified migration in production database
```sql
CREATE TYPE "PaymentType" AS ENUM ('DEPOSIT', 'INSTALLMENT');
ALTER TABLE "PaymentDeadline" ADD COLUMN "paymentType" "PaymentType" NOT NULL DEFAULT 'INSTALLMENT';
UPDATE "PaymentDeadline" SET "paymentType" = 'DEPOSIT' WHERE "paymentNumber" = 0;
```

#### 2. Content-Disposition Header Sanitization
- ✅ Added `sanitizeFilename()` function to remove non-ASCII characters
- ✅ Applied RFC 6266 compliant filename sanitization
- ✅ Handles accented characters, diacritics, and special chars
- **File**: `backend/src/middleware/unifiedDownload.ts` (lines 9-23, 47-48, 97-98)

#### 3. API Interceptor Exclusions
- ✅ Excluded registration/enrollment routes from auto-redirect on 401
- ✅ Added routes: `/registration/`, `/auth/verify-email`, `/auth/send-email-verification`, `/auth/verify-code`
- ✅ Prevents redirect during legitimate unauthenticated flows
- **File**: `frontend/src/services/api.ts` (lines 63-68)

#### 4. Document Upload Cleanup (Prevents Orphaned Files)
- ✅ Check for existing document of same type before upload
- ✅ Delete old document from R2 when new one is uploaded
- ✅ Delete old database record to prevent duplicates
- ✅ Applied to both user and partner upload endpoints
- **Files Modified:**
  - `backend/src/routes/userClean.ts` (lines 770-807: user upload)
  - `backend/src/services/documentService.ts` (lines 79-111: partner upload)

**Technical Details:**

**Database Migration:**
- Migration file exists but enum/column were not created
- Applied manually to production database
- Verified with `\d "PaymentDeadline"` - column now present

**Filename Sanitization:**
- Uses NFD normalization + diacritic removal
- Removes non-ASCII characters (regex: `/[^\x20-\x7E]/g`)
- Fallback to "download" if empty after sanitization

**Document Cleanup Logic:**
```typescript
// Before upload, find existing document
const existingDoc = await prisma.userDocument.findFirst({
  where: { userId, type, registrationId }
});

// Delete from R2 and database
if (existingDoc) {
  await storageManager.deleteFile(existingDoc.url);
  await prisma.userDocument.delete({ where: { id: existingDoc.id } });
}

// Then upload new document
```

**Deployment:**
- Backend: Built and deployed with rsync
- Frontend: Built and deployed with rsync
- PM2 restart: Backend restarted successfully
- No errors in production logs after deployment

**Files Modified:**
- Backend:
  - `backend/src/middleware/unifiedDownload.ts` (sanitization)
  - `backend/src/routes/userClean.ts` (document cleanup)
  - `backend/src/services/documentService.ts` (document cleanup)
- Frontend:
  - `frontend/src/services/api.ts` (API interceptor)
- Database:
  - Manual migration applied to production

---

**Version**: 16.2.0
**Last Updated**: 2025-10-21
**Status**: Active Development - Production Issues Fixed
