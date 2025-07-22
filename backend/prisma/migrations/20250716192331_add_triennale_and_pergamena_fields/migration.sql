-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "dataRilascioPergamena" TIMESTAMP(3),
ADD COLUMN     "laureaConseguitaTriennale" TEXT,
ADD COLUMN     "laureaDataTriennale" TIMESTAMP(3),
ADD COLUMN     "laureaUniversitaTriennale" TEXT,
ADD COLUMN     "numeroPergamena" TEXT,
ADD COLUMN     "tipoLaureaTriennale" TEXT;
