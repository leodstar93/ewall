-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM (
  'SYSTEM',
  'DMV',
  'IFTA',
  'UCR',
  'FORM2290',
  'DOCUMENTS',
  'ACCOUNT'
);

-- CreateEnum
CREATE TYPE "NotificationLevel" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "category" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM',
  "level" "NotificationLevel" NOT NULL DEFAULT 'INFO',
  "href" TEXT,
  "actionLabel" TEXT,
  "readAt" TIMESTAMP(3),
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "Notification_category_createdAt_idx" ON "Notification"("category", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
