import { Badge } from './Badge';

export type InvoiceStatus = 'PENDING' | 'PAID' | 'CANCELLED';

interface Props {
  status: InvoiceStatus;
}

const LABELS: Record<InvoiceStatus, string> = {
  PENDING: '⌁ Pending',
  PAID: '✓ Paid',
  CANCELLED: '✕ Cancelled',
};

const TONES = {
  PENDING: 'yellow',
  PAID: 'green',
  CANCELLED: 'red',
} as const;

export function StatusBadge({ status }: Props) {
  return <Badge tone={TONES[status]}>{LABELS[status]}</Badge>;
}
