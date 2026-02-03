-- AlterTable
ALTER TABLE "CheckIn" ADD COLUMN     "verificationMethod" TEXT;

-- CreateTable
CREATE TABLE "WebAuthnCredential" (
    "id" TEXT NOT NULL,
    "checkInId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebAuthnCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftwareKey" (
    "id" TEXT NOT NULL,
    "checkInId" TEXT NOT NULL,
    "publicKeyJwk" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoftwareKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthChallenge" (
    "id" TEXT NOT NULL,
    "checkInId" TEXT NOT NULL,
    "challenge" VARCHAR(100) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebAuthnCredential_checkInId_key" ON "WebAuthnCredential"("checkInId");

-- CreateIndex
CREATE INDEX "WebAuthnCredential_credentialId_idx" ON "WebAuthnCredential"("credentialId");

-- CreateIndex
CREATE UNIQUE INDEX "SoftwareKey_checkInId_key" ON "SoftwareKey"("checkInId");

-- CreateIndex
CREATE INDEX "AuthChallenge_checkInId_idx" ON "AuthChallenge"("checkInId");

-- CreateIndex
CREATE INDEX "AuthChallenge_expiresAt_idx" ON "AuthChallenge"("expiresAt");

-- AddForeignKey
ALTER TABLE "WebAuthnCredential" ADD CONSTRAINT "WebAuthnCredential_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "CheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoftwareKey" ADD CONSTRAINT "SoftwareKey_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "CheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
