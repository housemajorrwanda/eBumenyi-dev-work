-- Rename RoleType enum value CHO -> CEHO (in-place rename, preserves existing
-- UserRole rows — same safe technique already used for SUPERVISOR -> CHO in
-- 20260521000000_add_cho_group_system).
ALTER TYPE "RoleType" RENAME VALUE 'CHO' TO 'CEHO';

-- Rename tables (preserves all rows and foreign keys pointing at them)
ALTER TABLE "CHOGroup" RENAME TO "CEHOGroup";
ALTER TABLE "CHOGroupMember" RENAME TO "CEHOGroupMember";
ALTER TABLE "CHOGroupInvitation" RENAME TO "CEHOGroupInvitation";

-- Rename column
ALTER TABLE "CEHOGroup" RENAME COLUMN "choId" TO "cehoId";

-- Rename constraints to match the new table/column names
-- Note: live DB has no FK constraints on these tables (verified via pg_constraint
-- before writing this migration — only primary keys exist), so only PKs are renamed.
ALTER TABLE "CEHOGroup" RENAME CONSTRAINT "CHOGroup_pkey" TO "CEHOGroup_pkey";
ALTER TABLE "CEHOGroupMember" RENAME CONSTRAINT "CHOGroupMember_pkey" TO "CEHOGroupMember_pkey";
ALTER TABLE "CEHOGroupInvitation" RENAME CONSTRAINT "CHOGroupInvitation_pkey" TO "CEHOGroupInvitation_pkey";

-- Rename indexes to match
ALTER INDEX "CHOGroup_choId_key" RENAME TO "CEHOGroup_cehoId_key";
ALTER INDEX "CHOGroup_groupChatId_key" RENAME TO "CEHOGroup_groupChatId_key";
ALTER INDEX "CHOGroupMember_studentId_key" RENAME TO "CEHOGroupMember_studentId_key";
ALTER INDEX "CHOGroupMember_groupId_idx" RENAME TO "CEHOGroupMember_groupId_idx";
ALTER INDEX "CHOGroupInvitation_groupId_studentId_key" RENAME TO "CEHOGroupInvitation_groupId_studentId_key";
ALTER INDEX "CHOGroupInvitation_studentId_idx" RENAME TO "CEHOGroupInvitation_studentId_idx";
