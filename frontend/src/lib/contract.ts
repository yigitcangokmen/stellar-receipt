import { Client, type Invoice } from "../contract/receipt";
import { NETWORK, READ_SOURCE, DECIMALS } from "./config";
import { signTransaction } from "./wallet";

export type { Invoice };

function readClient(): Client {
  return new Client({
    contractId: NETWORK.contractId,
    networkPassphrase: NETWORK.passphrase,
    rpcUrl: NETWORK.rpcUrl,
    publicKey: READ_SOURCE,
  });
}

function writeClient(publicKey: string): Client {
  return new Client({
    contractId: NETWORK.contractId,
    networkPassphrase: NETWORK.passphrase,
    rpcUrl: NETWORK.rpcUrl,
    publicKey,
    signTransaction: (xdr) => signTransaction(xdr, { address: publicKey }),
  });
}

const SCALE = 10 ** DECIMALS;

/** Kullanıcının girdiği ondalıklı miktarı (ör. "1.5") stroop'a çevirir. */
export function toStroops(amount: string): bigint {
  return BigInt(Math.round(Number(amount) * SCALE));
}

/** stroop miktarını okunabilir ondalıklı string'e çevirir. */
export function fromStroops(amount: bigint): string {
  const neg = amount < 0n;
  const v = neg ? -amount : amount;
  const whole = v / BigInt(SCALE);
  const frac = (v % BigInt(SCALE)).toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

// ---- Yazma işlemleri (cüzdan gerektirir) ----

export async function createInvoice(
  publicKey: string,
  token: string,
  amount: bigint,
  memo: string,
): Promise<bigint> {
  const tx = await writeClient(publicKey).create_invoice({
    merchant: publicKey,
    token,
    amount,
    memo,
  });
  const sent = await tx.signAndSend();
  return sent.result.unwrap();
}

export async function payInvoice(
  publicKey: string,
  invoiceId: bigint,
): Promise<{ ledger?: number; hash?: string }> {
  const tx = await writeClient(publicKey).pay_invoice({
    invoice_id: invoiceId,
    payer: publicKey,
  });
  const sent = await tx.signAndSend();
  sent.result.unwrap();
  const got = sent.getTransactionResponse as { ledger?: number; txHash?: string } | undefined;
  const send = sent.sendTransactionResponse as { hash?: string } | undefined;
  return { ledger: got?.ledger, hash: send?.hash ?? got?.txHash };
}

export async function cancelInvoice(publicKey: string, invoiceId: bigint): Promise<void> {
  const tx = await writeClient(publicKey).cancel_invoice({ invoice_id: invoiceId });
  const sent = await tx.signAndSend();
  sent.result.unwrap();
}

// ---- Okuma işlemleri (cüzdan gerekmez) ----

export async function getInvoice(invoiceId: bigint): Promise<Invoice> {
  const tx = await readClient().get_invoice({ invoice_id: invoiceId });
  return tx.result.unwrap();
}

export async function listByMerchant(merchant: string): Promise<bigint[]> {
  const tx = await readClient().list_by_merchant({ merchant });
  return tx.result;
}
