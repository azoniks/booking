-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "createdByAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "BookingGroup" ADD COLUMN     "createdByAdmin" BOOLEAN NOT NULL DEFAULT false;
