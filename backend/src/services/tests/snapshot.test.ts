import { formatLobbySnapshot, buildLobbySnapshotByRoomCode } from '../lobbySnapshotService';
import { getPrisma } from '../../prisma/client';

// 1. Mock the Prisma Client
jest.mock('../../prisma/client', () => ({
  getPrisma: jest.fn().mockReturnValue({
    lobby: {
      findUnique: jest.fn(),
    },
  }),
}));

const prismaMock = getPrisma() as any;

describe('Lobby Snapshot Service', () => {
  
  describe('formatLobbySnapshot', () => {
    it('should correctly map raw database fields to a clean DTO', () => {
      const mockRawData = {
        id: 'uuid-123',
        roomCode: 'PLAY',
        state: 'LOBBY',
        host: { id: 'u1', username: 'Host' },
        players: [{ id: 'u1', username: 'Host' }],
        rounds: [],
        createdAt: new Date(),
      };

      const result = formatLobbySnapshot(mockRawData);

      expect(result.id).toBe('uuid-123');
      expect(result.roomCode).toBe('PLAY');
      expect(result.currentRound).toBeUndefined(); // Tests the ternary logic
    });
  });

  describe('buildLobbySnapshotByRoomCode', () => {
    it('should throw LOBBY_NOT_FOUND if the database returns null', async () => {
      // Tell the mock to return null for this specific test
      prismaMock.lobby.findUnique.mockResolvedValue(null);

      await expect(buildLobbySnapshotByRoomCode('FAKE'))
        .rejects.toThrow('LOBBY_NOT_FOUND');
    });

    it('should convert room code to uppercase before searching', async () => {
      prismaMock.lobby.findUnique.mockResolvedValue({
          id: '1', roomCode: 'ABCD', host: {}, players: [], rounds: [] 
      });

      await buildLobbySnapshotByRoomCode('abcd');

      // Verify logic: did it call the DB with 'ABCD'?
      expect(prismaMock.lobby.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roomCode: 'ABCD' }
        })
      );
    });
  });
});