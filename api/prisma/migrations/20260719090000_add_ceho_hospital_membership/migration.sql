-- Purely additive migration: new hospital-based team-membership fields.

-- CreateEnum
CREATE TYPE "MemberSource" AS ENUM ('AUTO', 'MANUAL');

-- AlterTable: anchor each CEHO group to a hospital (nullable — a CEHO may not
-- have a hospital set yet)
ALTER TABLE "CEHOGroup" ADD COLUMN "hospitalId" TEXT;

-- AlterTable: track how a member was added, so automatic re-sync never
-- silently removes a deliberate manual placement
ALTER TABLE "CEHOGroupMember" ADD COLUMN "addedVia" "MemberSource" NOT NULL DEFAULT 'MANUAL';

-- CreateIndex: enforce one CEHO group per hospital (NULLs don't conflict)
CREATE UNIQUE INDEX "CEHOGroup_hospitalId_key" ON "CEHOGroup"("hospitalId");

-- AddForeignKey
ALTER TABLE "CEHOGroup" ADD CONSTRAINT "CEHOGroup_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;
