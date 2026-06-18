-- AlterTable: add cells and villages parallel arrays to CHOGroup
ALTER TABLE "CHOGroup" ADD COLUMN IF NOT EXISTS "cells" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CHOGroup" ADD COLUMN IF NOT EXISTS "villages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
