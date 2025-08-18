-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- AlterTable
ALTER TABLE "PaymentDeadline" ADD COLUMN     "partialAmount" DECIMAL(65,30),
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "delayedAmount" DECIMAL(65,30);