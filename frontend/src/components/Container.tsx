interface ContainerProps {
    ratio?: string;
    width: string;
    children: React.ReactNode;
    className?: string;
}

export default function Container({ratio='5/9', width='900', children, className=''}: ContainerProps) {
    return (
        <div className={`w-[${width}px] aspect-[${ratio}] flex items-center justify-center ${className}`}>
            {children}
        </div>
    );
}