interface ToolSizeIndicatorProps {
    toolSize: number;
    className?: string;
    color?: string;
    variant?: 'default' | 'active';
    onClick?: () => void;
}

export default function ToolSizeIndicator({ 
    toolSize, 
    className = '', 
    color = 'white',
    variant = 'default',
    onClick
}: ToolSizeIndicatorProps) {
    const baseStyles = "w-[40px] h-[40px] flex items-center justify-center rounded-full border border-white"
    const variantStyles = {
        default: "bg-light-grey",
        active: "bg-dark-grey",
    };
    return (
        <div 
            onClick = {onClick}
            className={`${baseStyles} ${variantStyles[variant]} ${className}`}
        >
            <div 
                style={{ 
                    width: `${toolSize}px`, 
                    height: `${toolSize}px`, 
                    backgroundColor: color 
                }} 
                className="rounded-full"
            ></div>
        </div>
    );
}