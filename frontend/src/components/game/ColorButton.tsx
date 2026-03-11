interface ColorButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    color: string;
    size: string;
    onClick: React.MouseEventHandler<HTMLButtonElement>;
}

export default function ColorButton ({ color, onClick, size, ...buttonProps }: ColorButtonProps) {

    return (
        <button onClick={onClick} type="button" {...buttonProps} >
            <div style={{ width: `${size}px`, height: `${size}px`, backgroundColor: `${color}` }} className="border-dark-grey border-1"></div>
        </button>
    );
}