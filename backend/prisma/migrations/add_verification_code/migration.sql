-- Add verification code fields to User table
ALTER TABLE "User" ADD COLUMN "verificationCode" VARCHAR(255);
ALTER TABLE "User" ADD COLUMN "codeExpiresAt" TIMESTAMP(3);

-- Create unique index for verificationCode to prevent duplicates
CREATE UNIQUE INDEX "User_verificationCode_key" ON "User"("verificationCode");