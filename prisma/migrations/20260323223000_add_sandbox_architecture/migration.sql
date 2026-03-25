CREATE TABLE "SandboxScenario" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "moduleKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SandboxScenario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SandboxAuditLog" (
    "id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actingAsUserId" TEXT,
    "actingAsRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SandboxImpersonationSession" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actingAsUserId" TEXT,
    "actingAsRole" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SandboxImpersonationSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SandboxScenario_key_key" ON "SandboxScenario"("key");
CREATE INDEX "SandboxAuditLog_createdAt_idx" ON "SandboxAuditLog"("createdAt");
CREATE INDEX "SandboxAuditLog_action_createdAt_idx" ON "SandboxAuditLog"("action", "createdAt");
CREATE INDEX "SandboxAuditLog_actorUserId_createdAt_idx" ON "SandboxAuditLog"("actorUserId", "createdAt");
CREATE INDEX "SandboxImpersonationSession_actorUserId_isActive_idx" ON "SandboxImpersonationSession"("actorUserId", "isActive");
CREATE INDEX "SandboxImpersonationSession_actingAsUserId_isActive_idx" ON "SandboxImpersonationSession"("actingAsUserId", "isActive");
