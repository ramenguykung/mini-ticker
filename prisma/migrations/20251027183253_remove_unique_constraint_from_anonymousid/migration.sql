-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "anonymousId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "checkInTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutTime" TIMESTAMP(3),
    "deviceInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CheckIn_anonymousId_idx" ON "CheckIn"("anonymousId");

-- CreateIndex
CREATE INDEX "CheckIn_status_idx" ON "CheckIn"("status");

-- CreateIndex
CREATE INDEX "CheckIn_anonymousId_status_idx" ON "CheckIn"("anonymousId", "status");
