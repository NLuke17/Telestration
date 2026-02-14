interface ContainerProps {
    ratio?: string;
    children: React.ReactNode;
    className?: string;
}

export default function Container({ratio='3/4', children, className=''}: ContainerProps) {
    return (
        <div className={`w-full aspect-[${ratio}] flex items-center justify-center ${className}`}>
            {children}
        </div>
    );
}