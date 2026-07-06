-- CreateTable
CREATE TABLE IF NOT EXISTS "background_images" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "background_images_pkey" PRIMARY KEY ("id")
);
