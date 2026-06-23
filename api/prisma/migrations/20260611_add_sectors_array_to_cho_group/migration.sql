-- AlterTable: replace single sector column with sectors array
ALTER TABLE "CHOGroup" DROP COLUMN IF EXISTS "sector";
ALTER TABLE "CHOGroup" ADD COLUMN IF NOT EXISTS "sectors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
