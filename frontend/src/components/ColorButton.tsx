interface ColorButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    color: string;
    size: string;
    onClick: () => void;
}

export default function ColorButton ({ color, onClick, size }: ColorButtonProps) {

    return (
        <button onClick={onClick}>
            <div style={{ width: `${size}px`, height: `${size}px`, backgroundColor: `${color}` }} className="border-dark-grey border-1"></div>
        </button>
    );
}