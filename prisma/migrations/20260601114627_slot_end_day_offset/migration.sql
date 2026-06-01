-- Add endDayOffset to ObjectTypeSlot to support slots longer than 24h.
ALTER TABLE "ObjectTypeSlot"
  ADD COLUMN "endDayOffset" INTEGER NOT NULL DEFAULT 0;

-- Backfill: legacy "crosses midnight" (endTime <= startTime) -> endDayOffset = 1.
UPDATE "ObjectTypeSlot"
SET "endDayOffset" = 1
WHERE
  (CAST(SPLIT_PART("endTime", ':', 1) AS INT) * 60 + CAST(SPLIT_PART("endTime", ':', 2) AS INT))
  <=
  (CAST(SPLIT_PART("startTime", ':', 1) AS INT) * 60 + CAST(SPLIT_PART("startTime", ':', 2) AS INT));
