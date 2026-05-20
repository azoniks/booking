-- DropIndex
DROP INDEX "ObjectType_categoryId_idx";

-- AlterTable
ALTER TABLE "ObjectType" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ObjectType_categoryId_sortOrder_idx" ON "ObjectType"("categoryId", "sortOrder");
