-- CreateEnum
CREATE TYPE "TwoFactorAction" AS ENUM ('ENABLED', 'DISABLED', 'VERIFIED', 'FAILED', 'RECOVERY_USED', 'LOCKED', 'UNLOCKED', 'BACKUP_GENERATED');

-- AlterTable
ALTER TABLE "PartnerEmployee" ADD COLUMN     "failedTwoFactorAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastFailedTwoFactorAt" TIMESTAMP(3),
ADD COLUMN     "twoFactorBackupCodes" JSONB,
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorLockedUntil" TIMESTAMP(3),
ADD COLUMN     "twoFactorSecret" TEXT,
ADD COLUMN     "twoFactorVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TwoFactorSession" (
    "id" TEXT NOT NULL,
    "partnerEmployeeId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwoFactorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFactorAuditLog" (
    "id" TEXT NOT NULL,
    "partnerEmployeeId" TEXT NOT NULL,
    "action" "TwoFactorAction" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwoFactorAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TwoFactorSession_token_key" ON "TwoFactorSession"("token");

-- CreateIndex
CREATE INDEX "TwoFactorSession_token_idx" ON "TwoFactorSession"("token");

-- CreateIndex
CREATE INDEX "TwoFactorSession_partnerEmployeeId_idx" ON "TwoFactorSession"("partnerEmployeeId");

-- CreateIndex
CREATE INDEX "TwoFactorSession_expiresAt_idx" ON "TwoFactorSession"("expiresAt");

-- CreateIndex
CREATE INDEX "TwoFactorAuditLog_partnerEmployeeId_idx" ON "TwoFactorAuditLog"("partnerEmployeeId");

-- CreateIndex
CREATE INDEX "TwoFactorAuditLog_action_idx" ON "TwoFactorAuditLog"("action");

-- CreateIndex
CREATE INDEX "TwoFactorAuditLog_createdAt_idx" ON "TwoFactorAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "TwoFactorSession" ADD CONSTRAINT "TwoFactorSession_partnerEmployeeId_fkey" FOREIGN KEY ("partnerEmployeeId") REFERENCES "PartnerEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactorAuditLog" ADD CONSTRAINT "TwoFactorAuditLog_partnerEmployeeId_fkey" FOREIGN KEY ("partnerEmployeeId") REFERENCES "PartnerEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
