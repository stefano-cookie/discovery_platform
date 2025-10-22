-- Add Discovery approval/rejection fields to Registration
ALTER TABLE "Registration"
  ADD COLUMN IF NOT EXISTS "discoveryApprovedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "discoveryApprovedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "discoveryRejectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "discoveryRejectionReason" TEXT;

-- Fix Coupon unique constraint (from partnerId to partnerCompanyId)
-- Drop old constraint and index
DROP INDEX IF EXISTS "Coupon_partnerId_code_key";
DROP INDEX IF EXISTS "Coupon_partnerId_idx";

-- Create new constraint and index
CREATE UNIQUE INDEX "Coupon_partnerCompanyId_code_key" ON "Coupon"("partnerCompanyId", "code");
CREATE INDEX "Coupon_partnerId_idx" ON "Coupon"("partnerId");
