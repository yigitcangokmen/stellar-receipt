import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";
import { FREIGHTER_ID } from "@creit.tech/stellar-wallets-kit/modules/freighter";

const ADDR_KEY = "sr_addr";
const WALLET_KEY = "sr_wallet";

function lsGet(k: string): string {
  try {
    return localStorage.getItem(k) ?? "";
  } catch {
    return "";
  }
}

// Cüzdan modalını app paletine uyacak koyu temaya çek.
const DARK_THEME = {
  background: "#0A0E1A",
  "background-secondary": "#121826",
  "foreground-strong": "#FFFFFF",
  foreground: "#E4E7EB",
  "foreground-secondary": "#9CA3AF",
  primary: "#FACC15",
  "primary-foreground": "#0A0E1A",
  transparent: "transparent",
  lighter: "#1A1F2E",
  light: "#1E2433",
  "light-gray": "#2A3142",
  gray: "#6B7280",
  danger: "#EF4444",
  border: "#2A3142",
  shadow: "rgba(0,0,0,0.5)",
  "border-radius": "14px",
  "font-family": "'Space Grotesk', sans-serif",
};

// Daha önce seçilen cüzdanı hatırla ki imzalama doğru cüzdanla yapılsın.
StellarWalletsKit.init({
  network: Networks.TESTNET,
  selectedWalletId: lsGet(WALLET_KEY) || FREIGHTER_ID,
  modules: defaultModules(),
  theme: DARK_THEME,
});

/** Önceki oturumdan kayıtlı adresi döner (popup yok). Yoksa boş string. */
export function restore(): string {
  return lsGet(ADDR_KEY);
}

/** Cüzdan seçme modalını açar; seçilen cüzdanın adresini döner ve oturumu saklar. */
export async function connect(): Promise<string> {
  const { address } = await StellarWalletsKit.authModal();
  try {
    localStorage.setItem(ADDR_KEY, address);
    const id = (StellarWalletsKit as any).selectedModule?.productId;
    if (id) localStorage.setItem(WALLET_KEY, id);
  } catch {
    /* localStorage yoksa görmezden gel */
  }
  return address;
}

/** Oturumu temizler (disconnect). */
export function clearSession(): void {
  try {
    localStorage.removeItem(ADDR_KEY);
    localStorage.removeItem(WALLET_KEY);
  } catch {
    /* yok say */
  }
}

/** Contract client'a verilecek imzalama fonksiyonu (seçili cüzdanla XDR imzalar). */
export const signTransaction = async (
  xdr: string,
  opts?: { address?: string },
) => {
  const { signedTxXdr, signerAddress } = await StellarWalletsKit.signTransaction(xdr, {
    address: opts?.address,
    networkPassphrase: Networks.TESTNET,
  });
  return { signedTxXdr, signerAddress };
};
