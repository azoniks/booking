-- CreateTable
CREATE TABLE "GuestContact" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "telegramChatId" TEXT,
    "maxChatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestContact_phone_key" ON "GuestContact"("phone");
