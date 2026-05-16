-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "sectionsBooked" INTEGER;

-- AlterTable
ALTER TABLE "ObjectType" ADD COLUMN     "fullVenuePrice" DECIMAL(10,2),
ADD COLUMN     "sectionCapacity" INTEGER,
ADD COLUMN     "sectionsBookingMax" INTEGER,
ADD COLUMN     "sectionsTotal" INTEGER;
