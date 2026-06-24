-- CreateEnum
CREATE TYPE "ErrorSource" AS ENUM ('API', 'RENDER', 'SCHEDULER', 'OTHER');

-- CreateTable
CREATE TABLE "ServerErrorLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "ErrorSource" NOT NULL DEFAULT 'API',
    "method" TEXT,
    "path" TEXT,
    "statusCode" INTEGER,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "digest" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ServerErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServerErrorLog_createdAt_idx" ON "ServerErrorLog"("createdAt");

-- CreateIndex
CREATE INDEX "ServerErrorLog_source_idx" ON "ServerErrorLog"("source");

-- CreateIndex
CREATE INDEX "ServerErrorLog_resolvedAt_idx" ON "ServerErrorLog"("resolvedAt");
