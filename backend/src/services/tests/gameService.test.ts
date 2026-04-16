import { startGame, revokePhaseSubmission, tryAdvanceInitialPromptsIfReadyByRoomCode, tryAdvanceInitialPromptsIfReady, getLobbyIdForFlipbook, advanceRoundIfChainPhaseComplete, getCurrentRound, submitDrawing, submitGuess, getAssignedFlipbook, advanceFlipbookPhase, checkPhaseCompletion } from '../gameService';
import { getPrisma } from '../../prisma/client';

// Create a mock prisma client
jest.mock('../../prisma/client', () => {
    const internalMock: any = {
        lobby: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        round: {
            create: jest.fn(),
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            updateMany: jest.fn(),
        },
        flipbook: {
            create: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
        },
        drawing: {
            create: jest.fn(),
            findFirst: jest.fn(),
            deleteMany: jest.fn(),
        },
        guess: {
            create: jest.fn(),
            findFirst: jest.fn(),
            deleteMany: jest.fn(),
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

/**
 * Factory to create a mock round that satisfies the new Wave-based logic.
 * N = Player Count.
 * Submissions needed per book = Math.floor(chainWave / 2) or similar logic.
 */
const createMockRoundForPhase = (overrides: any = {}) => {
    return {
        id: 'round-123',
        chainWave: 2,
        lobby: {
            players: [
                { id: 'u1', username: 'Analise' },
                { id: 'u2', username: 'Luke' },
                { id: 'u3', username: 'Gavin' }
            ]
        },
        flipbooks: [
            {
                id: 'fb-1',
                authorId: 'u1',
                _count: { drawings: 1, guesses: 1 },
                drawings: [{}],
                guesses: [{}]
            },
            {
                id: 'fb-2',
                authorId: 'u2',
                _count: { drawings: 1, guesses: 1 },
                drawings: [{}],
                guesses: [{}]
            },
            {
                id: 'fb-3',
                authorId: 'u3',
                _count: { drawings: 1, guesses: 1 },
                drawings: [{}],
                guesses: [{}]
            }
        ],
        ...overrides
    };
};

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
            await expect(submitGuess('fake', 'fake', 'random guess text')).rejects.toThrow('FLIPBOOK_NOT_FOUND');
        });

        it('should throw FLIPBOOK_NOT_ACCEPTING_GUESSES error for flipbook in DRAWING state', async () => {
            const mockFlipbook = {
                id: 'fb-123',
                state: 'DRAWING',
                authorId: 'user-A',
                drawings: [{ order: 2 }],
                guesses: [{ order: 1 }],
                prompt: 'here is a random prompt'
            }
            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);
            await expect(submitGuess('fb-123', 'u1', 'fake-drawing-data')).rejects.toThrow('FLIPBOOK_NOT_ACCEPTING_GUESSES');
        });

        it('should throw INITIAL_PROMPT_ALREADY_SUBMITTED error for user trying to submit second initial prompt on flipbook', async () => {
            const mockFlipbook = {
                id: 'fb-123',
                state: 'GUESSING',
                authorId: 'user-A',
                drawings: [{ order: 2 }],
                guesses: [{ order: 2 }],
                round: { chainWave: 1 },
                prompt: 'here is a random prompt'
            }
            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);
            await expect(submitGuess('fb-123', 'user-A', 'initial prompt already submitted')).rejects.toThrow('INITIAL_PROMPT_ALREADY_SUBMITTED');
        });

        it('should throw CAN_ONLY_WRITE_OWN_INITIAL_PROMPT error for non-author trying to write original prompt in a flipbook', async () => {
            const mockFlipbook = {
                id: 'fb-123',
                state: 'GUESSING',
                authorId: 'user-A',
                drawings: [{ order: 2 }],
                guesses: [{ order: 1 }],
            }
            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);
            await expect(submitGuess('fb-123', 'user-B', 'submitting a prompt')).rejects.toThrow('CAN_ONLY_WRITE_OWN_INITIAL_PROMPT');
        });

        it('should be able to submit an initial prompt as the author of a flipbook', async () => {
            const mockFlipbook = {
                id: 'fb-123',
                state: 'GUESSING',
                authorId: 'user-A',
                drawings: [{ order: 2 }],
                guesses: [{ order: 1 }],
            }
            // inject mocks with the mockFlipbook
            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);
            prismaMock.flipbook.update.mockResolvedValue(mockFlipbook);
            const result = await submitGuess('fb-123', 'user-A', 'submitting a prompt');
            expect(result.id).toBe('fb-123');
        });
    });

    describe('getAssignedFlipbook', () => {
        const mockUserId = 'user-1';
        const mockRoundId = 'round-99';

        it('should throw Error if round is missing lobby data', async () => {
            prismaMock.round.findUnique.mockResolvedValue({ id: 'r1', lobby: null });
            await expect(getAssignedFlipbook('r1', 'u1', 'DRAWING')).rejects.toThrow();
        });

        it('should assign a flipbook that is NOT the user’s own and hasn’t been drawn on yet', async () => {
            const mockRound = {
                id: mockRoundId,
                chainWave: 1,
                lobby: {
                    players: [{ id: mockUserId }, { id: 'user-3' }]
                },
                flipbooks: [
                    {
                        id: 'fb-own',
                        authorId: mockUserId,
                        drawings: [],
                        guesses: []
                    },
                    {
                        id: 'fb-target',
                        authorId: 'user-3',
                        drawings: [],
                        guesses: []
                    }
                ]
            };

            prismaMock.round.findUnique.mockResolvedValue(mockRound);

            const result = await getAssignedFlipbook(mockRoundId, mockUserId, 'DRAWING');

            expect(result?.id).toBe('fb-target');
        });

        it('should return null if all flipbooks are completed for the user', async () => {
            prismaMock.round.findUnique.mockResolvedValue({
                id: mockRoundId,
                chainWave: 1,
                lobby: {
                    players: [{ id: mockUserId }, { id: 'user-2' }]
                },
                flipbooks: [
                    { id: 'fb-1', authorId: mockUserId, drawings: [], guesses: [] },
                    { id: 'fb-2', authorId: 'user-2', drawings: [{ authorId: mockUserId }], guesses: [] }
                ]
            });

            const result = await getAssignedFlipbook(mockRoundId, mockUserId, 'DRAWING');
            expect(result).toBeNull();
        });

        it('should return null if all flipbooks are completed for the user', async () => {
            prismaMock.round.findUnique.mockResolvedValue({
                id: mockRoundId,
                chainWave: 1, // Need this for the math
                lobby: {
                    // Need this so line 517 can map the players
                    players: [{ id: mockUserId }, { id: 'user-2' }]
                },
                flipbooks: [
                    // Case 1: Rejection because it's the user's OWN book
                    { id: 'fb-1', authorId: mockUserId, drawings: [], guesses: [] },
                    // Case 2: Rejection because user already drew on it
                    { id: 'fb-2', authorId: 'user-2', drawings: [{ authorId: mockUserId }], guesses: [] }
                ]
            });

            const result = await getAssignedFlipbook(mockRoundId, mockUserId, 'DRAWING');
            expect(result).toBeNull();
        });

        it('should NOT assign own flipbook if a prompt already exists', async () => {
            const mockRound = {
                id: 'r1',
                chainWave: 2,
                lobby: {
                    players: [{ id: 'user-1' }, { id: 'u2' }, { id: 'u3' }]
                },
                flipbooks: [
                    { id: 'fb-own', authorId: 'user-1', prompt: 'cat', guesses: [], drawings: [] },
                    { id: 'fb-2', authorId: 'u2', prompt: 'dog', guesses: [], drawings: [] },
                    {
                        id: 'fb-3',
                        authorId: 'u3',
                        prompt: 'bird',
                        guesses: [],
                        drawings: [{ id: 'd1', authorId: 'u2', order: 1 }]
                    }
                ]
            };

            prismaMock.round.findUnique.mockResolvedValue(mockRound);

            const result = await getAssignedFlipbook('r1', 'user-1', 'GUESSING');

            expect(result?.id).toBe('fb-3');
        });

        it('should throw ROUND_NOT_FOUND if the database returns null', async () => {
            prismaMock.round.findUnique.mockResolvedValue(null);

            await expect(getAssignedFlipbook('fake', 'user', 'DRAWING'))
                .rejects.toThrow('ROUND_NOT_FOUND');
        });

        it('should return null if an invalid phase is provided', async () => {
            const mockRound = {
                id: 'r1',
                chainWave: 1,
                lobby: {
                    players: [{ id: mockUserId }, { id: 'u2' }]
                },
                flipbooks: [{ id: 'fb-1', authorId: 'other', drawings: [], guesses: [] }]
            };

            prismaMock.round.findUnique.mockResolvedValue(mockRound);

            const result = await getAssignedFlipbook('r1', 'user-1', 'VOTING' as any);

            expect(result).toBeNull();
        });
    });

    describe('advanceFlipbookPhase', () => {
        it('should transition state from DRAWING to GUESSING', async () => {
            const mockFlipbook = { id: 'fb-1', state: 'DRAWING' };

            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);
            prismaMock.flipbook.update.mockResolvedValue({ ...mockFlipbook, state: 'GUESSING' });

            const result = await advanceFlipbookPhase('fb-1');

            expect(result.state).toBe('GUESSING');
            expect(prismaMock.flipbook.update).toHaveBeenCalledWith(expect.objectContaining({
                data: { state: 'GUESSING' }
            }));
        });

        it('should transition state from GUESSING to VOTING', async () => {
            const mockFlipbook = { id: 'fb-1', state: 'GUESSING' };

            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);
            prismaMock.flipbook.update.mockResolvedValue({ ...mockFlipbook, state: 'VOTING' });

            const result = await advanceFlipbookPhase('fb-1');

            expect(result.state).toBe('VOTING');
        });

        it('should transition state from VOTING back to DRAWING', async () => {
            const mockFlipbook = { id: 'fb-1', state: 'VOTING' };

            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);
            prismaMock.flipbook.update.mockResolvedValue({ ...mockFlipbook, state: 'DRAWING' });

            const result = await advanceFlipbookPhase('fb-1');

            expect(result.state).toBe('DRAWING');
        });

        it('should throw FLIPBOOK_NOT_FOUND error if flipbook does not exist', async () => {
            prismaMock.flipbook.findUnique.mockResolvedValue(null);

            await expect(advanceFlipbookPhase('non-existent')).rejects.toThrow('FLIPBOOK_NOT_FOUND');
        });

        it('should throw INVALID_FLIPBOOK_STATE if the current state is not recognized', async () => {
            const mockFlipbook = { id: 'fb-1', state: 'COMPLETED' };

            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);

            await expect(advanceFlipbookPhase('fb-1')).rejects.toThrow('INVALID_FLIPBOOK_STATE');
        });
    });

    describe('checkPhaseCompletion', () => {
        const mockRoundId = 'round-123';
        it('should return true when all players have submitted for the DRAWING phase', async () => {
            const mockRound = createMockRoundForPhase({
                chainWave: 1,
                lobby: {
                    players: [{}, {}, {}]
                },
                flipbooks: [
                    { id: 'fb-1', _count: { drawings: 1, guesses: 0 } },
                    { id: 'fb-2', _count: { drawings: 1, guesses: 0 } },
                    { id: 'fb-3', _count: { drawings: 1, guesses: 0 } }
                ]
            });

            prismaMock.round.findUnique.mockResolvedValue(mockRound);
            const result = await checkPhaseCompletion(mockRoundId, 'DRAWING');

            expect(result).toBe(true);
        });

        it('should return false if one flipbook is missing a submission', async () => {
            const mockRound = createMockRoundForPhase({
                chainWave: 2,
                flipbooks: [
                    { id: 'fb-1', _count: { drawings: 1 } },
                    { id: 'fb-2', _count: { drawings: 0 } }, // FAIL: Missing drawing
                    { id: 'fb-3', _count: { drawings: 1 } }
                ]
            });

            prismaMock.round.findUnique.mockResolvedValue(mockRound);
            const result = await checkPhaseCompletion(mockRoundId, 'DRAWING');
            expect(result).toBe(false);
        });

        it('should return true for the GUESSING phase', async () => {
            const mockRound = createMockRoundForPhase({
                chainWave: 2,
                flipbooks: [
                    { id: 'fb-1', _count: { guesses: 1 } },
                    { id: 'fb-2', _count: { guesses: 1 } },
                    { id: 'fb-3', _count: { guesses: 1 } }
                ]
            });

            prismaMock.round.findUnique.mockResolvedValue(mockRound);
            const result = await checkPhaseCompletion(mockRoundId, 'GUESSING');
            expect(result).toBe(true);
        });

        it('should throw ROUND_NOT_FOUND error', async () => {
            prismaMock.round.findUnique.mockResolvedValue(null);
            await expect(checkPhaseCompletion('fake', 'DRAWING')).rejects.toThrow('ROUND_NOT_FOUND');
        });

        it('should return false for an unsupported phase', async () => {
            const mockRound = createMockRoundForPhase();
            prismaMock.round.findUnique.mockResolvedValue(mockRound);

            const result = await checkPhaseCompletion('r1', 'ARCHIVED' as any);
            expect(result).toBe(false);
        });
    });

    describe('advanceRoundIfChainPhaseComplete', () => {
        const lobbyId = 'lobby-advance';

        it('should return advanced: false if the round is not found', async () => {
            prismaMock.round.findFirst.mockResolvedValue(null);
            const result = await advanceRoundIfChainPhaseComplete(lobbyId, 'DRAWING');
            expect(result.advanced).toBe(false);
        });

        it('should return advanced: false if the phase is not yet complete', async () => {
            const mockRound = createMockRoundForPhase({
                chainWave: 1,
                lobby: { players: [{}, {}, {}] },
                flipbooks: [
                    { _count: { drawings: 1 } },
                    { _count: { drawings: 0 } },
                ]
            });

            prismaMock.round.findFirst.mockResolvedValue(mockRound);

            const result = await advanceRoundIfChainPhaseComplete(lobbyId, 'DRAWING');
            expect(result.advanced).toBe(false);
        });

        it('should advance to the next DRAWING/GUESSING phase if successful', async () => {
            const mockRound = createMockRoundForPhase({
                chainWave: 1,
                lobby: { players: [{ id: '1' }, { id: '2' }, { id: '3' }] },
                flipbooks: [{ _count: { drawings: 1 } }, { _count: { drawings: 1 } }, { _count: { drawings: 1 } }]
            });

            prismaMock.round.findFirst.mockResolvedValue(mockRound);
            prismaMock.round.updateMany.mockResolvedValue({ count: 1 });
            prismaMock.flipbook.updateMany.mockResolvedValue({ count: 3 });

            const result = await advanceRoundIfChainPhaseComplete(lobbyId, 'DRAWING');

            expect(result.advanced).toBe(true);
            if (result.advanced) {
                expect(result.newPhase).toBe('GUESSING');
            }
        });

        it('should transition to VOTING when the final wave is complete', async () => {
            const mockRound = createMockRoundForPhase({
                chainWave: 2,
                lobby: { players: [{}, {}, {}] },
                flipbooks: [{ _count: { guesses: 1 } }, { _count: { guesses: 1 } }, { _count: { guesses: 1 } }]
            });

            prismaMock.round.findFirst.mockResolvedValue(mockRound);
            prismaMock.round.updateMany.mockResolvedValue({ count: 1 });

            const result = await advanceRoundIfChainPhaseComplete(lobbyId, 'GUESSING');

            expect(result.advanced).toBe(true);
            if (result.advanced) {
                expect(result.newPhase).toBe('VOTING');
            }
        });

        it('should return advanced: false if the optimistic lock fails (count: 0)', async () => {
            const mockRound = createMockRoundForPhase({
                chainWave: 1,
                lobby: { players: [{}, {}] },
                flipbooks: [{ _count: { drawings: 1 } }, { _count: { drawings: 1 } }]
            });

            prismaMock.round.findFirst.mockResolvedValue(mockRound);
            prismaMock.round.updateMany.mockResolvedValue({ count: 0 });

            const result = await advanceRoundIfChainPhaseComplete(lobbyId, 'DRAWING');
            expect(result.advanced).toBe(false);
        });

        it('should catch errors and return advanced: false', async () => {
            prismaMock.round.findFirst.mockRejectedValue(new Error('Database crash'));

            const result = await advanceRoundIfChainPhaseComplete(lobbyId, 'DRAWING');
            expect(result.advanced).toBe(false);
        });

        it('should return advanced: false if the optimistic lock fails (update count is 0)', async () => {
            const mockRound = createMockRoundForPhase({
                chainWave: 1,
                lobby: { players: [{ id: 'u1' }, { id: 'u2' }] },
                flipbooks: [
                    { id: 'fb-1', _count: { drawings: 1, guesses: 0 } },
                    { id: 'fb-2', _count: { drawings: 1, guesses: 0 } }
                ]
            });

            prismaMock.round.findFirst.mockResolvedValue(mockRound);

            prismaMock.round.updateMany.mockResolvedValue({ count: 0 });

            const result = await advanceRoundIfChainPhaseComplete('lobby-123', 'DRAWING');

            expect(result.advanced).toBe(false);

            expect(prismaMock.flipbook.updateMany).not.toHaveBeenCalled();
        });
    });

    describe('tryAdvanceInitialPromptsIfReady', () => {
        const lobbyId = 'lobby-init-advance';

        it('should return advanced: false if lobbyId is invalid', async () => {
            // Covers the very first guard line
            const result = await tryAdvanceInitialPromptsIfReady('');
            expect(result.advanced).toBe(false);
            expect(result.skipReason).toBe('no_lobby_id');
        });

        it('should return skipReason: no_round if no round exists for lobby', async () => {
            prismaMock.round.findFirst.mockResolvedValue(null);
            const result = await tryAdvanceInitialPromptsIfReady(lobbyId);
            expect(result.advanced).toBe(false);
            expect(result.skipReason).toBe('no_round');
        });

        it('should return skipReason: chain_wave_not_zero if already advanced', async () => {
            prismaMock.round.findFirst.mockResolvedValue({ id: 'r1', chainWave: 1 });
            const result = await tryAdvanceInitialPromptsIfReady(lobbyId);
            expect(result.advanced).toBe(false);
            expect(result.skipReason).toBe('chain_wave_not_zero');
        });

        it('should return skipReason: prompts_incomplete if some prompts are empty', async () => {
            // Arrange: 2 players, but only 1 has a prompt
            prismaMock.round.findFirst.mockResolvedValue({ id: 'r1', chainWave: 0 });
            prismaMock.lobby.findUnique.mockResolvedValue({ _count: { players: 2 } });
            prismaMock.flipbook.findMany.mockResolvedValue([
                { prompt: 'A funny cat' },
                { prompt: '' } // The incomplete one
            ]);

            const result = await tryAdvanceInitialPromptsIfReady(lobbyId);

            expect(result.advanced).toBe(false);
            expect(result.skipReason).toBe('prompts_incomplete');
        });

        it('should advance to DRAWING phase when all conditions are met', async () => {
            // Arrange: All players have submitted prompts
            prismaMock.round.findFirst.mockResolvedValue({ id: 'r1', chainWave: 0 });
            prismaMock.lobby.findUnique.mockResolvedValue({ _count: { players: 2 } });
            prismaMock.flipbook.findMany.mockResolvedValue([
                { prompt: 'Prompt 1' },
                { prompt: 'Prompt 2' }
            ]);

            // Mock the optimistic update success
            prismaMock.round.updateMany.mockResolvedValue({ count: 1 });
            prismaMock.flipbook.updateMany.mockResolvedValue({ count: 2 });

            const result = await tryAdvanceInitialPromptsIfReady(lobbyId);

            expect(result.advanced).toBe(true);
            expect(result.endsAt).toBeDefined();
        });

        it('should return advanced: false if the update race was lost', async () => {
            prismaMock.round.findFirst.mockResolvedValue({ id: 'r1', chainWave: 0 });
            prismaMock.lobby.findUnique.mockResolvedValue({ _count: { players: 2 } });
            prismaMock.flipbook.findMany.mockResolvedValue([{ prompt: 'P1' }, { prompt: 'P2' }]);

            // Simulate another request updated the round first
            prismaMock.round.updateMany.mockResolvedValue({ count: 0 });

            const result = await tryAdvanceInitialPromptsIfReady(lobbyId);
            expect(result.advanced).toBe(false);
            expect(result.skipReason).toBe('round_update_race_lost');
        });

        it('should catch and log errors during transaction', async () => {
            prismaMock.round.findFirst.mockRejectedValue(new Error('Transaction Failed'));

            const result = await tryAdvanceInitialPromptsIfReady(lobbyId);
            expect(result.advanced).toBe(false);
        });

        it('should return skipReason: player_or_flipbook_count_mismatch if playerCount < 2', async () => {
            // Setup: Only 1 player in the lobby
            prismaMock.round.findFirst.mockResolvedValue({ id: 'r1', chainWave: 0 });
            prismaMock.lobby.findUnique.mockResolvedValue({ _count: { players: 1 } });
            prismaMock.flipbook.findMany.mockResolvedValue([{ prompt: 'P1' }]);

            const result = await tryAdvanceInitialPromptsIfReady('lobby-123');

            expect(result.advanced).toBe(false);
            expect(result.skipReason).toBe('player_or_flipbook_count_mismatch');
        });

        it('should return skipReason: player_or_flipbook_count_mismatch if counts do not match', async () => {
            // Setup: 3 players in lobby, but only 2 flipbooks exist in the database
            prismaMock.round.findFirst.mockResolvedValue({ id: 'r1', chainWave: 0 });
            prismaMock.lobby.findUnique.mockResolvedValue({ _count: { players: 3 } });
            prismaMock.flipbook.findMany.mockResolvedValue([
                { prompt: 'P1' },
                { prompt: 'P2' }
            ]);

            const result = await tryAdvanceInitialPromptsIfReady('lobby-123');

            expect(result.advanced).toBe(false);
            expect(result.skipReason).toBe('player_or_flipbook_count_mismatch');
        });
    });

    describe('getLobbyIdForFlipbook', () => {
        const mockFlipbookId = 'fb-999';
        const mockLobbyId = 'lobby-555';

        it('should return the lobbyId when the flipbook and round exist', async () => {
            prismaMock.flipbook.findUnique.mockResolvedValue({
                round: { lobbyId: mockLobbyId }
            });

            const result = await getLobbyIdForFlipbook(mockFlipbookId);

            expect(result).toBe(mockLobbyId);
            expect(prismaMock.flipbook.findUnique).toHaveBeenCalledWith({
                where: { id: mockFlipbookId },
                select: { round: { select: { lobbyId: true } } },
            });
        });

        it('should return null if the flipbook is found but has no associated round', async () => {
            prismaMock.flipbook.findUnique.mockResolvedValue({
                round: null
            });

            const result = await getLobbyIdForFlipbook(mockFlipbookId);

            expect(result).toBeNull();
        });

        it('should return null if the flipbook does not exist in the database', async () => {
            prismaMock.flipbook.findUnique.mockResolvedValue(null);

            const result = await getLobbyIdForFlipbook(mockFlipbookId);

            expect(result).toBeNull();
        });
    });

    describe('revokePhaseSubmission', () => {
        const mockFlipbookId = 'fb-revoke';
        const mockUserId = 'user-revoke';

        // Helper to create the complex nested mock object
        const setupMockFlipbook = (wave: number, state: string, playerCount: number = 2) => ({
            id: mockFlipbookId,
            state,
            authorId: 'author-A',
            round: {
                chainWave: wave,
                lobby: {
                    players: Array(playerCount).fill({ id: 'some-user' })
                }
            }
        });

        it('should throw FLIPBOOK_NOT_FOUND if flipbook does not exist', async () => {
            prismaMock.flipbook.findUnique.mockResolvedValue(null);
            await expect(revokePhaseSubmission(mockFlipbookId, mockUserId))
                .rejects.toThrow('FLIPBOOK_NOT_FOUND');
        });

        it('should throw REVOKE_NOT_ALLOWED if the phase is VOTING', async () => {
            const mockFlipbook = setupMockFlipbook(2, 'VOTING');
            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);

            await expect(revokePhaseSubmission(mockFlipbookId, mockUserId))
                .rejects.toThrow('REVOKE_NOT_ALLOWED');
        });

        it('should delete drawings when in DRAWING phase and state is DRAWING', async () => {
            const mockFlipbook = setupMockFlipbook(1, 'DRAWING');
            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);

            await revokePhaseSubmission(mockFlipbookId, mockUserId);

            expect(prismaMock.drawing.deleteMany).toHaveBeenCalledWith({
                where: { flipbookId: mockFlipbookId, authorId: mockUserId }
            });
        });

        it('should throw REVOKE_NOT_ALLOWED if phase is DRAWING but state is different', async () => {
            const mockFlipbook = setupMockFlipbook(1, 'COMPLETED');
            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);

            await expect(revokePhaseSubmission(mockFlipbookId, mockUserId))
                .rejects.toThrow('REVOKE_NOT_ALLOWED');
        });

        it('should delete guesses when in GUESSING phase and state is GUESSING', async () => {
            const mockFlipbook = setupMockFlipbook(0, 'GUESSING');
            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);

            await revokePhaseSubmission(mockFlipbookId, mockUserId);

            expect(prismaMock.guess.deleteMany).toHaveBeenCalledWith({
                where: { flipbookId: mockFlipbookId, authorId: mockUserId }
            });
        });

        it('should return early and NOT delete if revoking own initial prompt (Wave 0)', async () => {
            const mockFlipbook = setupMockFlipbook(0, 'GUESSING');
            mockFlipbook.authorId = mockUserId; // User is the author
            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);

            await revokePhaseSubmission(mockFlipbookId, mockUserId);

            expect(prismaMock.guess.deleteMany).not.toHaveBeenCalled();
        });
    });

    describe('tryAdvanceInitialPromptsIfReadyByRoomCode', () => {
        const mockRoomCode = 'TEST';
        const mockLobbyId = 'lobby-789';

        it('should return advanced: false if the lobby does not exist', async () => {
            // Mock Prisma to return null for the room code
            prismaMock.lobby.findUnique.mockResolvedValue(null);

            const result = await tryAdvanceInitialPromptsIfReadyByRoomCode(mockRoomCode);

            expect(result.advanced).toBe(false);
        });

        it('should return advanced: false if the lobby is not IN_PROGRESS', async () => {
            // Mock lobby exists but is in 'WAITING' state
            prismaMock.lobby.findUnique.mockResolvedValue({
                id: mockLobbyId,
                state: 'WAITING'
            });

            const result = await tryAdvanceInitialPromptsIfReadyByRoomCode(mockRoomCode);

            expect(result.advanced).toBe(false);
        });

        it('should call the ID-based advance function when lobby is valid', async () => {
            // 1. Mock the Room Code lookup
            prismaMock.lobby.findUnique.mockResolvedValue({
                id: mockLobbyId,
                state: 'IN_PROGRESS'
            });

            // 2. Mock the underlying Prisma calls that tryAdvanceInitialPromptsIfReady needs
            // (This is why the factory is helpful!)
            prismaMock.round.findFirst.mockResolvedValue({ id: 'r1', chainWave: 1 }); // Force a skip to keep it simple

            const result = await tryAdvanceInitialPromptsIfReadyByRoomCode('test'); // Testing lowercase conversion too

            // Verify it used the uppercase room code
            expect(prismaMock.lobby.findUnique).toHaveBeenCalledWith({
                where: { roomCode: 'TEST' },
                select: { id: true, state: true }
            });

            // Verify it returned the lobbyId as part of the result
            expect(result.lobbyId).toBe(mockLobbyId);
        });
    });

});