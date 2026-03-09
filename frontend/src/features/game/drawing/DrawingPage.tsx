import { ReactSketchCanvas } from 'react-sketch-canvas';
import type { ReactSketchCanvasRef } from 'react-sketch-canvas';
import { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Container from '../../../components/common/Container';
import ToolButton from '../../../components/game/ToolButton';
import ColorButton from '../../../components/game/ColorButton';
import { SlActionUndo, SlActionRedo, SlPencil } from "react-icons/sl";
import { BsEraser } from "react-icons/bs";
import PageCounter from '../../../components/game/PageCounter';
import TimerDisplay from '../../../components/game/TimerDisplay';
import ToolSizeIndicator from '../../../components/game/ToolSizeIndicator';
import Button from '../../../components/common/Button';
import { useGameState, usePhaseTimer } from '../../../hooks/useGameState';
import { getAssignedFlipbook } from '../../../services/api/gameApi';

const styles = {
  border: '0.0625rem solid #9c9c9c',
  borderRadius: '0.25rem',
};

const DrawingPage: React.FC = () => {
    const { roomCode } = useParams<{ roomCode: string}>();
    const navigate = useNavigate();
    const canvasRef = useRef<ReactSketchCanvasRef>(null);
    
    // Get userId from localStorage
    const userId = localStorage.getItem('userId') || '';
    
    // Canvas state
    const [penColor, setPenColor] = useState("#000000");
    const [selectedSize, setSelectedSize] = useState(5);
    const [selectedTool, setSelectedTool] = useState('pen');
    const sizes = [5, 10, 15, 20, 25, 30];
    
    // Game state
    const gameState = useGameState(); // Will connect via WebSocket
    const timer = usePhaseTimer(gameState.phaseEndsAt);
    
    // Assignment state
    const [assignment, setAssignment] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch assignment when component mounts
    useEffect(() => {
        const fetchAssignment = async () => {
            if (!gameState.roundId || !userId) return;
            
            try {
                setIsLoading(true);
                const result = await getAssignedFlipbook(gameState.roundId, userId, 'DRAWING');
                
                if (result.assigned && result.flipbook) {
                    setAssignment(result.flipbook);
                } else {
                    setError(result.message || 'No assignment available');
                }
            } catch (err: any) {
                console.error('Failed to fetch assignment:', err);
                setError(err.message || 'Failed to load assignment');
            } finally {
                setIsLoading(false);
            }
        };

        if (gameState.roundId && gameState.phase === 'DRAWING') {
            fetchAssignment();
        }
    }, [gameState.roundId, gameState.phase, userId]);

    // Handle phase complete - navigate to waiting or next phase
    useEffect(() => {
        if (gameState.isPhaseComplete) {
            // Phase is complete, show waiting screen or navigate
            console.log('Drawing phase complete');
        }
    }, [gameState.isPhaseComplete]);

    const handleSubmit = async () => {
        if (!canvasRef.current || !assignment || !userId) {
            console.error('Missing required data for submission');
            return;
        }

        try {
            setIsSubmitting(true);
            
            // Export canvas paths as JSON
            const paths = await canvasRef.current.exportPaths();
            const drawingData = JSON.stringify(paths);
            
            // Submit via WebSocket
            gameState.submitDrawing(assignment.id, drawingData);
            
            console.log('Drawing submitted successfully');
            
            // Navigate to waiting page or show success message
            navigate(`/game/${roomCode}/waiting`);
        } catch (err: any) {
            console.error('Failed to submit drawing:', err);
            setError(err.message || 'Failed to submit drawing');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="flex flex-col justify-center items-center h-screen">
                <p className="text-heading-3">Loading assignment...</p>
            </div>
        );
    }

    // Error state
    if (error || !assignment) {
        return (
            <div className="flex flex-col justify-center items-center h-screen">
                <p className="text-heading-3 text-red-600">Error: {error || 'No assignment'}</p>
                <Button 
                    label="Back to Lobby" 
                    onClick={() => navigate(`/lobby/${roomCode}`)}
                    className="mt-4"
                />
            </div>
        );
    }

    // Get the prompt to display
    const promptToDisplay = assignment.prompt || 'Draw something!';
    const currentPage = gameState.roundNumber || 1;
    const totalPages = 4; // This should come from game config

    return (
        <div className="flex flex-col justify-center items-center gap-8 h-screen">
            <Container width='900px' height='500px' padding='5em' className='flex items-center justify-center gap-8 border-2 border-dark-grey rounded-lg flex-col'>
                <div className='flex w-full justify-between'>
                    <PageCounter pageNum={currentPage.toString()} totalPages={totalPages.toString()} className='text-heading-3'/>
                    {/* Heading */}
                    <div className='flex flex-col text-center'>
                        <div className='text-heading-3'>Hey, it's time to draw!</div>
                        <div className='text-display-prompt'>{promptToDisplay}</div>
                    </div> 
                    <TimerDisplay 
                        minutesLeft={timer.minutes.toString().padStart(2, '0')} 
                        secondsLeft={timer.seconds.toString().padStart(2, '0')} 
                        className='text-heading-3'
                    />
                </div>
                {/* Color buttons */}
                <div className='flex flex-row gap-6 justify-center items-center'>
                    <div className="flex flex-col gap-4">
                        <ColorButton color='black' size='30' aria-label="select black color" onClick={() => {
                            setPenColor('#000000')
                            canvasRef.current?.eraseMode(false)
                            setSelectedTool('pen')
                        }}/>
                        <ColorButton color='#0088FF' size='30' aria-label="select blue color" onClick={() => {
                            setPenColor('#0088FF')
                            canvasRef.current?.eraseMode(false)
                            setSelectedTool('pen')
                        }}/>
                        <ColorButton color='#FF383C' size='30' aria-label="select red color" onClick={() => {
                            setPenColor('#FF383C')
                            canvasRef.current?.eraseMode(false)
                            setSelectedTool('pen')
                        }}/>
                        <ColorButton color='#FFCC00' size='30' aria-label="select yellow color" onClick={() => {
                            setPenColor('#FFCC00')
                            canvasRef.current?.eraseMode(false)
                            setSelectedTool('pen')
                        }}/>
                        <ColorButton color='#ffffff' size='30' aria-label="select white color" onClick={() => {
                            setPenColor('#ffffff')
                            canvasRef.current?.eraseMode(false)
                            setSelectedTool('pen')
                        }}/>
                    </div>
                    {/* Canvas */}
                    <ReactSketchCanvas
                        style={styles}
                        width="600px"
                        height="360px"
                        strokeWidth={selectedSize}
                        eraserWidth={selectedSize}
                        strokeColor={penColor}
                        ref={canvasRef}
                    />
                    {/* Tools */}
                    <div className="flex flex-col">
                        <ToolButton key='undo' icon={<SlActionUndo size={30} />} aria-label="Undo" onClick={() => {
                            canvasRef.current?.undo()
                            }}/>
                        <ToolButton key='redo' icon={<SlActionRedo size={30} />} aria-label="Redo" onClick={() => {
                            canvasRef.current?.redo()
                            }}/>
                        <ToolButton key='pen' icon={<SlPencil size={30} />} isActive={selectedTool === 'pen'} aria-label="Pen tool" onClick={() => {
                            canvasRef.current?.eraseMode(false)
                            setSelectedTool('pen')
                            }}/>
                        <ToolButton key='eraser' icon={<BsEraser size={30} />} isActive={selectedTool === 'eraser'} aria-label="Eraser tool" onClick={() => {
                            canvasRef.current?.eraseMode(true)
                            setSelectedTool('eraser')
                            }} />
                    </div>
                </div>
            </Container>
            {/* Tool size indicators */}
            <div 
                style={{
                    width: "100%",
                    maxWidth: "900px",
                }}
                className='flex flex-row justify-between items-center'
            >
                <div className="flex flex-row gap-2 bg-mid-grey rounded-lg px-[20px] py-[15px] border border-dark-grey">
                    {sizes.map((size) => (
                        <ToolSizeIndicator 
                            key={size}
                            toolSize={size} 
                            variant={selectedSize === size ? 'active' : 'default'}
                            onClick={() => {
                                setSelectedSize(size);
                            }}
                        />
                    ))}
                </div>
                <Button 
                    label={isSubmitting ? 'Submitting...' : 'Done'}
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                />
            </div>
        </div>
    );
};

export default DrawingPage;
