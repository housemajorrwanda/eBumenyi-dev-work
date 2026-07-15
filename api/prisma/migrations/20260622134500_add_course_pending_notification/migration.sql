-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "lastNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "pendingNotificationType" TEXT;
