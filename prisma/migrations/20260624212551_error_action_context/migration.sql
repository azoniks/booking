-- AlterTable
ALTER TABLE "ServerErrorLog" ADD COLUMN     "action" TEXT,
ADD COLUMN     "context" JSONB;
