-- DropForeignKey
ALTER TABLE "Drawing" DROP CONSTRAINT "Drawing_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Drawing" DROP CONSTRAINT "Drawing_flipbookId_fkey";

-- DropForeignKey
ALTER TABLE "Flipbook" DROP CONSTRAINT "Flipbook_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Flipbook" DROP CONSTRAINT "Flipbook_roundId_fkey";

-- DropForeignKey
ALTER TABLE "Guess" DROP CONSTRAINT "Guess_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Guess" DROP CONSTRAINT "Guess_flipbookId_fkey";

-- DropForeignKey
ALTER TABLE "Lobby" DROP CONSTRAINT "Lobby_hostId_fkey";

-- DropForeignKey
ALTER TABLE "Round" DROP CONSTRAINT "Round_lobbyId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "loginAttempts" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lobby" ADD CONSTRAINT "Lobby_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flipbook" ADD CONSTRAINT "Flipbook_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flipbook" ADD CONSTRAINT "Flipbook_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drawing" ADD CONSTRAINT "Drawing_flipbookId_fkey" FOREIGN KEY ("flipbookId") REFERENCES "Flipbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drawing" ADD CONSTRAINT "Drawing_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guess" ADD CONSTRAINT "Guess_flipbookId_fkey" FOREIGN KEY ("flipbookId") REFERENCES "Flipbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guess" ADD CONSTRAINT "Guess_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
