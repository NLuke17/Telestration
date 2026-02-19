interface InputFieldProps {
    label: string;
    type?: 'text' | 'password';
    placeholder: string;
    value: string;
    onChange: (val: string) => void;
}

export default function InputField({ label, type='text', placeholder, value, onChange}: InputFieldProps) {
    return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-2 border-light-grey rounded-md px-3 py-2 outline-none focus:border-charcoal transition-colors text-body-base gap-2"
      />
    </div>
  );
}
