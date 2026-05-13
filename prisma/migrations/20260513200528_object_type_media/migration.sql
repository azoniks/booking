-- CreateTable
CREATE TABLE "ObjectTypeMedia" (
    "id" TEXT NOT NULL,
    "objectTypeId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "thumbUrl" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObjectTypeMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ObjectTypeMedia_objectTypeId_idx" ON "ObjectTypeMedia"("objectTypeId");

-- AddForeignKey
ALTER TABLE "ObjectTypeMedia" ADD CONSTRAINT "ObjectTypeMedia_objectTypeId_fkey" FOREIGN KEY ("objectTypeId") REFERENCES "ObjectType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
