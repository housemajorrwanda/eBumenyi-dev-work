-- CreateTable
CREATE TABLE "meeting_survey" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "rating" INTEGER,
    "comment" TEXT,
    "name" TEXT,
    "phoneNumber" TEXT,
    "hospital" TEXT,
    "gender" TEXT,
    "district" TEXT,
    "sector" TEXT,
    "cell" TEXT,
    "village" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_survey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meeting_survey_attendanceId_key" ON "meeting_survey"("attendanceId");
