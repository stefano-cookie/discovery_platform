-- AlterTable
ALTER TABLE "Notice" ADD COLUMN     "attachments" JSONB DEFAULT '[]',
ADD COLUMN     "contentHtml" TEXT;
