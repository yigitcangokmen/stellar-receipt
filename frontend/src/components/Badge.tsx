import { ReactNode } from 'react';

type Tone = 'yellow' | 'green' | 'red' | 'cyan' | 'neutral';

interface Props {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

const tones: Record<Tone, string> = {
  yellow: 'bg-brand-yellow/15 text-brand-yellow',
  green: 'bg-brand-green/15 text-brand-green',
  red: 'bg-brand-red/15 text-brand-red',
  cyan: 'bg-brand-cyan/15 text-brand-cyan',
  neutral: 'bg-border-default/50 text-text-muted',
};

export function Badge({ tone = 'neutral', children, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.12em] uppercase px-2.5 py-1 rounded-full ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
