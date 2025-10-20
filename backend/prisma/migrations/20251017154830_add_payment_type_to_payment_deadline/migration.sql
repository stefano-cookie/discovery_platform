-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('DEPOSIT', 'INSTALLMENT');

-- AlterTable
ALTER TABLE "PaymentDeadline" ADD COLUMN     "paymentType" "PaymentType" NOT NULL DEFAULT 'INSTALLMENT';

-- Update existing deposits (paymentNumber = 0) to have DEPOSIT type
UPDATE "PaymentDeadline" SET "paymentType" = 'DEPOSIT' WHERE "paymentNumber" = 0;
