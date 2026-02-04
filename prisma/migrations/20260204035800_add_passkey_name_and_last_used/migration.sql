-- AlterTable
ALTER TABLE "WebAuthnCredential" ADD COLUMN     "name" VARCHAR(100),
ADD COLUMN     "lastUsedAt" TIMESTAMP(3);
