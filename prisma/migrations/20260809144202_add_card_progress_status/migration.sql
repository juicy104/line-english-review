-- CreateEnum
CREATE TYPE "CardProgressStatus" AS ENUM ('QUEUED', 'ASKED', 'ANSWERED');

-- AlterTable
ALTER TABLE "CardProgress" ADD COLUMN     "answeredAt" TIMESTAMP(3),
ADD COLUMN     "askedAt" TIMESTAMP(3),
ADD COLUMN     "status" "CardProgressStatus" NOT NULL DEFAULT 'QUEUED';

-- CreateIndex
CREATE INDEX "CardProgress_userId_status_dueAt_idx" ON "CardProgress"("userId", "status", "dueAt");
