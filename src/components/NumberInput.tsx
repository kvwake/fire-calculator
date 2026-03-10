import { useState, useEffect, InputHTMLAttributes } from 'react';

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: number;
  onChange: (value: number) => void;
  decimals?: boolean;
}

export default function NumberInput({ value, onChange, decimals = true, className, ...props }: NumberInputProps) {
  const [display, setDisplay] = useState(String(value));

  useEffect(() => {
    const parsed = parseFloat(display);
    if (isNaN(parsed) || parsed !== value) {
      setDisplay(String(value));
    }
  }, [value]);

  const baseClass = 'mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400';
  const inputClass = className ? `${baseClass} ${className}` : baseClass;

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '' || raw === '-') {
          setDisplay(raw);
          return;
        }
        const pattern = decimals ? /^-?\d*\.?\d*$/ : /^-?\d*$/;
        if (pattern.test(raw)) {
          setDisplay(raw);
          const num = parseFloat(raw);
          if (!isNaN(num)) onChange(num);
        }
      }}
      onBlur={() => {
        const num = parseFloat(display);
        if (isNaN(num) || display === '' || display === '-') {
          setDisplay('0');
          onChange(0);
        } else {
          setDisplay(String(num));
        }
      }}
      className={inputClass}
      {...props}
    />
  );
}
