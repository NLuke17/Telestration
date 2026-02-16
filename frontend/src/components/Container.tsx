interface ContainerProps {
    width: string;
    height: string;
    children: React.ReactNode;
    className?: string;
    padding?: string;
}

export default function Container({width, height, padding='4', children, className=''}: ContainerProps) {
    return (
        <div style={{ width: `${width}px`, height: `${height}px`, padding: `${padding}em` }}
        className={`flex items-center justify-center ${className}`}>
            {children}
        </div>
    );
}