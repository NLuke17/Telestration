interface ButtonProps {
    label: string;
    variant?: 'primary' | 'secondary';
    onClick?: () => void;
    type?: 'button' | 'submit';
    className?: string;
}

export default function Button({label, variant='primary', onClick, type='button', className=''}: ButtonProps) {
    const baseStyles = "w-fit flex inline-flex justify-center px-6 py-2 gap-2 rounded-md font-semibold cursor-pointer";
    const variants = {
        primary: "bg-brand-charcoal text-white hover:opacity-80 transition ease-in-out duration-150",
        secondary: "",
    }

    return (
        <button
            type={type}
            onClick={onClick}
            className={`${baseStyles} ${variants[variant]} ${className}`}
        >
            {label}
        </button>
    );
}
