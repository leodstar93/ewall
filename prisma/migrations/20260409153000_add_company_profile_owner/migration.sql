ALTER TABLE "CompanyProfile"
ADD COLUMN "owner" TEXT;

UPDATE "CompanyProfile" AS cp
SET "owner" = u."name"
FROM "User" AS u
WHERE u."id" = cp."userId"
  AND cp."owner" IS NULL;
