/*
  Warnings:

  - You are about to alter the column `anonymousId` on the `CheckIn` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.

*/
-- AlterTable
ALTER TABLE "CheckIn" ALTER COLUMN "anonymousId" SET DATA TYPE VARCHAR(100);

-- CreateIndex
CREATE INDEX "CheckIn_checkInTime_idx" ON "CheckIn"("checkInTime");
