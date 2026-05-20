-- CreateEnum
CREATE TYPE "PrepaymentType" AS ENUM ('PERCENT', 'FIXED');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "paymentType" "PrepaymentType" NOT NULL DEFAULT 'PERCENT';

-- AlterTable
ALTER TABLE "ObjectType" ADD COLUMN     "paymentAmount" DECIMAL(10,2),
ADD COLUMN     "paymentType" "PrepaymentType" NOT NULL DEFAULT 'PERCENT';
