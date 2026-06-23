-- AlterTable: add groupChatId to CHOGroup
ALTER TABLE "CHOGroup" ADD COLUMN "groupChatId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CHOGroup_groupChatId_key" ON "CHOGroup"("groupChatId");
