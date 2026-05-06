-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "paymentPercent" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "prepaymentAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ObjectType" ADD COLUMN     "paymentPercent" INTEGER;
