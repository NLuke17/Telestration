import { GiClassicalKnowledge } from "react-icons/gi";

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
    const baseStyles = "w-[40px] aspect-square flex justify-center rounded-md"
    const activeStyles = "bg-dark-grey text-white shadow-inner scale-95"
    const defaultStyles = "bg-transparent text-slate-600 hover:bg-light-grey"
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