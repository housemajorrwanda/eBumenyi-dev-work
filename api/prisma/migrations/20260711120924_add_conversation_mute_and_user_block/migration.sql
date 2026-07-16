-- CreateTable
CREATE TABLE "conversation_mutes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationType" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "mutedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_mutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_blocks" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_mutes_userId_idx" ON "conversation_mutes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_mutes_userId_conversationType_conversationId_key" ON "conversation_mutes"("userId", "conversationType", "conversationId");

-- CreateIndex
CREATE INDEX "user_blocks_blockerId_idx" ON "user_blocks"("blockerId");

-- CreateIndex
CREATE INDEX "user_blocks_blockedId_idx" ON "user_blocks"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "user_blocks_blockerId_blockedId_key" ON "user_blocks"("blockerId", "blockedId");
