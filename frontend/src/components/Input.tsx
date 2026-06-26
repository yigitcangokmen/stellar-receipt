import { InputHTMLAttributes, ReactNode } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  rightSlot?: ReactNode;
  mono?: boolean;
  inputClassName?: string;
}

export function Input({
  label,
  hint,
  rightSlot,
  mono = false,
  className = '',
  inputClassName = '',
  ...rest
}: Props) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted mb-2">
          {label}
        </div>
      )}
      <div className="flex items-center gap-2 bg-bg-base border border-border-default rounded-btn px-4 py-3">
        <input
          {...rest}
          className={`flex-1 min-w-0 bg-transparent border-none outline-none text-text-primary text-sm ${
            mono ? 'font-mono text-brand-yellow' : ''
          } ${inputClassName}`}
        />
        {rightSlot}
      </div>
      {hint && (
        <div className="font-mono text-[10px] text-text-faint mt-1.5 tracking-wide">
          {hint}
        </div>
      )}
    </label>
  );
}
