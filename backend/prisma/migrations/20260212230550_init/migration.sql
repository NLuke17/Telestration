-- CreateEnum
CREATE TYPE "LobbyState" AS ENUM ('WAITING', 'STARTING', 'IN_PROGRESS', 'FINISHED');

-- CreateEnum
CREATE TYPE "FlipbookState" AS ENUM ('DRAWING', 'GUESSING', 'VOTING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "profilePicture" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lobby" (
    "id" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "state" "LobbyState" NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hostId" TEXT NOT NULL,

    CONSTRAINT "Lobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lobbyId" TEXT NOT NULL,
    "winnerId" TEXT,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flipbook" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "state" "FlipbookState" NOT NULL DEFAULT 'DRAWING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,

    CONSTRAINT "Flipbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drawing" (
    "id" TEXT NOT NULL,
    "drawingData" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flipbookId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "Drawing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guess" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flipbookId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "Guess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_LobbyPlayers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LobbyPlayers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Lobby_roomCode_key" ON "Lobby"("roomCode");

-- CreateIndex
CREATE INDEX "_LobbyPlayers_B_index" ON "_LobbyPlayers"("B");

-- AddForeignKey
ALTER TABLE "Lobby" ADD CONSTRAINT "Lobby_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flipbook" ADD CONSTRAINT "Flipbook_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flipbook" ADD CONSTRAINT "Flipbook_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drawing" ADD CONSTRAINT "Drawing_flipbookId_fkey" FOREIGN KEY ("flipbookId") REFERENCES "Flipbook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drawing" ADD CONSTRAINT "Drawing_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guess" ADD CONSTRAINT "Guess_flipbookId_fkey" FOREIGN KEY ("flipbookId") REFERENCES "Flipbook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guess" ADD CONSTRAINT "Guess_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LobbyPlayers" ADD CONSTRAINT "_LobbyPlayers_A_fkey" FOREIGN KEY ("A") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LobbyPlayers" ADD CONSTRAINT "_LobbyPlayers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
