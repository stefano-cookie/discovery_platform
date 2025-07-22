/*
  Warnings:

  - Made the column `nomePadre` on table `UserProfile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `nomeMadre` on table `UserProfile` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "UserProfile" ALTER COLUMN "nomePadre" SET NOT NULL,
ALTER COLUMN "nomeMadre" SET NOT NULL;
