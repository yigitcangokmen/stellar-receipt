// Testnet dağıtım bilgileri (repo kökündeki deployments.json ile aynı).
export const NETWORK = {
  passphrase: "Test SDF Network ; September 2015",
  // Frontend tarayıcıda çalıştığı için resmi endpoint (Ankr free 429 rate-limit yiyordu).
  rpcUrl: "https://soroban-testnet.stellar.org",
  contractId: "CDAGNVYOHSVYWMTXFDMFJ5VI36S2GKCQNGDRPMDAD7EDYXE3REG72YSU",
} as const;

// Cüzdan bağlı değilken read-only simülasyonda kaynak olarak kullanılır (fonlu hesap).
export const READ_SOURCE = "GDGOOYD5ZSQW7QKQZ4SBGKDS6YI44EDQMCOSZUA3GH56ZATUYCVPMDQI";

// Desteklenen tokenlar (Stellar Asset Contract adresleri). Hepsi 7 ondalık.
// USDC testnet'te trustline gerektirir; ödeme bakiye yoksa hata verebilir.
export const TOKENS: Record<string, { label: string; sac: string }> = {
  XLM: { label: "XLM", sac: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" },
  USDC: { label: "USDC", sac: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA" },
};

export const DECIMALS = 7;
export const explorerTx = (hash: string) =>
  `https://stellar.expert/explorer/testnet/tx/${hash}`;
