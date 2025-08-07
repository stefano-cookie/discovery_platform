-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "diplomaCitta" TEXT,
ADD COLUMN     "diplomaData" TIMESTAMP(3),
ADD COLUMN     "diplomaIstituto" TEXT,
ADD COLUMN     "diplomaProvincia" TEXT,
ADD COLUMN     "diplomaVoto" TEXT;