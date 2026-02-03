/*
  Migration: Credential Reuse by AnonymousId
  
  This migration restructures credential storage to link to anonymousId instead
  of checkInId, enabling credential reuse across multiple check-in sessions.

  Warnings:
  - Existing credentials will be migrated to use anonymousId from their linked CheckIn
  - If no linked CheckIn exists, the credential row will be deleted (orphaned)
*/

-- DropForeignKey
ALTER TABLE "public"."SoftwareKey" DROP CONSTRAINT IF EXISTS "SoftwareKey_checkInId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WebAuthnCredential" DROP CONSTRAINT IF EXISTS "WebAuthnCredential_checkInId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "public"."AuthChallenge_checkInId_idx";

-- DropIndex
DROP INDEX IF EXISTS "public"."SoftwareKey_checkInId_key";

-- DropIndex
DROP INDEX IF EXISTS "public"."WebAuthnCredential_checkInId_key";

-- Step 1: Add new columns as NULLABLE first
ALTER TABLE "WebAuthnCredential" ADD COLUMN "anonymousId" TEXT;
ALTER TABLE "WebAuthnCredential" ADD COLUMN "updatedAt" TIMESTAMP(3);

ALTER TABLE "SoftwareKey" ADD COLUMN "anonymousId" TEXT;
ALTER TABLE "SoftwareKey" ADD COLUMN "keyFingerprint" TEXT;
ALTER TABLE "SoftwareKey" ADD COLUMN "updatedAt" TIMESTAMP(3);

ALTER TABLE "AuthChallenge" ADD COLUMN "anonymousId" TEXT;

-- Step 2: Populate anonymousId from the linked CheckIn record
UPDATE "WebAuthnCredential" wc
SET 
  "anonymousId" = c."anonymousId",
  "updatedAt" = NOW()
FROM "CheckIn" c
WHERE wc."checkInId" = c."id";

UPDATE "SoftwareKey" sk
SET 
  "anonymousId" = c."anonymousId",
  "keyFingerprint" = ENCODE(SHA256(sk."publicKeyJwk"::bytea), 'hex'),
  "updatedAt" = NOW()
FROM "CheckIn" c
WHERE sk."checkInId" = c."id";

UPDATE "AuthChallenge" ac
SET "anonymousId" = c."anonymousId"
FROM "CheckIn" c
WHERE ac."checkInId" = c."id";

-- Step 3: Delete orphaned records (those without a linked CheckIn)
DELETE FROM "WebAuthnCredential" WHERE "anonymousId" IS NULL;
DELETE FROM "SoftwareKey" WHERE "anonymousId" IS NULL;
DELETE FROM "AuthChallenge" WHERE "anonymousId" IS NULL;

-- Step 4: Make columns NOT NULL after population
ALTER TABLE "WebAuthnCredential" ALTER COLUMN "anonymousId" SET NOT NULL;
ALTER TABLE "WebAuthnCredential" ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "SoftwareKey" ALTER COLUMN "anonymousId" SET NOT NULL;
ALTER TABLE "SoftwareKey" ALTER COLUMN "keyFingerprint" SET NOT NULL;
ALTER TABLE "SoftwareKey" ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "AuthChallenge" ALTER COLUMN "anonymousId" SET NOT NULL;

-- Step 5: Drop old checkInId columns
ALTER TABLE "AuthChallenge" DROP COLUMN "checkInId";
ALTER TABLE "SoftwareKey" DROP COLUMN "checkInId";
ALTER TABLE "WebAuthnCredential" DROP COLUMN "checkInId";

-- Step 6: Add new column to CheckIn for credential linking
ALTER TABLE "CheckIn" ADD COLUMN "credentialId" TEXT;

-- Step 7: Create new indexes
CREATE INDEX "AuthChallenge_anonymousId_idx" ON "AuthChallenge"("anonymousId");

CREATE UNIQUE INDEX "SoftwareKey_keyFingerprint_key" ON "SoftwareKey"("keyFingerprint");
CREATE INDEX "SoftwareKey_anonymousId_idx" ON "SoftwareKey"("anonymousId");
CREATE INDEX "SoftwareKey_keyFingerprint_idx" ON "SoftwareKey"("keyFingerprint");

CREATE UNIQUE INDEX "WebAuthnCredential_credentialId_key" ON "WebAuthnCredential"("credentialId");
CREATE INDEX "WebAuthnCredential_anonymousId_idx" ON "WebAuthnCredential"("anonymousId");
