interface ToolButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React.ReactNode;
    onClick: () => void;
}

export default function ToolButton ({icon, onClick }: ToolButtonProps) {

    return (
        <button onClick={onClick} className="w-[40px] aspect-square">
            {icon}
        </button>
    );
}