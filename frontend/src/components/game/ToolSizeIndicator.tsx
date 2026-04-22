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
    const baseStyles =
        'flex h-[40px] w-[40px] items-center justify-center rounded-full border border-white dark:border-zinc-500'
    const variantStyles = {
        default: 'bg-light-grey dark:bg-zinc-800',
        active: 'bg-dark-grey dark:bg-zinc-500',
    };
    return (
        <button 
            type="button"
            onClick = {onClick}
            aria-label={`Select tool size ${toolSize}`}
            aria-pressed={variant === 'active'}
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
        </button>
    );
}