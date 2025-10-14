-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentStatus" ADD VALUE 'APPROVED_BY_PARTNER';
ALTER TYPE "DocumentStatus" ADD VALUE 'REJECTED_BY_PARTNER';
ALTER TYPE "DocumentStatus" ADD VALUE 'APPROVED_BY_DISCOVERY';
ALTER TYPE "DocumentStatus" ADD VALUE 'REJECTED_BY_DISCOVERY';

-- AlterTable
ALTER TABLE "UserDocument" ADD COLUMN     "reviewedByPartner" BOOLEAN NOT NULL DEFAULT false;

-- Backwards compatibility: Mark existing approved/rejected documents as reviewed
UPDATE "UserDocument"
SET "reviewedByPartner" = true
WHERE "status" IN ('APPROVED', 'REJECTED')
   OR "partnerCheckedAt" IS NOT NULL;
