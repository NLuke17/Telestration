-- CreateEnum
CREATE TYPE "DrawingStorageKind" AS ENUM ('INLINE', 'LOCAL_FILE');

-- AlterTable
ALTER TABLE "Drawing" ADD COLUMN     "storageKind" "DrawingStorageKind" NOT NULL DEFAULT 'INLINE',
ADD COLUMN     "storageKey" TEXT,
ADD COLUMN     "byteLength" INTEGER;

-- AlterTable
ALTER TABLE "Drawing" ALTER COLUMN "drawingData" DROP NOT NULL;

UPDATE "Drawing" SET "byteLength" = octet_length("drawingData") WHERE "drawingData" IS NOT NULL;

CREATE UNIQUE INDEX "Drawing_storageKey_key" ON "Drawing"("storageKey");

-- CreateTable
CREATE TABLE "SavedFlipbook" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sourceFlipbookId" TEXT,
    "sourceRoundId" TEXT,
    "prompt" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedFlipbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedDrawing" (
    "id" TEXT NOT NULL,
    "savedFlipbookId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorUsername" TEXT NOT NULL,
    "drawingData" TEXT,
    "storageKind" "DrawingStorageKind" NOT NULL DEFAULT 'INLINE',
    "storageKey" TEXT,
    "byteLength" INTEGER,

    CONSTRAINT "SavedDrawing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedGuess" (
    "id" TEXT NOT NULL,
    "savedFlipbookId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorUsername" TEXT NOT NULL,

    CONSTRAINT "SavedGuess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedFlipbook_ownerId_sourceFlipbookId_key" ON "SavedFlipbook"("ownerId", "sourceFlipbookId");

CREATE INDEX "SavedFlipbook_ownerId_idx" ON "SavedFlipbook"("ownerId");

CREATE UNIQUE INDEX "SavedDrawing_storageKey_key" ON "SavedDrawing"("storageKey");

CREATE INDEX "SavedDrawing_savedFlipbookId_idx" ON "SavedDrawing"("savedFlipbookId");

CREATE INDEX "SavedGuess_savedFlipbookId_idx" ON "SavedGuess"("savedFlipbookId");

ALTER TABLE "SavedFlipbook" ADD CONSTRAINT "SavedFlipbook_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedDrawing" ADD CONSTRAINT "SavedDrawing_savedFlipbookId_fkey" FOREIGN KEY ("savedFlipbookId") REFERENCES "SavedFlipbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedGuess" ADD CONSTRAINT "SavedGuess_savedFlipbookId_fkey" FOREIGN KEY ("savedFlipbookId") REFERENCES "SavedFlipbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
