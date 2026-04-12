import { startGame, getCurrentRound, submitDrawing, submitGuess, getAssignedFlipbook, advanceFlipbookPhase, checkPhaseCompletion } from '../gameService';
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
            findUnique: jest.fn(),
        },
        flipbook: {
            create: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
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

        it('should throw CANNOT_GUESS_OWN_FLIPBOOK error for user trying to guess on own flipbook', async () => {
            const mockFlipbook = {
                id: 'fb-123',
                state: 'GUESSING',
                authorId: 'user-A',
                drawings: [{ order: 2 }],
                guesses: [{ order: 1 }],
                prompt: 'here is a random prompt'
            }
            prismaMock.flipbook.findUnique.mockResolvedValue(mockFlipbook);
            await expect(submitGuess('fb-123', 'user-A', 'invalid guess on own flipbook')).rejects.toThrow('CANNOT_GUESS_OWN_FLIPBOOK');
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

        it('should assign a flipbook that is NOT the user’s own and hasn’t been drawn on yet', async () => {
            const mockRound = {
                id: mockRoundId,
                flipbooks: [
                    { id: 'fb-own', authorId: mockUserId, drawings: [] }, // user's flipbook
                    { id: 'fb-done', authorId: 'user-2', drawings: [{ authorId: mockUserId }] },
                    { id: 'fb-target', authorId: 'user-3', drawings: [] }
                ]
            };

            prismaMock.round.findUnique.mockResolvedValue(mockRound);

            const result = await getAssignedFlipbook(mockRoundId, mockUserId, 'DRAWING');

            expect(result?.id).toBe('fb-target');
        });

        it('should return null if all flipbooks are completed for the user', async () => {
            prismaMock.round.findUnique.mockResolvedValue({
                id: mockRoundId,
                flipbooks: [
                    { id: 'fb-1', authorId: mockUserId, drawings: [] },
                    { id: 'fb-2', authorId: 'user-2', drawings: [{ authorId: mockUserId }] }
                ]
            });

            const result = await getAssignedFlipbook(mockRoundId, mockUserId, 'DRAWING');
            expect(result).toBeNull();
        });

        it('should assign the user their OWN flipbook if the prompt is empty (initial prompt step)', async () => {
            const mockRound = {
                id: 'r1',
                flipbooks: [
                    { id: 'fb-own', authorId: 'user-1', prompt: '', guesses: [] }
                ]
            };

            prismaMock.round.findUnique.mockResolvedValue(mockRound);

            const result = await getAssignedFlipbook('r1', 'user-1', 'GUESSING');

            expect(result?.id).toBe('fb-own');
        });

        it('should NOT assign own flipbook if a prompt already exists', async () => {
            const mockRound = {
                id: 'r1',
                flipbooks: [
                    { id: 'fb-own', authorId: 'user-1', prompt: 'A cool cat', guesses: [] },
                    { id: 'fb-other', authorId: 'user-2', prompt: 'Dancing robot', guesses: [] }
                ]
            };

            prismaMock.round.findUnique.mockResolvedValue(mockRound);

            const result = await getAssignedFlipbook('r1', 'user-1', 'GUESSING');

            expect(result?.id).toBe('fb-other');
        });

        it('should throw ROUND_NOT_FOUND if the database returns null', async () => {
            prismaMock.round.findUnique.mockResolvedValue(null);

            await expect(getAssignedFlipbook('fake', 'user', 'DRAWING'))
                .rejects.toThrow('ROUND_NOT_FOUND');
        });

        it('should return null if an invalid phase is provided', async () => {
            const mockRound = {
                id: 'r1',
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
            const mockRound = {
                id: mockRoundId,
                lobby: {
                    players: [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }] 
                },
                flipbooks: [
                    { id: 'fb-1', drawings: [{}, {}], guesses: [] },
                    { id: 'fb-2', drawings: [{}, {}], guesses: [] },
                    { id: 'fb-3', drawings: [{}, {}], guesses: [] }
                ]
            };

            prismaMock.round.findUnique.mockResolvedValue(mockRound);

            const result = await checkPhaseCompletion(mockRoundId, 'DRAWING');
            
            expect(result).toBe(true);
        });

        it('should return false if at least one flipbook is missing a submission', async () => {
            const mockRound = {
                id: mockRoundId,
                lobby: {
                    players: [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }]
                },
                flipbooks: [
                    { id: 'fb-1', drawings: [{}, {}], guesses: [] },
                    { id: 'fb-2', drawings: [{}], guesses: [] }, 
                    { id: 'fb-3', drawings: [{}, {}], guesses: [] }
                ]
            };

            prismaMock.round.findUnique.mockResolvedValue(mockRound);

            const result = await checkPhaseCompletion(mockRoundId, 'DRAWING');
            
            expect(result).toBe(false);
        });

        it('should return true when all players have submitted for the GUESSING phase', async () => {
            const mockRound = {
                id: mockRoundId,
                lobby: {
                    players: [{ id: 'u1' }, { id: 'u2' }] 
                },
                flipbooks: [
                    { id: 'fb-1', drawings: [], guesses: [{}] },
                    { id: 'fb-2', drawings: [], guesses: [{}] }
                ]
            };

            prismaMock.round.findUnique.mockResolvedValue(mockRound);

            const result = await checkPhaseCompletion(mockRoundId, 'GUESSING');
            
            expect(result).toBe(true);
        });

        it('should throw ROUND_NOT_FOUND error if round does not exist', async () => {
            prismaMock.round.findUnique.mockResolvedValue(null);

            await expect(checkPhaseCompletion('fake-round', 'DRAWING')).rejects.toThrow('ROUND_NOT_FOUND');
        });
    });
});