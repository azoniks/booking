-- CreateTable
CREATE TABLE "ObjectTypeSlot" (
    "id" TEXT NOT NULL,
    "objectTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "priceOverride" DECIMAL(10,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObjectTypeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ObjectTypeSlot_objectTypeId_sortOrder_idx" ON "ObjectTypeSlot"("objectTypeId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ObjectTypeSlot" ADD CONSTRAINT "ObjectTypeSlot_objectTypeId_fkey" FOREIGN KEY ("objectTypeId") REFERENCES "ObjectType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
