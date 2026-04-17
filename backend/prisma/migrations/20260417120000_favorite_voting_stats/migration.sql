-- AlterTable
ALTER TABLE "User" ADD COLUMN "totalVotesReceived" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "wins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "gamesPlayed" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Round" ADD COLUMN "votingResults" JSONB;

-- CreateTable
CREATE TABLE "RoundVote" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "flipbookId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoundVote_roundId_voterId_key" ON "RoundVote"("roundId", "voterId");
CREATE INDEX "RoundVote_roundId_idx" ON "RoundVote"("roundId");

ALTER TABLE "RoundVote" ADD CONSTRAINT "RoundVote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoundVote" ADD CONSTRAINT "RoundVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoundVote" ADD CONSTRAINT "RoundVote_flipbookId_fkey" FOREIGN KEY ("flipbookId") REFERENCES "Flipbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
