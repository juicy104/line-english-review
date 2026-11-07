ALTER TABLE "User" ADD COLUMN "defaultDeckId" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_defaultDeckId_fkey"
FOREIGN KEY ("defaultDeckId") REFERENCES "Deck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "User"
SET "defaultDeckId" = (
  SELECT "id" FROM "Deck"
  WHERE "Deck"."userId" = "User"."id"
  ORDER BY "createdAt" ASC, "id" ASC
  LIMIT 1
);
