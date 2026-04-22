interface ButtonProps {
    label: string;
    disabled?: boolean;
    variant?: 'primary' | 'image';
    onClick?: () => void;
    type?: 'button' | 'submit';
    className?: string;
}

export default function Button({label, variant='primary', disabled=false, onClick, type='button', className=''}: ButtonProps) {
    const baseStyles = "border-1 w-fit flex inline-flex justify-center px-6 py-2 gap-2 rounded-md font-semibold cursor-pointer";
    const variants = {
        primary: "text-white transition ease-in-out duration-150",
        image: "",
    }

    return (
        <button
            type={type}
            onClick={onClick}
            className={`${baseStyles} ${disabled ? 'bg-gray-400' : 'dark:bg-dark-mode-button-background dark:border-dark-mode-border-2 bg-brand-charcoal hover:opacity-80'} ${variants[variant]} ${className}`}
        >
            {label}
        </button>
    );
}
