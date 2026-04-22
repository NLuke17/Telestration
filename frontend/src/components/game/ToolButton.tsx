interface ToolButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React.ReactNode;
    isActive?: boolean;
    onClick: React.MouseEventHandler<HTMLButtonElement>;
}

export default function ToolButton ({
    icon, 
    isActive=false, 
    className='',
    type='button',
    onClick,
    ...buttonProps
}: ToolButtonProps) {
    const baseStyles =
        'flex aspect-square w-[40px] items-center justify-center rounded-md transition-colors'
    const activeStyles =
        'scale-95 bg-dark-grey text-white shadow-inner dark:bg-zinc-500 dark:text-white'
    const defaultStyles =
        'bg-transparent text-slate-600 hover:bg-light-grey dark:text-dark-mode-text-1 dark:hover:bg-zinc-800/90'
    return (
        <button 
            type={type}
            aria-pressed={isActive}
            {...buttonProps}
            className={`${baseStyles} ${isActive ? activeStyles : defaultStyles}`}
            onClick={onClick} 
        >
            {icon}
        </button>
    );
}