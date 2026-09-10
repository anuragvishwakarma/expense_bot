import { ChangeEvent, useState } from 'react';

export const Input = ({
  className = '',
  type = 'text',
  value = '',
  onChange,
  placeholder,
  required = false,
  minLength,
  ...rest
}: {
  className?: string;
  type?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
} & React.InputHTMLAttributes<HTMLInputElement>) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="relative">
      <input
        type={type}
        className={`${className} flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
        value={value}
        onChange={(e) => {
          onChange(e);
        }}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...rest}
      />
      {isFocused && (
        <div className="absolute left-0 bottom-0 h-0.5 w-full bg-primary transition-all"></div>
      )}
    </div>
  );
};