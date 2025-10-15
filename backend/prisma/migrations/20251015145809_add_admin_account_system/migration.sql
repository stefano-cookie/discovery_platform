-- AlterTable
ALTER TABLE "DiscoveryAdminLog" ADD COLUMN     "adminAccountId" TEXT,
ADD COLUMN     "performedBy" TEXT;

-- CreateTable
CREATE TABLE "AdminAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "AdminAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminAccount_userId_key" ON "AdminAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminAccount_email_key" ON "AdminAccount"("email");

-- CreateIndex
CREATE INDEX "AdminAccount_email_idx" ON "AdminAccount"("email");

-- CreateIndex
CREATE INDEX "AdminAccount_isActive_idx" ON "AdminAccount"("isActive");

-- CreateIndex
CREATE INDEX "DiscoveryAdminLog_adminAccountId_createdAt_idx" ON "DiscoveryAdminLog"("adminAccountId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminAccount" ADD CONSTRAINT "AdminAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryAdminLog" ADD CONSTRAINT "DiscoveryAdminLog_adminAccountId_fkey" FOREIGN KEY ("adminAccountId") REFERENCES "AdminAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed existing admin account (admin@discovery.com)
-- This inserts a record for the existing admin user if it exists
INSERT INTO "AdminAccount" ("id", "userId", "displayName", "email", "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  u.id,
  'Discovery Admin',
  u.email,
  true,
  NOW(),
  NOW()
FROM "User" u
WHERE u.email = 'admin@discovery.com' AND u.role = 'ADMIN'
ON CONFLICT (email) DO NOTHING;
