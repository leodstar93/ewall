CREATE TABLE "EldProviderCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "loginUrl" TEXT,
    "usernameEncrypted" TEXT NOT NULL,
    "passwordEncrypted" TEXT NOT NULL,
    "accountIdentifierEncrypted" TEXT,
    "notesEncrypted" TEXT,
    "encryptionVersion" INTEGER NOT NULL,
    "encryptionKeyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EldProviderCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EldProviderCredential_userId_key" ON "EldProviderCredential"("userId");
CREATE INDEX "EldProviderCredential_providerName_idx" ON "EldProviderCredential"("providerName");
CREATE INDEX "EldProviderCredential_encryptionKeyId_encryptionVersion_idx" ON "EldProviderCredential"("encryptionKeyId", "encryptionVersion");

ALTER TABLE "EldProviderCredential"
ADD CONSTRAINT "EldProviderCredential_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
