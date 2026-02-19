interface ContainerProps {
    height: string;
    width: string;
    children: React.ReactNode;
    className?: string;
    margin?: string;
}

export default function Container({width, height, margin='8', children, className=''}: ContainerProps) {
    return (
        <div style={{ width: `${width}px`, height: `${height}px`, margin: `${margin}em` }}
        className={`flex items-center justify-center ${className}`}>
            {children}
        </div>
    );
}
