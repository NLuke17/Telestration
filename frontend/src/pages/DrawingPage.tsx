import { ReactSketchCanvas } from 'react-sketch-canvas';
import type { ReactSketchCanvasRef } from 'react-sketch-canvas';
import { useRef, useState } from 'react';
import Container from '../components/Container';
import ToolButton from '../components/ToolButton';
import ColorButton from '../components/ColorButton';
import { SlActionUndo, SlActionRedo, SlPencil } from "react-icons/sl";
import { BsEraser } from "react-icons/bs";
import PageCounter from '../components/PageCounter';
import TimerDisplay from '../components/TimerDisplay';
import ToolSizeIndicator from '../components/ToolSizeIndicator';
import Button from '../components/Button';

const styles = {
  border: '0.0625rem solid #9c9c9c',
  borderRadius: '0.25rem',
};

const DrawingPage: React.FC = () => {
    const canvasRef = useRef<ReactSketchCanvasRef>(null);
    const [penColor, setPenColor] = useState("#000000");
    const [selectedSize, setSelectedSize] = useState(5);
    const sizes = [5, 10, 15, 20, 25, 30];

    return (
        <div className="flex flex-col justify-center items-center gap-8 h-screen">
            <Container width='900px' height='500px' padding='5em' className='gap-8 border-2 border-dark-grey rounded-lg flex-col'>
                <div className='flex w-full justify-between'>
                    <PageCounter pageNum='2' totalPages='4' className='text-heading-3'/>
                    {/* Heading */}
                    <div className='flex flex-col text-center'>
                        <div className='text-heading-3'>Hey, it's time to draw!</div>
                        <div className='text-display-prompt'>Previous Person's Sentence</div>
                    </div> 
                    <TimerDisplay minutesLeft='00' secondsLeft='30' className='text-heading-3'/>
                </div>
                {/* Color buttons */}
                <div className='flex flex-row gap-6 justify-center items-center'>
                    <div className="flex flex-col gap-4">
                        <ColorButton color='black' size='30' onClick={() => {
                            setPenColor('#000000')
                            canvasRef.current?.eraseMode(false)
                        }}/>
                        <ColorButton color='#0088FF' size='30' onClick={() => {
                            setPenColor('#0088FF')
                            canvasRef.current?.eraseMode(false)
                        }}/>
                        <ColorButton color='#FF383C' size='30' onClick={() => {
                            setPenColor('#FF383C')
                            canvasRef.current?.eraseMode(false)
                        }}/>
                        <ColorButton color='#FFCC00' size='30' onClick={() => {
                            setPenColor('#FFCC00')
                            canvasRef.current?.eraseMode(false)
                        }}/>
                        <ColorButton color='#ffffff' size='30' onClick={() => {
                            setPenColor('#ffffff')
                            canvasRef.current?.eraseMode(false)
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
                        <ToolButton icon={<SlActionUndo size={30} />} onClick={() => {
                            canvasRef.current?.undo()
                            }}/>
                        <ToolButton icon={<SlActionRedo size={30} />} onClick={() => {
                            canvasRef.current?.redo()
                            }}/>
                        <ToolButton icon={<SlPencil size={30} />} onClick={() => {
                            canvasRef.current?.eraseMode(false)
                            }}/>
                        <ToolButton icon={<BsEraser size={30} />} onClick={() => {
                            canvasRef.current?.eraseMode(true)
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
                                console.log(`Tool size changed to: ${size}`);
                            }}
                        />
                    ))}
                </div>
                <Button label='Done'/>
            </div>
        </div>
    );
};

export default DrawingPage;