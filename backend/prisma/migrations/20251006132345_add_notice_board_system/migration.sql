-- CreateEnum
CREATE TYPE "NoticePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" "NoticePriority" NOT NULL DEFAULT 'NORMAL',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoticeAcknowledgement" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "userId" TEXT,
    "partnerEmployeeId" TEXT,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoticeAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notice_publishedAt_idx" ON "Notice"("publishedAt");

-- CreateIndex
CREATE INDEX "Notice_isPinned_publishedAt_idx" ON "Notice"("isPinned", "publishedAt");

-- CreateIndex
CREATE INDEX "Notice_createdBy_idx" ON "Notice"("createdBy");

-- CreateIndex
CREATE INDEX "NoticeAcknowledgement_noticeId_idx" ON "NoticeAcknowledgement"("noticeId");

-- CreateIndex
CREATE INDEX "NoticeAcknowledgement_userId_idx" ON "NoticeAcknowledgement"("userId");

-- CreateIndex
CREATE INDEX "NoticeAcknowledgement_partnerEmployeeId_idx" ON "NoticeAcknowledgement"("partnerEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "NoticeAcknowledgement_noticeId_userId_key" ON "NoticeAcknowledgement"("noticeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "NoticeAcknowledgement_noticeId_partnerEmployeeId_key" ON "NoticeAcknowledgement"("noticeId", "partnerEmployeeId");

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeAcknowledgement" ADD CONSTRAINT "NoticeAcknowledgement_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeAcknowledgement" ADD CONSTRAINT "NoticeAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeAcknowledgement" ADD CONSTRAINT "NoticeAcknowledgement_partnerEmployeeId_fkey" FOREIGN KEY ("partnerEmployeeId") REFERENCES "PartnerEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
