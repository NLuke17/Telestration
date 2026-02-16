import { ReactSketchCanvas } from 'react-sketch-canvas';
import Container from '../components/Container';

const styles = {
  border: '0.0625rem solid #9c9c9c',
  borderRadius: '0.25rem',
};

const Canvas = () => {
  return (
    <ReactSketchCanvas
      style={styles}
      width="600px"
      height="360px"
      strokeWidth={4}
      strokeColor="blue"
    />
  );
};

const DrawingPage: React.FC = () => {
    return (
        <div className="flex flex-col justify-center items-center h-screen">
            <Container width='900' height='500' padding='5' className='gap-8 flex-col border-2 border-dark-grey rounded-lg'>
                <Canvas />
            </Container>
        </div>
    );
};

export default DrawingPage;