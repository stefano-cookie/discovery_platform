-- Add secure access token fields to Registration table
ALTER TABLE "Registration" ADD COLUMN "accessToken" TEXT;
ALTER TABLE "Registration" ADD COLUMN "tokenExpiresAt" TIMESTAMP(3);

-- Add index for fast token lookup
CREATE INDEX "Registration_accessToken_idx" ON "Registration"("accessToken");
CREATE INDEX "Registration_tokenExpiresAt_idx" ON "Registration"("tokenExpiresAt");