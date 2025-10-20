-- AlterEnum
ALTER TYPE "DiscoveryActionType" ADD VALUE 'PASSWORD_CHANGE';

-- DropIndex
DROP INDEX "public"."PartnerEmployee_passwordExpiresAt_idx";

-- DropIndex
DROP INDEX "public"."User_passwordExpiresAt_idx";
