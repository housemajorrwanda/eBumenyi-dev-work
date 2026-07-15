-- CreateTable
CREATE TABLE "meeting_attendance" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "streamRoomId" TEXT,
    "userId" TEXT,
    "guestName" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "durationSec" INTEGER,

    CONSTRAINT "meeting_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meeting_attendance_eventId_idx" ON "meeting_attendance"("eventId");

-- CreateIndex
CREATE INDEX "meeting_attendance_streamRoomId_idx" ON "meeting_attendance"("streamRoomId");

-- CreateIndex
CREATE INDEX "meeting_attendance_userId_idx" ON "meeting_attendance"("userId");
