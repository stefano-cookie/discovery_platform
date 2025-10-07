/*
  Warnings:

  - Added the required column `partnerCompanyId` to the `PartnerActivityLog` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ActivityLogCategory" AS ENUM ('CRITICAL', 'WARNING', 'INFO');

-- DropIndex
DROP INDEX "public"."PartnerActivityLog_action_idx";

-- DropIndex
DROP INDEX "public"."PartnerActivityLog_createdAt_idx";

-- DropIndex
DROP INDEX "public"."PartnerActivityLog_partnerEmployeeId_idx";

-- AlterTable - Step 1: Add nullable column first
ALTER TABLE "PartnerActivityLog" ADD COLUMN     "category" "ActivityLogCategory" NOT NULL DEFAULT 'INFO',
ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "endpoint" TEXT,
ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "isSuccess" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "method" TEXT,
ADD COLUMN     "partnerCompanyId" TEXT,
ADD COLUMN     "resourceId" TEXT,
ADD COLUMN     "resourceType" TEXT;

-- Step 2: Populate partnerCompanyId from PartnerEmployee relation
UPDATE "PartnerActivityLog"
SET "partnerCompanyId" = "PartnerEmployee"."partnerCompanyId"
FROM "PartnerEmployee"
WHERE "PartnerActivityLog"."partnerEmployeeId" = "PartnerEmployee"."id";

-- Step 3: Make partnerCompanyId NOT NULL
ALTER TABLE "PartnerActivityLog" ALTER COLUMN "partnerCompanyId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "PartnerActivityLog_partnerEmployeeId_createdAt_idx" ON "PartnerActivityLog"("partnerEmployeeId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PartnerActivityLog_partnerCompanyId_createdAt_idx" ON "PartnerActivityLog"("partnerCompanyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PartnerActivityLog_action_createdAt_idx" ON "PartnerActivityLog"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PartnerActivityLog_category_createdAt_idx" ON "PartnerActivityLog"("category", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PartnerActivityLog_resourceType_resourceId_idx" ON "PartnerActivityLog"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "PartnerActivityLog_createdAt_idx" ON "PartnerActivityLog"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "PartnerActivityLog" ADD CONSTRAINT "PartnerActivityLog_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "PartnerCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
