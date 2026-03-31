CREATE TYPE "DmvRenewalCaseStatus" AS ENUM (
  'SUBMITTED',
  'IN_REVIEW',
  'NEEDS_CLIENT_ACTION',
  'PENDING_CLIENT_APPROVAL',
  'CHANGES_REQUESTED',
  'APPROVED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "DmvRenewalCaseDocumentKind" AS ENUM (
  'CLIENT_INITIAL_UPLOAD',
  'CLIENT_RESPONSE_UPLOAD',
  'STAFF_RETURN_DOCUMENT',
  'STAFF_INTERNAL_DOCUMENT'
);

CREATE TYPE "DmvRenewalCaseMessageAudience" AS ENUM (
  'INTERNAL',
  'CLIENT_VISIBLE'
);

CREATE TABLE "DmvRenewalCase" (
  "id" TEXT NOT NULL,
  "caseNumber" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "truckId" TEXT NOT NULL,
  "assignedToId" TEXT,
  "status" "DmvRenewalCaseStatus" NOT NULL DEFAULT 'SUBMITTED',
  "state" TEXT,
  "note" TEXT,
  "clientApprovalNote" TEXT,
  "internalNote" TEXT,
  "submittedAt" TIMESTAMP(3),
  "inReviewAt" TIMESTAMP(3),
  "sentToClientAt" TIMESTAMP(3),
  "clientApprovedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DmvRenewalCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DmvRenewalCaseDocument" (
  "id" TEXT NOT NULL,
  "renewalId" TEXT NOT NULL,
  "uploadedByUserId" TEXT NOT NULL,
  "kind" "DmvRenewalCaseDocumentKind" NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileSize" INTEGER,
  "mimeType" TEXT,
  "note" TEXT,
  "visibleToClient" BOOLEAN NOT NULL DEFAULT true,
  "sourceDocumentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DmvRenewalCaseDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DmvRenewalCaseStatusHistory" (
  "id" TEXT NOT NULL,
  "renewalId" TEXT NOT NULL,
  "fromStatus" "DmvRenewalCaseStatus",
  "toStatus" "DmvRenewalCaseStatus" NOT NULL,
  "changedByUserId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DmvRenewalCaseStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DmvRenewalCaseMessage" (
  "id" TEXT NOT NULL,
  "renewalId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "audience" "DmvRenewalCaseMessageAudience" NOT NULL DEFAULT 'CLIENT_VISIBLE',
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DmvRenewalCaseMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DmvRenewalCase_caseNumber_key" ON "DmvRenewalCase"("caseNumber");
CREATE INDEX "DmvRenewalCase_userId_idx" ON "DmvRenewalCase"("userId");
CREATE INDEX "DmvRenewalCase_truckId_idx" ON "DmvRenewalCase"("truckId");
CREATE INDEX "DmvRenewalCase_assignedToId_idx" ON "DmvRenewalCase"("assignedToId");
CREATE INDEX "DmvRenewalCase_status_idx" ON "DmvRenewalCase"("status");
CREATE INDEX "DmvRenewalCase_createdAt_idx" ON "DmvRenewalCase"("createdAt");

CREATE INDEX "DmvRenewalCaseDocument_renewalId_idx" ON "DmvRenewalCaseDocument"("renewalId");
CREATE INDEX "DmvRenewalCaseDocument_uploadedByUserId_idx" ON "DmvRenewalCaseDocument"("uploadedByUserId");
CREATE INDEX "DmvRenewalCaseDocument_kind_idx" ON "DmvRenewalCaseDocument"("kind");
CREATE INDEX "DmvRenewalCaseDocument_sourceDocumentId_idx" ON "DmvRenewalCaseDocument"("sourceDocumentId");

CREATE INDEX "DmvRenewalCaseStatusHistory_renewalId_idx" ON "DmvRenewalCaseStatusHistory"("renewalId");
CREATE INDEX "DmvRenewalCaseStatusHistory_changedByUserId_idx" ON "DmvRenewalCaseStatusHistory"("changedByUserId");
CREATE INDEX "DmvRenewalCaseStatusHistory_createdAt_idx" ON "DmvRenewalCaseStatusHistory"("createdAt");

CREATE INDEX "DmvRenewalCaseMessage_renewalId_idx" ON "DmvRenewalCaseMessage"("renewalId");
CREATE INDEX "DmvRenewalCaseMessage_authorId_idx" ON "DmvRenewalCaseMessage"("authorId");
CREATE INDEX "DmvRenewalCaseMessage_audience_idx" ON "DmvRenewalCaseMessage"("audience");

ALTER TABLE "DmvRenewalCase"
ADD CONSTRAINT "DmvRenewalCase_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DmvRenewalCase"
ADD CONSTRAINT "DmvRenewalCase_truckId_fkey"
FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DmvRenewalCase"
ADD CONSTRAINT "DmvRenewalCase_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DmvRenewalCaseDocument"
ADD CONSTRAINT "DmvRenewalCaseDocument_renewalId_fkey"
FOREIGN KEY ("renewalId") REFERENCES "DmvRenewalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DmvRenewalCaseDocument"
ADD CONSTRAINT "DmvRenewalCaseDocument_uploadedByUserId_fkey"
FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DmvRenewalCaseDocument"
ADD CONSTRAINT "DmvRenewalCaseDocument_sourceDocumentId_fkey"
FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DmvRenewalCaseStatusHistory"
ADD CONSTRAINT "DmvRenewalCaseStatusHistory_renewalId_fkey"
FOREIGN KEY ("renewalId") REFERENCES "DmvRenewalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DmvRenewalCaseStatusHistory"
ADD CONSTRAINT "DmvRenewalCaseStatusHistory_changedByUserId_fkey"
FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DmvRenewalCaseMessage"
ADD CONSTRAINT "DmvRenewalCaseMessage_renewalId_fkey"
FOREIGN KEY ("renewalId") REFERENCES "DmvRenewalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DmvRenewalCaseMessage"
ADD CONSTRAINT "DmvRenewalCaseMessage_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
