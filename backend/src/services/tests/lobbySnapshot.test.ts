import { formatLobbySnapshot, buildLobbySnapshotByRoomCode, buildLobbySnapshot } from '../lobbySnapshotService';
import { getPrisma } from '../../prisma/client';

// Create a mock prisma client
jest.mock('../../prisma/client', () => ({
  getPrisma: jest.fn().mockReturnValue({
    lobby: {
      findUnique: jest.fn(),
    },
  }),
}));

const prismaMock = getPrisma() as any;

// Run the command 'npm test -- --coverage' to see test coverage
describe('Lobby Snapshot Service tests', () => {
  
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

    it('should return undefined if rounds < 0', async () => {
        const mockLobbyData = {
            id: '1', roomCode: 'ABCD', host: {}, players: [], rounds: [], createdAt: new Date()
        }

        const result = formatLobbySnapshot(mockLobbyData);

        expect(result.currentRound).toBe(undefined);
    });

    it('should return round information if rounds > 0', async () => {
        // create mock data w/ a round
        const mockRawData = {
            id: 'ran123',
            roomCode: 'PLAY',
            state: 'LOBBY',
            host: { id: 'u1', username: 'Host', profilePicture: 'url' },
            players: [{ id: 'u1', username: 'Host', profilePicture: 'url' }],
            rounds: [
                {
                    id: 'round-123',
                    number: 1,
                    flipbooks: [
                        {
                            id: 'fb-1',
                            prompt: 'A cat wearing a hat',
                            votes: 3,
                            state: 'COMPLETED',
                            author: {
                                id: 'u1',
                                username: 'Host',
                                profilePicture: 'url'
                            }
                        }
                    ]
                }
            ],
            createdAt: new Date(),
        };
        const result = formatLobbySnapshot(mockRawData);
        expect(result.currentRound).toBeDefined();
    });

    it('should return flipbook information when lobby.rounds.length > 0', async () => {
        // create mock data w/ a round and flipbook
        const mockRawData = {
            id: 'ran123',
            roomCode: 'PLAY',
            state: 'LOBBY',
            host: { id: 'u1', username: 'Host', profilePicture: 'url' },
            players: [{ id: 'u1', username: 'Host', profilePicture: 'url' }],
            rounds: [
                {
                    id: 'round-123',
                    number: 1,
                    flipbooks: [
                        {
                            id: 'fb-1',
                            prompt: 'A cat wearing a hat',
                            votes: 3,
                            state: 'COMPLETED',
                            author: {
                                id: 'u1',
                                username: 'Host',
                                profilePicture: 'url'
                            }
                        }
                    ]
                }
            ],
            createdAt: new Date(),
        };
        const result = formatLobbySnapshot(mockRawData);
        // Check that a flipbook object for the round is defined
        expect(result.currentRound?.flipbooks).toBeDefined();
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

  describe('buildLobbySnapshotByLobbyID', () => {
    it('should create lobby with correct ID and return created lobby with correct ID', async() => {
        const mockHappyLobby = {
            id: 'ran123',
            roomCode: 'PLAY',
            state: 'LOBBY',
            host: { id: 'u1', username: 'Host' },
            players: [{ id: 'u1', username: 'Host' }],
            rounds: [],
            createdAt: new Date(),
        }

        prismaMock.lobby.findUnique.mockResolvedValue(mockHappyLobby);

        const result = await buildLobbySnapshot('ran123');

        // Check that prisma mock called buildLobbySnapshot with correct id and returned correct id
        expect(prismaMock.lobby.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'ran123' }
            })
        );
        expect(result.id).toBe('ran123');
    });

    it('should return LOBBY_NOT_FOUND error if database returns null', async() => {
        // tell prisma mock to return null as database
        prismaMock.lobby.findUnique.mockResolvedValue(null);
        // build lobby with fake value and expect error
        await expect(buildLobbySnapshot('FAKE'))
        .rejects.toThrow('LOBBY_NOT_FOUND');
    });

  });
});