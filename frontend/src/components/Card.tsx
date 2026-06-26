import { HTMLAttributes, ReactNode } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}

export function Card({ children, padded = true, className = '', ...rest }: Props) {
  return (
    <div
      {...rest}
      className={`bg-bg-card border border-border-subtle rounded-cardLg ${padded ? 'p-8' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
