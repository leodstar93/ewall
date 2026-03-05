-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "description" TEXT;

-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");
