import { ReactSketchCanvas } from 'react-sketch-canvas';
import type { ReactSketchCanvasRef } from 'react-sketch-canvas';
import { useRef } from 'react';
import Container from '../components/Container';
import ToolButton from '../components/ToolButton';
import pencilIcon from '../assets/pencil.svg';
import eraserIcon from '../assets/eraser.svg';

const styles = {
  border: '0.0625rem solid #9c9c9c',
  borderRadius: '0.25rem',
};

const Canvas = ({ canvasRef }: { canvasRef: React.RefObject<ReactSketchCanvasRef> }) => {
  return (
    <ReactSketchCanvas
      style={styles}
      width="600px"
      height="360px"
      strokeWidth={4}
      strokeColor="blue"
      ref={canvasRef} 
    />
  );
};

const DrawingPage: React.FC = () => {
    const canvasRef = useRef<ReactSketchCanvasRef>(null);

    return (
        <div className="flex flex-col justify-center items-center h-screen">
            <Container width='900' height='500' padding='5' className='gap-8 border-2 border-dark-grey rounded-lg'>
                <Canvas canvasRef={canvasRef}/>
                <ToolButton icon={<img src={pencilIcon} alt="pencil" />} onClick={() => {
                    canvasRef.current?.eraseMode(false)
                    console.log("Pencil clicked!")
                    }}/>
                <ToolButton icon={<img src={eraserIcon} alt="eraser" />} onClick={() => {
                    canvasRef.current?.eraseMode(true)
                    console.log("Eraser clicked!")
                    }} />
            </Container>
        </div>
    );
};

export default DrawingPage;