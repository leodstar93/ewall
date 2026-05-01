CREATE TABLE "EmailTemplate" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "subject" TEXT NOT NULL,
  "bodyText" TEXT NOT NULL,
  "variables" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailTemplate_key_key" ON "EmailTemplate"("key");
CREATE INDEX "EmailTemplate_isActive_idx" ON "EmailTemplate"("isActive");
