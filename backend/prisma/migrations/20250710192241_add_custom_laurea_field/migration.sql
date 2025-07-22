-- DropForeignKey
ALTER TABLE "Registration" DROP CONSTRAINT "Registration_partnerId_fkey";

-- AlterTable
ALTER TABLE "Registration" ALTER COLUMN "partnerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "laureaConseguitaCustom" TEXT;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
