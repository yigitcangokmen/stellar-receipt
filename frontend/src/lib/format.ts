import { Status, type Invoice } from "../contract/receipt";
import { fromStroops } from "./contract";
import { TOKENS } from "./config";

export const SHORT = (a?: string) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : "");

export const payLink = (id: bigint | number | string) =>
  `${window.location.origin}/pay/${id}`;

export function fmtTime(t: bigint): string {
  if (!t) return "—";
  return new Date(Number(t) * 1000).toLocaleString("tr-TR");
}

/** stroop → binlik ayraçlı okunabilir string (ör. 12500000000n → "1,250"). */
export function formatAmount(stroops: bigint): string {
  const s = fromStroops(stroops);
  const [whole, frac] = s.split(".");
  const w = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${w}.${frac}` : w;
}

export function tokenSymbol(sac: string): "XLM" | "USDC" {
  for (const [sym, t] of Object.entries(TOKENS)) {
    if (t.sac === sac) return sym as "XLM" | "USDC";
  }
  return "XLM";
}

export type UIStatus = "PENDING" | "PAID" | "CANCELLED";

const STATUS_MAP: Record<number, UIStatus> = {
  [Status.Pending]: "PENDING",
  [Status.Paid]: "PAID",
  [Status.Cancelled]: "CANCELLED",
};

/** Tasarım bileşenlerinin beklediği görünüm modeli (AppPage + PayPage ortak). */
export interface UIInvoice {
  number: number;
  memo: string;
  amount: string;
  token: "USDC" | "XLM";
  status: UIStatus;
  merchant: string;
  merchantAddr: string;
  payer: string;
  payerAddr?: string;
  createdAt: string;
  paidAt?: string;
  ledger?: string;
}

export function toUIInvoice(inv: Invoice): UIInvoice {
  return {
    number: Number(inv.id),
    memo: inv.memo,
    amount: formatAmount(inv.amount),
    token: tokenSymbol(inv.token),
    status: STATUS_MAP[inv.status],
    merchant: SHORT(inv.merchant),
    merchantAddr: inv.merchant,
    payer: inv.payer ? SHORT(inv.payer) : "—",
    payerAddr: inv.payer ?? undefined,
    createdAt: fmtTime(inv.created_at),
    paidAt: inv.paid_at ? fmtTime(inv.paid_at) : undefined,
    ledger: undefined,
  };
}
