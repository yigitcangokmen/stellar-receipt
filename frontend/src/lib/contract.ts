import { rpc, nativeToScVal } from "@stellar/stellar-sdk";
import { Client, type Invoice } from "../contract/receipt";
import { NETWORK, READ_SOURCE, DECIMALS } from "./config";
import { signTransaction } from "./wallet";

export type { Invoice };

/**
 * Bir faturanın ödeme tx hash'ini contract'ın 'paid' event'inden çeker.
 * Event'ler RPC'de yalnızca retention penceresi kadar (~7 gün) tutulur;
 * daha eski ödemelerde undefined döner (makbuz yine de get_invoice ile
 * kalıcı olarak doğrulanabilir).
 */
export async function getPaymentTxHash(invoiceId: bigint): Promise<string | undefined> {
  try {
    const server = new rpc.Server(await pickRpc());
    const latest = await server.getLatestLedger();
    const topic = [
      nativeToScVal("paid", { type: "symbol" }).toXDR("base64"),
      nativeToScVal(invoiceId, { type: "u64" }).toXDR("base64"),
    ];
    const filters = [
      { type: "contract" as const, contractIds: [NETWORK.contractId], topics: [topic] },
    ];

    // 1) Hızlı yol: son ~14 saat (RPC tek çağrıda ~10k ledger tarar) — çoğu doğrulama burada.
    try {
      const r = await server.getEvents({
        startLedger: Math.max(1, latest.sequence - 10000),
        filters,
        limit: 1,
      });
      if (r.events?.length) return r.events[0].txHash;
    } catch {
      /* aralık dışıysa geniş yola geç */
    }

    // 2) Geniş yol: ~7 günlük pencereyi cursor ile sayfalayarak tara (eski ödemeler).
    let cursor: string | undefined;
    const startLedger = Math.max(1, latest.sequence - 120000);
    for (let i = 0; i < 16; i++) {
      let r;
      try {
        r = cursor
          ? await server.getEvents({ cursor, filters, limit: 1 })
          : await server.getEvents({ startLedger, filters, limit: 1 });
      } catch {
        break;
      }
      if (r.events?.length) return r.events[0].txHash;
      if (!r.cursor) break;
      cursor = r.cursor;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Sağlıklı RPC seçer: resmi endpoint geri kaldığında (getHealth hata/unhealthy)
 * listedeki bir sonrakine düşer. Seçim 20sn cache'lenir ki her çağrıda yoklanmasın.
 */
let rpcCache: { url: string; at: number } | null = null;

async function pickRpc(): Promise<string> {
  if (rpcCache && Date.now() - rpcCache.at < 20000) return rpcCache.url;
  for (const url of NETWORK.rpcUrls) {
    try {
      const h = await new rpc.Server(url).getHealth();
      if (h.status === "healthy") {
        rpcCache = { url, at: Date.now() };
        return url;
      }
    } catch {
      /* bu endpoint sağlıksız/erişilemez — sıradakini dene */
    }
  }
  rpcCache = null;
  return NETWORK.rpcUrls[0]; // hepsi sağlıksızsa yine de primary'yle dene
}

async function readClient(): Promise<Client> {
  return new Client({
    contractId: NETWORK.contractId,
    networkPassphrase: NETWORK.passphrase,
    rpcUrl: await pickRpc(),
    publicKey: READ_SOURCE,
  });
}

async function writeClient(publicKey: string): Promise<Client> {
  return new Client({
    contractId: NETWORK.contractId,
    networkPassphrase: NETWORK.passphrase,
    rpcUrl: await pickRpc(),
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
  const tx = await (await writeClient(publicKey)).create_invoice({
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
  const tx = await (await writeClient(publicKey)).pay_invoice({
    invoice_id: invoiceId,
    payer: publicKey,
  });
  const sent = await tx.signAndSend();
  sent.result.unwrap();
  const got = sent.getTransactionResponse as { ledger?: number; txHash?: string } | undefined;
  const send = sent.sendTransactionResponse as { hash?: string } | undefined;
  return { ledger: got?.ledger, hash: send?.hash ?? got?.txHash };
}

/**
 * Optimistic ödeme: imzalar + ağa gönderir, hash'i HEMEN döner (onayı beklemeden).
 * `confirm()` arkada onayı bekler — SUCCESS'te resolve, FAILED/timeout'ta reject (rollback için).
 */
export async function payInvoiceOptimistic(
  publicKey: string,
  invoiceId: bigint,
): Promise<{ hash: string; confirm: () => Promise<void> }> {
  const tx = await (await writeClient(publicKey)).pay_invoice({
    invoice_id: invoiceId,
    payer: publicKey,
  });
  await tx.sign(); // cüzdan imza penceresi; this.signed dolar (göndermez)
  const signed = tx.signed;
  if (!signed) throw new Error("İmzalama başarısız");
  const hash = signed.hash().toString("hex");

  const server = new rpc.Server(await pickRpc());
  const sent = await server.sendTransaction(signed);
  const sendStatus = String(sent.status);
  if (sendStatus === "ERROR" || sendStatus === "TRY_AGAIN_LATER") {
    throw new Error("Gönderim reddedildi (" + sendStatus + ")");
  }

  const confirm = async (): Promise<void> => {
    for (let i = 0; i < 20; i++) {
      const r = await server.getTransaction(hash);
      const st = String(r.status);
      if (st === "SUCCESS") return;
      if (st === "FAILED") throw new Error("İşlem zincirde başarısız oldu");
      await new Promise((res) => setTimeout(res, 1000));
    }
    throw new Error("Onay zaman aşımı");
  };

  return { hash, confirm };
}

export async function cancelInvoice(publicKey: string, invoiceId: bigint): Promise<void> {
  const tx = await (await writeClient(publicKey)).cancel_invoice({ invoice_id: invoiceId });
  const sent = await tx.signAndSend();
  sent.result.unwrap();
}

// ---- Okuma işlemleri (cüzdan gerekmez) ----

export async function getInvoice(invoiceId: bigint): Promise<Invoice> {
  const tx = await (await readClient()).get_invoice({ invoice_id: invoiceId });
  return tx.result.unwrap();
}

export async function listByMerchant(merchant: string): Promise<bigint[]> {
  const tx = await (await readClient()).list_by_merchant({ merchant });
  return tx.result;
}
