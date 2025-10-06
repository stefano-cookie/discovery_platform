-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PARTNER', 'USER');

-- CreateEnum
CREATE TYPE "PartnerEmployeeRole" AS ENUM ('ADMINISTRATIVE', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "CompanyInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CourseTemplate" AS ENUM ('TFA', 'CERTIFICATION');

-- CreateEnum
CREATE TYPE "OfferType" AS ENUM ('TFA_ROMANIA', 'CERTIFICATION');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'DATA_VERIFIED', 'DOCUMENTS_UPLOADED', 'DOCUMENTS_PARTNER_CHECKED', 'CONTRACT_GENERATED', 'CONTRACT_SIGNED', 'AWAITING_DISCOVERY_APPROVAL', 'DISCOVERY_APPROVED', 'ENROLLED', 'CNRED_RELEASED', 'FINAL_EXAM', 'RECOGNITION_REQUEST', 'DOCUMENTS_APPROVED', 'EXAM_REGISTERED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('IDENTITY_CARD', 'PASSPORT', 'DIPLOMA', 'BACHELOR_DEGREE', 'MASTER_DEGREE', 'TRANSCRIPT', 'CV', 'PHOTO', 'RESIDENCE_CERT', 'BIRTH_CERT', 'CONTRACT_SIGNED', 'MEDICAL_CERT', 'TESSERA_SANITARIA', 'OTHER');

-- CreateEnum
CREATE TYPE "UploadSource" AS ENUM ('ENROLLMENT', 'USER_DASHBOARD', 'PARTNER_PANEL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('GRANT_ACCESS', 'REACTIVATE_USER');

-- CreateEnum
CREATE TYPE "DiscoveryActionType" AS ENUM ('COMPANY_CREATE', 'COMPANY_EDIT', 'COMPANY_DISABLE', 'COMPANY_DELETE', 'COMPANY_SET_PREMIUM', 'COMMISSION_CHANGE', 'USER_TRANSFER', 'REGISTRATION_TRANSFER', 'BULK_OPERATION', 'EXPORT_DATA', 'DOCUMENT_APPROVAL', 'DOCUMENT_REJECTION');

-- CreateEnum
CREATE TYPE "ArchivePaymentType" AS ENUM ('DEPOSIT', 'INSTALLMENT');

-- CreateEnum
CREATE TYPE "ArchivePaymentStatus" AS ENUM ('PAID', 'PARTIAL', 'UNPAID');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationToken" TEXT,
    "emailVerificationTokenExpiry" TIMESTAMP(3),
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verificationCode" TEXT,
    "codeExpiresAt" TIMESTAMP(3),
    "assignedPartnerId" TEXT,
    "assignedPartnerCompanyId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "parentId" TEXT,
    "canCreateChildren" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "commissionPerUser" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerEmployee" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "PartnerEmployeeRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "inviteToken" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "invitedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "PartnerEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerCompanyInvite" (
    "id" TEXT NOT NULL,
    "parentCompanyId" TEXT NOT NULL,
    "inviteToken" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "status" "CompanyInviteStatus" NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerCompanyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerSession" (
    "id" TEXT NOT NULL,
    "partnerEmployeeId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "PartnerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerActivityLog" (
    "id" TEXT NOT NULL,
    "partnerEmployeeId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "referralCode" TEXT NOT NULL,
    "canCreateChildren" BOOLEAN NOT NULL DEFAULT false,
    "commissionPerUser" DECIMAL(65,30) NOT NULL DEFAULT 1000,
    "commissionToAdmin" DECIMAL(65,30) NOT NULL DEFAULT 3000,
    "promotedFromChild" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "templateType" "CourseTemplate" NOT NULL DEFAULT 'TFA',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerOffer" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT,
    "partnerCompanyId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "offerType" "OfferType" NOT NULL DEFAULT 'TFA_ROMANIA',
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "installments" INTEGER NOT NULL,
    "installmentFrequency" INTEGER NOT NULL,
    "customPaymentPlan" JSONB,
    "referralLink" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByEmployeeId" TEXT,
    "isInherited" BOOLEAN NOT NULL DEFAULT false,
    "parentOfferId" TEXT,

    CONSTRAINT "PartnerOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "partnerCompanyId" TEXT,
    "code" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "discountAmount" DECIMAL(65,30),
    "discountPercent" DECIMAL(65,30),
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "dataNascita" TIMESTAMP(3) NOT NULL,
    "luogoNascita" TEXT NOT NULL,
    "provinciaNascita" TEXT,
    "sesso" TEXT,
    "codiceFiscale" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "nomePadre" TEXT,
    "nomeMadre" TEXT,
    "residenzaVia" TEXT NOT NULL,
    "residenzaCitta" TEXT NOT NULL,
    "residenzaProvincia" TEXT NOT NULL,
    "residenzaCap" TEXT NOT NULL,
    "hasDifferentDomicilio" BOOLEAN NOT NULL DEFAULT false,
    "domicilioVia" TEXT,
    "domicilioCitta" TEXT,
    "domicilioProvincia" TEXT,
    "domicilioCap" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "partnerCompanyId" TEXT,
    "sourcePartnerCompanyId" TEXT,
    "requestedByEmployeeId" TEXT,
    "isDirectRegistration" BOOLEAN NOT NULL DEFAULT true,
    "courseId" TEXT NOT NULL,
    "partnerOfferId" TEXT,
    "couponId" TEXT,
    "offerType" "OfferType" NOT NULL DEFAULT 'TFA_ROMANIA',
    "tipoLaurea" TEXT,
    "laureaConseguita" TEXT,
    "laureaConseguitaCustom" TEXT,
    "laureaUniversita" TEXT,
    "laureaData" TIMESTAMP(3),
    "tipoLaureaTriennale" TEXT,
    "laureaConseguitaTriennale" TEXT,
    "laureaUniversitaTriennale" TEXT,
    "laureaDataTriennale" TIMESTAMP(3),
    "numeroPergamena" TEXT,
    "dataRilascioPergamena" TIMESTAMP(3),
    "diplomaData" TIMESTAMP(3),
    "diplomaCitta" TEXT,
    "diplomaProvincia" TEXT,
    "diplomaIstituto" TEXT,
    "diplomaVoto" TEXT,
    "tipoProfessione" TEXT,
    "scuolaDenominazione" TEXT,
    "scuolaCitta" TEXT,
    "scuolaProvincia" TEXT,
    "originalAmount" DECIMAL(65,30) NOT NULL,
    "finalAmount" DECIMAL(65,30) NOT NULL,
    "installments" INTEGER NOT NULL,
    "remainingAmount" DECIMAL(65,30),
    "delayedAmount" DECIMAL(65,30),
    "partnerCommission" DECIMAL(65,30),
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "contractTemplateUrl" TEXT,
    "contractSignedUrl" TEXT,
    "contractGeneratedAt" TIMESTAMP(3),
    "contractUploadedAt" TIMESTAMP(3),
    "cnredUrl" TEXT,
    "cnredUploadedAt" TIMESTAMP(3),
    "adverintiaUrl" TEXT,
    "adverintiaUploadedAt" TIMESTAMP(3),
    "admissionTestDate" TIMESTAMP(3),
    "admissionTestBy" TEXT,
    "admissionTestPassed" BOOLEAN,
    "cnredReleasedAt" TIMESTAMP(3),
    "cnredReleasedBy" TEXT,
    "finalExamDate" TIMESTAMP(3),
    "finalExamRegisteredBy" TEXT,
    "finalExamPassed" BOOLEAN,
    "recognitionRequestDate" TIMESTAMP(3),
    "recognitionRequestBy" TEXT,
    "recognitionDocumentUrl" TEXT,
    "recognitionApprovalDate" TIMESTAMP(3),
    "examDate" TIMESTAMP(3),
    "examRegisteredBy" TEXT,
    "examCompletedDate" TIMESTAMP(3),
    "examCompletedBy" TEXT,
    "dataVerifiedAt" TIMESTAMP(3),
    "contractSignedAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3),
    "accessToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOfferAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "partnerCompanyId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOfferAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "registrationId" TEXT,
    "type" "DocumentType" NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "signedUrl" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "rejectionDetails" TEXT,
    "partnerCheckedAt" TIMESTAMP(3),
    "partnerCheckedBy" TEXT,
    "discoveryApprovedAt" TIMESTAMP(3),
    "discoveryApprovedBy" TEXT,
    "discoveryRejectedAt" TIMESTAMP(3),
    "discoveryRejectionReason" TEXT,
    "uploadSource" "UploadSource" NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedByRole" "UserRole" NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checksum" TEXT,
    "encryptionKey" TEXT,
    "expiresAt" TIMESTAMP(3),
    "partnerNotifiedAt" TIMESTAMP(3),
    "userNotifiedAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),

    CONSTRAINT "UserDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAuditLog" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "previousStatus" "DocumentStatus",
    "newStatus" "DocumentStatus",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentActionLog" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "performedRole" "UserRole" NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTypeConfig" (
    "id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "acceptedMimeTypes" TEXT[] DEFAULT ARRAY['application/pdf', 'image/jpeg', 'image/png']::TEXT[],
    "maxFileSize" INTEGER NOT NULL DEFAULT 10485760,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTypeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentNumber" INTEGER NOT NULL,
    "isFirstPayment" BOOLEAN NOT NULL DEFAULT false,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentDeadline" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paymentNumber" INTEGER NOT NULL,
    "description" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "partialAmount" DECIMAL(65,30),
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',

    CONSTRAINT "PaymentDeadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponUse" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "discountApplied" DECIMAL(65,30) NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponUse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramChatId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferVisibility" (
    "id" TEXT NOT NULL,
    "partnerOfferId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferVisibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTransfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromPartnerId" TEXT,
    "toPartnerId" TEXT NOT NULL,
    "fromPartnerCompanyId" TEXT,
    "toPartnerCompanyId" TEXT,
    "transferredBy" TEXT NOT NULL,
    "reason" TEXT,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "partnerEmployeeId" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "targetUserId" TEXT,
    "targetOfferId" TEXT,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryAdminLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" "DiscoveryActionType" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveryAdminLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivedRegistration" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "fiscalCode" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "residenceVia" TEXT NOT NULL,
    "residenceCity" TEXT NOT NULL,
    "residenceProvince" TEXT NOT NULL,
    "residenceCap" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "finalAmount" DECIMAL(65,30) NOT NULL,
    "installments" INTEGER NOT NULL,
    "totalExpected" DECIMAL(65,30) NOT NULL,
    "totalPaid" DECIMAL(65,30) NOT NULL,
    "totalOutstanding" DECIMAL(65,30) NOT NULL,
    "paymentProgress" DECIMAL(65,30) NOT NULL,
    "documentsZipUrl" TEXT,
    "documentsZipKey" TEXT,
    "contractPdfUrl" TEXT,
    "contractPdfKey" TEXT,
    "originalYear" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT NOT NULL,

    CONSTRAINT "ArchivedRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivedPayment" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "type" "ArchivePaymentType" NOT NULL,
    "label" TEXT NOT NULL,
    "installmentNumber" INTEGER,
    "expectedAmount" DECIMAL(65,30) NOT NULL,
    "paidAmount" DECIMAL(65,30) NOT NULL,
    "status" "ArchivePaymentStatus" NOT NULL,

    CONSTRAINT "ArchivedPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_verificationCode_key" ON "User"("verificationCode");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCompany_referralCode_key" ON "PartnerCompany"("referralCode");

-- CreateIndex
CREATE INDEX "PartnerCompany_parentId_idx" ON "PartnerCompany"("parentId");

-- CreateIndex
CREATE INDEX "PartnerCompany_referralCode_idx" ON "PartnerCompany"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerEmployee_email_key" ON "PartnerEmployee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerEmployee_inviteToken_key" ON "PartnerEmployee"("inviteToken");

-- CreateIndex
CREATE INDEX "PartnerEmployee_partnerCompanyId_idx" ON "PartnerEmployee"("partnerCompanyId");

-- CreateIndex
CREATE INDEX "PartnerEmployee_email_idx" ON "PartnerEmployee"("email");

-- CreateIndex
CREATE INDEX "PartnerEmployee_inviteToken_idx" ON "PartnerEmployee"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCompanyInvite_inviteToken_key" ON "PartnerCompanyInvite"("inviteToken");

-- CreateIndex
CREATE INDEX "PartnerCompanyInvite_parentCompanyId_idx" ON "PartnerCompanyInvite"("parentCompanyId");

-- CreateIndex
CREATE INDEX "PartnerCompanyInvite_inviteToken_idx" ON "PartnerCompanyInvite"("inviteToken");

-- CreateIndex
CREATE INDEX "PartnerCompanyInvite_email_idx" ON "PartnerCompanyInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerSession_token_key" ON "PartnerSession"("token");

-- CreateIndex
CREATE INDEX "PartnerSession_partnerEmployeeId_idx" ON "PartnerSession"("partnerEmployeeId");

-- CreateIndex
CREATE INDEX "PartnerSession_token_idx" ON "PartnerSession"("token");

-- CreateIndex
CREATE INDEX "PartnerActivityLog_partnerEmployeeId_idx" ON "PartnerActivityLog"("partnerEmployeeId");

-- CreateIndex
CREATE INDEX "PartnerActivityLog_action_idx" ON "PartnerActivityLog"("action");

-- CreateIndex
CREATE INDEX "PartnerActivityLog_createdAt_idx" ON "PartnerActivityLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_userId_key" ON "Partner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_referralCode_key" ON "Partner"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerOffer_referralLink_key" ON "PartnerOffer"("referralLink");

-- CreateIndex
CREATE INDEX "PartnerOffer_partnerCompanyId_idx" ON "PartnerOffer"("partnerCompanyId");

-- CreateIndex
CREATE INDEX "PartnerOffer_parentOfferId_idx" ON "PartnerOffer"("parentOfferId");

-- CreateIndex
CREATE INDEX "PartnerOffer_isInherited_idx" ON "PartnerOffer"("isInherited");

-- CreateIndex
CREATE INDEX "PartnerOffer_createdByEmployeeId_idx" ON "PartnerOffer"("createdByEmployeeId");

-- CreateIndex
CREATE INDEX "Coupon_partnerCompanyId_idx" ON "Coupon"("partnerCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_partnerId_code_key" ON "Coupon"("partnerId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_codiceFiscale_key" ON "UserProfile"("codiceFiscale");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_accessToken_key" ON "Registration"("accessToken");

-- CreateIndex
CREATE INDEX "Registration_partnerCompanyId_idx" ON "Registration"("partnerCompanyId");

-- CreateIndex
CREATE INDEX "Registration_sourcePartnerCompanyId_idx" ON "Registration"("sourcePartnerCompanyId");

-- CreateIndex
CREATE INDEX "Registration_requestedByEmployeeId_idx" ON "Registration"("requestedByEmployeeId");

-- CreateIndex
CREATE INDEX "Registration_isDirectRegistration_idx" ON "Registration"("isDirectRegistration");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_userId_courseId_partnerId_status_key" ON "Registration"("userId", "courseId", "partnerId", "status");

-- CreateIndex
CREATE INDEX "UserOfferAccess_partnerCompanyId_idx" ON "UserOfferAccess"("partnerCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "UserOfferAccess_userId_offerId_key" ON "UserOfferAccess"("userId", "offerId");

-- CreateIndex
CREATE INDEX "UserDocument_userId_status_idx" ON "UserDocument"("userId", "status");

-- CreateIndex
CREATE INDEX "UserDocument_registrationId_type_idx" ON "UserDocument"("registrationId", "type");

-- CreateIndex
CREATE INDEX "UserDocument_status_partnerNotifiedAt_idx" ON "UserDocument"("status", "partnerNotifiedAt");

-- CreateIndex
CREATE INDEX "UserDocument_uploadedAt_idx" ON "UserDocument"("uploadedAt");

-- CreateIndex
CREATE INDEX "DocumentAuditLog_documentId_idx" ON "DocumentAuditLog"("documentId");

-- CreateIndex
CREATE INDEX "DocumentAuditLog_performedBy_idx" ON "DocumentAuditLog"("performedBy");

-- CreateIndex
CREATE INDEX "DocumentAuditLog_createdAt_idx" ON "DocumentAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "DocumentActionLog_documentId_timestamp_idx" ON "DocumentActionLog"("documentId", "timestamp");

-- CreateIndex
CREATE INDEX "DocumentActionLog_performedBy_action_idx" ON "DocumentActionLog"("performedBy", "action");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTypeConfig_type_key" ON "DocumentTypeConfig"("type");

-- CreateIndex
CREATE UNIQUE INDEX "OfferVisibility_partnerOfferId_userId_key" ON "OfferVisibility"("partnerOfferId", "userId");

-- CreateIndex
CREATE INDEX "UserTransfer_fromPartnerCompanyId_idx" ON "UserTransfer"("fromPartnerCompanyId");

-- CreateIndex
CREATE INDEX "UserTransfer_toPartnerCompanyId_idx" ON "UserTransfer"("toPartnerCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionToken_token_key" ON "ActionToken"("token");

-- CreateIndex
CREATE INDEX "ActionToken_token_idx" ON "ActionToken"("token");

-- CreateIndex
CREATE INDEX "ActionToken_partnerEmployeeId_idx" ON "ActionToken"("partnerEmployeeId");

-- CreateIndex
CREATE INDEX "ActionToken_isUsed_idx" ON "ActionToken"("isUsed");

-- CreateIndex
CREATE INDEX "DiscoveryAdminLog_adminId_createdAt_idx" ON "DiscoveryAdminLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscoveryAdminLog_targetType_targetId_idx" ON "DiscoveryAdminLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "DiscoveryAdminLog_action_idx" ON "DiscoveryAdminLog"("action");

-- CreateIndex
CREATE INDEX "ArchivedRegistration_companyName_idx" ON "ArchivedRegistration"("companyName");

-- CreateIndex
CREATE INDEX "ArchivedRegistration_originalYear_idx" ON "ArchivedRegistration"("originalYear");

-- CreateIndex
CREATE INDEX "ArchivedRegistration_email_idx" ON "ArchivedRegistration"("email");

-- CreateIndex
CREATE INDEX "ArchivedRegistration_uploadedAt_idx" ON "ArchivedRegistration"("uploadedAt");

-- CreateIndex
CREATE INDEX "ArchivedPayment_registrationId_idx" ON "ArchivedPayment"("registrationId");

-- CreateIndex
CREATE INDEX "ArchivedPayment_status_idx" ON "ArchivedPayment"("status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_assignedPartnerId_fkey" FOREIGN KEY ("assignedPartnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_assignedPartnerCompanyId_fkey" FOREIGN KEY ("assignedPartnerCompanyId") REFERENCES "PartnerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCompany" ADD CONSTRAINT "PartnerCompany_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PartnerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerEmployee" ADD CONSTRAINT "PartnerEmployee_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "PartnerCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCompanyInvite" ADD CONSTRAINT "PartnerCompanyInvite_parentCompanyId_fkey" FOREIGN KEY ("parentCompanyId") REFERENCES "PartnerCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSession" ADD CONSTRAINT "PartnerSession_partnerEmployeeId_fkey" FOREIGN KEY ("partnerEmployeeId") REFERENCES "PartnerEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerActivityLog" ADD CONSTRAINT "PartnerActivityLog_partnerEmployeeId_fkey" FOREIGN KEY ("partnerEmployeeId") REFERENCES "PartnerEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOffer" ADD CONSTRAINT "PartnerOffer_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOffer" ADD CONSTRAINT "PartnerOffer_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "PartnerCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOffer" ADD CONSTRAINT "PartnerOffer_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "PartnerEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOffer" ADD CONSTRAINT "PartnerOffer_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOffer" ADD CONSTRAINT "PartnerOffer_parentOfferId_fkey" FOREIGN KEY ("parentOfferId") REFERENCES "PartnerOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "PartnerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "PartnerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_sourcePartnerCompanyId_fkey" FOREIGN KEY ("sourcePartnerCompanyId") REFERENCES "PartnerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_requestedByEmployeeId_fkey" FOREIGN KEY ("requestedByEmployeeId") REFERENCES "PartnerEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_partnerOfferId_fkey" FOREIGN KEY ("partnerOfferId") REFERENCES "PartnerOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOfferAccess" ADD CONSTRAINT "UserOfferAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOfferAccess" ADD CONSTRAINT "UserOfferAccess_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "PartnerOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOfferAccess" ADD CONSTRAINT "UserOfferAccess_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOfferAccess" ADD CONSTRAINT "UserOfferAccess_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "PartnerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDocument" ADD CONSTRAINT "UserDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDocument" ADD CONSTRAINT "UserDocument_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDocument" ADD CONSTRAINT "UserDocument_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDocument" ADD CONSTRAINT "UserDocument_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAuditLog" ADD CONSTRAINT "DocumentAuditLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "UserDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAuditLog" ADD CONSTRAINT "DocumentAuditLog_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentActionLog" ADD CONSTRAINT "DocumentActionLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "UserDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentActionLog" ADD CONSTRAINT "DocumentActionLog_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDeadline" ADD CONSTRAINT "PaymentDeadline_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUse" ADD CONSTRAINT "CouponUse_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUse" ADD CONSTRAINT "CouponUse_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferVisibility" ADD CONSTRAINT "OfferVisibility_partnerOfferId_fkey" FOREIGN KEY ("partnerOfferId") REFERENCES "PartnerOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferVisibility" ADD CONSTRAINT "OfferVisibility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTransfer" ADD CONSTRAINT "UserTransfer_toPartnerId_fkey" FOREIGN KEY ("toPartnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTransfer" ADD CONSTRAINT "UserTransfer_fromPartnerId_fkey" FOREIGN KEY ("fromPartnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTransfer" ADD CONSTRAINT "UserTransfer_toPartnerCompanyId_fkey" FOREIGN KEY ("toPartnerCompanyId") REFERENCES "PartnerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTransfer" ADD CONSTRAINT "UserTransfer_fromPartnerCompanyId_fkey" FOREIGN KEY ("fromPartnerCompanyId") REFERENCES "PartnerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionToken" ADD CONSTRAINT "ActionToken_partnerEmployeeId_fkey" FOREIGN KEY ("partnerEmployeeId") REFERENCES "PartnerEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionToken" ADD CONSTRAINT "ActionToken_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "PartnerCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryAdminLog" ADD CONSTRAINT "DiscoveryAdminLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchivedPayment" ADD CONSTRAINT "ArchivedPayment_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ArchivedRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
