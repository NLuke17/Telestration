interface InputFieldProps {
    id: string;
    label?: string;
    type?: 'text' | 'password';
    placeholder: string;
    value: string;
    className?: string;
    disabled?: boolean;
    required?: boolean;
    onChange: (val: string) => void;
}

export default function InputField({ id, label='', type='text', placeholder, value, className='', disabled=false, required=false, onChange}: InputFieldProps) {
    return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label? 
        (<label htmlFor={id} className="text-sm font-semibold">{label}</label>)
        : (<div></div>) 
      }
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className={`border-2 border-light-grey rounded-md px-3 py-2 outline-none focus:border-charcoal transition-colors text-body-base gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
    </div>
  );
}
