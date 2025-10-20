-- Add password expiration tracking to User table
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN "passwordExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "passwordExpiryReminderSentAt" TIMESTAMP(3);

-- Add password expiration tracking to PartnerEmployee table
ALTER TABLE "PartnerEmployee" ADD COLUMN "passwordChangedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PartnerEmployee" ADD COLUMN "passwordExpiresAt" TIMESTAMP(3);
ALTER TABLE "PartnerEmployee" ADD COLUMN "passwordExpiryReminderSentAt" TIMESTAMP(3);

-- Set initial expiration dates for existing users (90 days from now)
UPDATE "User"
SET "passwordExpiresAt" = CURRENT_TIMESTAMP + INTERVAL '90 days'
WHERE "passwordExpiresAt" IS NULL;

UPDATE "PartnerEmployee"
SET "passwordExpiresAt" = CURRENT_TIMESTAMP + INTERVAL '90 days'
WHERE "passwordExpiresAt" IS NULL;

-- Create index for efficient expiration queries
CREATE INDEX "User_passwordExpiresAt_idx" ON "User"("passwordExpiresAt");
CREATE INDEX "PartnerEmployee_passwordExpiresAt_idx" ON "PartnerEmployee"("passwordExpiresAt");
