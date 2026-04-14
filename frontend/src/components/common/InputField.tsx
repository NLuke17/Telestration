interface InputFieldProps {
    id: string;
    label?: string;
    type?: 'text' | 'password';
    placeholder: string;
    value: string;
    className?: string;
    disabled?: boolean;
    required?: boolean;
    /** Tighter label + input for toolbars and footers */
    compact?: boolean;
    onChange: (val: string) => void;
}

export default function InputField({
    id,
    label = '',
    type = 'text',
    placeholder,
    value,
    className = '',
    disabled = false,
    required = false,
    compact = false,
    onChange,
}: InputFieldProps) {
    return (
        <div className={`flex flex-col ${compact ? 'gap-0.5' : 'gap-2'} ${className}`}>
            {label ? (
                <label
                    htmlFor={id}
                    className={compact ? 'text-xs font-semibold text-gray-700' : 'text-sm font-semibold'}
                >
                    {label}
                </label>
            ) : (
                <div />
            )}
            <input
                id={id}
                type={type}
                placeholder={placeholder}
                value={value}
                disabled={disabled}
                required={required}
                onChange={(e) => onChange(e.target.value)}
                className={`border-2 border-light-grey rounded-md outline-none focus:border-charcoal transition-colors ${
                    compact ? 'px-2 py-1.5 text-sm' : 'px-3 py-2 text-body-base gap-2'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
        </div>
    );
}
