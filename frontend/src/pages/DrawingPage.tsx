import { ReactSketchCanvas } from 'react-sketch-canvas';
import type { ReactSketchCanvasRef } from 'react-sketch-canvas';
import { useRef, useState } from 'react';
import Container from '../components/Container';
import ToolButton from '../components/ToolButton';
import ColorButton from '../components/ColorButton';
import { SlActionUndo, SlActionRedo, SlPencil } from "react-icons/sl";
import { BsEraser } from "react-icons/bs";

const styles = {
  border: '0.0625rem solid #9c9c9c',
  borderRadius: '0.25rem',
};

const DrawingPage: React.FC = () => {
    const canvasRef = useRef<ReactSketchCanvasRef>(null);
    const [penColor, setPenColor] = useState("#000000");

    return (
        <div className="flex flex-col justify-center items-center h-screen">
            <Container width='900' height='500' padding='5' className='gap-8 border-2 border-dark-grey rounded-lg'>
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
                <ReactSketchCanvas
                    style={styles}
                    width="600px"
                    height="360px"
                    strokeWidth={4}
                    strokeColor={penColor}
                    ref={canvasRef}
                />
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
            </Container>
        </div>
    );
};

export default DrawingPage;