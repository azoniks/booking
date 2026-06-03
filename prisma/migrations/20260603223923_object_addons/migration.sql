-- AlterTable
ALTER TABLE "BookingObject" ADD COLUMN     "isAddon" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "_ObjectAddons" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ObjectAddons_AB_unique" ON "_ObjectAddons"("A", "B");

-- CreateIndex
CREATE INDEX "_ObjectAddons_B_index" ON "_ObjectAddons"("B");

-- AddForeignKey
ALTER TABLE "_ObjectAddons" ADD CONSTRAINT "_ObjectAddons_A_fkey" FOREIGN KEY ("A") REFERENCES "BookingObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ObjectAddons" ADD CONSTRAINT "_ObjectAddons_B_fkey" FOREIGN KEY ("B") REFERENCES "BookingObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

