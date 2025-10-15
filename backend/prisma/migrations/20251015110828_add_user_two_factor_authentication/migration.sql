-- AlterTable
ALTER TABLE "TwoFactorAuditLog" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "partnerEmployeeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TwoFactorSession" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "partnerEmployeeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedTwoFactorAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastFailedTwoFactorAt" TIMESTAMP(3),
ADD COLUMN     "twoFactorBackupCodes" JSONB,
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorLockedUntil" TIMESTAMP(3),
ADD COLUMN     "twoFactorSecret" TEXT,
ADD COLUMN     "twoFactorVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "TwoFactorAuditLog_userId_idx" ON "TwoFactorAuditLog"("userId");

-- CreateIndex
CREATE INDEX "TwoFactorSession_userId_idx" ON "TwoFactorSession"("userId");

-- AddForeignKey
ALTER TABLE "TwoFactorSession" ADD CONSTRAINT "TwoFactorSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactorAuditLog" ADD CONSTRAINT "TwoFactorAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
