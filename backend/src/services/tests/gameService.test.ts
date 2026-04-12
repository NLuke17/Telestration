import { startGame, getCurrentRound, submitDrawing, submitGuess } from '../gameService';
import { getPrisma } from '../../prisma/client';

// Create a mock prisma client
jest.mock('../../prisma/client', () => {
    const internalMock = {
        lobby: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        round: {
            create: jest.fn(),
            findFirst: jest.fn(),
        },
        flipbook: {
            create: jest.fn(),
            findUnique: jest.fn(),
        },
        drawing: {
            create: jest.fn(),
        },
        guess: {
            create: jest.fn(),
        },
        $transaction: jest.fn((callback) => callback(internalMock)),
    };

    return {
        __esModule: true,
        default: internalMock,
        getPrisma: jest.fn(() => internalMock),
    };
});

const prismaMock = getPrisma() as any;

describe('Game Service tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('startGame', () => {
        it('should change lobby state to IN PROGRESS', async () => {
            // create initial mock lobby
            const mockLobby = {
                id: 'lobby-1',
                state: 'WAITING',
                players: [{ id: 'u1' }, { id: 'u2' }],
                rounds: [{ number: 1 }]
            };

            // direct call to mocked lobby
            prismaMock.lobby.findUnique.mockResolvedValue(mockLobby);
            // create a mock round to reference
            prismaMock.round.create.mockResolvedValue({ id: 'round-1', number: 2 });
            // create a mock flipbook 
            prismaMock.flipbook.create.mockResolvedValue({ id: 'fb-1' });
            // give mocked lobby a state to reference
            prismaMock.lobby.update.mockResolvedValue({ ...mockLobby, state: 'IN_PROGRESS' });

            // call startGame on mocked lobby to ensure logic is working
            const result = await startGame('lobby-1');
            // Check that game was started by the lobby state
            expect(result.lobby.state).toBe('IN_PROGRESS');
        });

        it('should throw LOBBY_NOT_FOUND error if lobby is not found', async () => {
            prismaMock.lobby.findUnique.mockResolvedValue(null);
            await expect(startGame('fake-lobby')).rejects.toThrow('LOBBY_NOT_FOUND');
        });

        it('should throw LOBBY_ALREADY_STARTED error if lobby is not in WAITING state', async () => {
            const mockLobby = {
                id: 'started-lobby',
                state: 'IN_PROGRESS',
                players: [{ id: 'u1' }, { id: 'u2' }],
                rounds: [{ number: 1 }]
            };

            prismaMock.lobby.findUnique.mockResolvedValue(mockLobby);
            prismaMock.lobby.update.mockResolvedValue({ ...mockLobby, state: 'IN_PROGRESS' });

            await expect(startGame('started-lobby')).rejects.toThrow('LOBBY_ALREADY_STARTED');
        });

        it('should throw NOT_ENOUGH_PLAYERS error if there are less than two players in a lobby', async () => {
            const mockLobby = {
                id: 'small-lobby',
                state: 'WAITING',
                players: [{ id: 'u1' }],
                rounds: [{ number: 1 }]
            };
            prismaMock.lobby.findUnique.mockResolvedValue(mockLobby);

            await expect(startGame('small-lobby')).rejects.toThrow('NOT_ENOUGH_PLAYERS');
        });

        it('should throw PROMPT_COUNT_MISMATCH error if there are more prompts than players', async () => {
            const mockLobby = {
                id: 'lobby-2',
                state: 'WAITING',
                players: [{ id: 'u1' }, { id: 'u2' }],
                rounds: [{ number: 1 }]
            };
            prismaMock.lobby.findUnique.mockResolvedValue(mockLobby);

            let customPrompts = ['piece of poop', 'more poop', 'all the poop'];

            await expect(startGame('lobby-2', customPrompts)).rejects.toThrow('PROMPT_COUNT_MISMATCH');
        });

        it('should throw INVALID_PROMPTS error if there are empty prompts passed', async () => {
            const mockLobby = {
                id: 'lobby-3',
                state: 'WAITING',
                players: [{ id: 'u1' }, { id: 'u2' }],
                rounds: [{ number: 1 }]
            };
            prismaMock.lobby.findUnique.mockResolvedValue(mockLobby);

            let customPrompts = ['', 'more poop'];

            await expect(startGame('lobby-3', customPrompts)).rejects.toThrow('INVALID_PROMPTS');
        });
    });

    describe('getCurrentRound', () => {
        it('should return a valid round if there is one', async () => {
            // create mock round for testing
            const mockRound = {
                id: 'round-101',
                number: 1,
                lobbyId: 'lobby-123',
                flipbooks: [
                    {
                        id: 'fb-1',
                        author: { id: 'u1', username: 'person1', profilePicture: null },
                        drawings: [
                            { id: 'd-1', drawingData: 'path/to/img', author: { id: 'u2', username: 'person2' } }
                        ],
                        guesses: [
                            { id: 'g-1', text: 'A cat?', author: { id: 'u2', username: 'person2' } }
                        ]
                    }
                ]
            };
            // prefill mock with the mock round
            prismaMock.round.findFirst.mockResolvedValue(mockRound);

            const result = await getCurrentRound('lobby-123');
            // expect a valid returned round
            expect(result.id).toBe('round-101');
        });

        it('should throw ROUND_NOT_FOUND error for an invalid round', async () => {
            // pass a null round to the mock 
            prismaMock.round.findFirst.mockResolvedValue(null);
            // try to call getCurrent round with a null round
            await expect(getCurrentRound('lobby-3')).rejects.toThrow('ROUND_NOT_FOUND');
        });
    });

    describe('submitDrawing', () => {
        it('should successfully submit a drawing and increment the order', async () => {
            // create mock flipbook for testing
            const mockFlipbook = {
                id: 'fb-123',
                state: 'DRAWING',
                authorId: 'user-A',
                drawings: [{ order: 2 }],
                guesses: [{ order: 1 }]
            };
            // inject mock with values for calling
            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);
            prismaMock.drawing.create.mockResolvedValue({ id: 'd-1', order: 3 });

            const result = await submitDrawing('fb-123', 'user-B', 'image-data-string');
            // expect that calling submitDrawing will return the correct created flipbook id
            expect(result.id).toBe('d-1');
        });

        it('should throw FLIPBOOK_NOT_FOUND error for null flipbook', async () => {
            prismaMock.flipbook.findUnique.mockResolvedValue(null);
            await expect(submitDrawing('fake', 'fake', 'fake-drawing-data')).rejects.toThrow('FLIPBOOK_NOT_FOUND');
        });

        it('should throw FLIPBOOK_NOT_ACCEPTING_DRAWINGS error for flipbook in GUESSING state', async () => {
            const mockFlipbook = {
                id: 'fb-123',
                state: 'GUESSING',
                authorId: 'user-A',
                drawings: [{ order: 2 }],
                guesses: [{ order: 1 }]
            }
            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);
            await expect(submitDrawing('fb-123', 'u1', 'fake-drawing-data')).rejects.toThrow('FLIPBOOK_NOT_ACCEPTING_DRAWINGS');
        });

        it('should throw CANNOT_DRAW_OWN_FLIPBOOK error for user trying to draw on own flipbook', async () => {
            const mockFlipbook = {
                id: 'fb-123',
                state: 'DRAWING',
                authorId: 'user-A',
                drawings: [{ order: 2 }],
                guesses: [{ order: 1 }]
            }
            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);
            await expect(submitDrawing('fb-123', 'user-A', 'fake-drawing-data')).rejects.toThrow('CANNOT_DRAW_OWN_FLIPBOOK');
        });
    });

    describe('submitGuess', () => {
        it('should successfully submit a guess and increment the order', async () => {
            // create mock flipbook for testing
            const mockFlipbook = {
                id: 'fb-123',
                state: 'GUESSING',
                authorId: 'user-A',
                drawings: [{ order: 2 }],
                guesses: [{ order: 1 }],
                prompt: 'fake prompt'
            };
            // inject mock with values for calling
            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);
            prismaMock.guess.create.mockResolvedValue({ id: 'd-1', order: 3, text: 'this is a guess', flipbookId: 'fb-123' });

            const result = await submitGuess('fb-123', 'user-B', 'image-data-string');
            // expect that calling submitGuess will return the correct created flipbook id
            expect(result.id).toBe('d-1');
        });

        it('should throw FLIPBOOK_NOT_FOUND error for null flipbook', async () => {
            prismaMock.flipbook.findUnique.mockResolvedValue(null);
            await expect(submitDrawing('fake', 'fake', 'fake-drawing-data')).rejects.toThrow('FLIPBOOK_NOT_FOUND');
        });

        it('should throw FLIPBOOK_NOT_ACCEPTING_DRAWINGS error for flipbook in GUESSING state', async () => {
            const mockFlipbook = {
                id: 'fb-123',
                state: 'GUESSING',
                authorId: 'user-A',
                drawings: [{ order: 2 }],
                guesses: [{ order: 1 }]
            }
            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);
            await expect(submitDrawing('fb-123', 'u1', 'fake-drawing-data')).rejects.toThrow('FLIPBOOK_NOT_ACCEPTING_DRAWINGS');
        });

        it('should throw CANNOT_DRAW_OWN_FLIPBOOK error for user trying to draw on own flipbook', async () => {
            const mockFlipbook = {
                id: 'fb-123',
                state: 'DRAWING',
                authorId: 'user-A',
                drawings: [{ order: 2 }],
                guesses: [{ order: 1 }]
            }
            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);
            await expect(submitDrawing('fb-123', 'user-A', 'fake-drawing-data')).rejects.toThrow('CANNOT_DRAW_OWN_FLIPBOOK');
        });
    })
});