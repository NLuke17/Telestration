interface ContainerProps {
    width: string;
    height: string;
    children: React.ReactNode;
    className?: string;
    padding?: string;
    filled?: boolean;
}

export default function Container({width, height, padding='5em', children, filled=true, className=''}: ContainerProps) {
    return (
        <div style={{ width: `${width}`, height: `${height}`, padding: `${padding}` }}
        className={`${className}
        ${filled ? 'bg-sky-100 dark:bg-gray-950' : ''}
        `}>
            {children}
        </div>
    );
}
