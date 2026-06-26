<h1>🧾 Stellar Receipt</h1>

Tamper-proof on-chain invoices &amp; receipts, powered by Soroban.

![build](https://img.shields.io/badge/build-passing-brightgreen)
![network](https://img.shields.io/badge/network-testnet-3b82f6)
![contract](https://img.shields.io/badge/contract-deployed-10b981)
![license](https://img.shields.io/badge/license-MIT-lightgrey)

**Live demo → https://stellar-receipt.vercel.app**

Off-chain receipts get forged, lost, and disputed. **Stellar Receipt** moves them on-chain: a merchant issues an invoice, the payer settles it with a Stellar wallet, and a Soroban contract emits an immutable receipt that anyone can verify by URL.

## ✨ Features

- **Immutable receipts** — Every paid invoice is anchored to the Stellar ledger forever.
- **Multi-wallet** — Freighter, Albedo, xBull, Rabet… via Stellar Wallets Kit.
- **XLM + USDC** — Pay in native lumens or stablecoin.
- **Public verification** — Share `/pay/:id` with anyone. No login needed.
- **Cheap + fast** — Sub-cent fees, ~5s finality.

## 🚀 Quickstart

```bash
# 1. Clone
git clone https://github.com/yigitcangokmen/stellar-receipt.git
cd stellar-receipt

# 2. Build & test the contract (Rust + Soroban)
cargo test
stellar contract build              # → target/wasm32v1-none/release/receipt.wasm

# 3. Run the frontend
cd frontend && npm install && npm run dev
```

> Deployed testnet contract: `CCHPF5XGHHACLD5BBYWONSJTYLOJHE5WYRUPZ37FRNBETYHRENAJRZCI`

## 🏗️ Architecture

```
  ┌──────────┐   create   ┌──────────┐   write   ┌──────────────┐
  │ Merchant │ ─────────► │ Frontend │ ────────► │   Soroban    │
  └──────────┘            │ (React)  │           │   Contract   │
                          └────┬─────┘           │              │
  ┌──────────┐    pay     ┌────▼─────┐ submit tx │  ⌁ PENDING   │
  │  Payer   │ ─────────► │  Wallet  │ ────────► │  ✓ PAID      │
  └──────────┘            │   Kit    │           │  🧾 Receipt  │
                          └──────────┘           └──────┬───────┘
                                                        │
  ┌──────────┐        /pay/:id · read-only             │
  │ Verifier │ ◄──────────────────────────────────────-┘
  └──────────┘
```

## 📁 Project Structure

```
stellar-receipt/
├── contracts/receipt/      # Soroban Rust contract
│   ├── src/lib.rs          # create_invoice · pay · cancel · get · list
│   └── src/test.rs         # 7 unit tests
├── frontend/               # React + Vite + TS
│   ├── src/Landing.tsx     # /        landing
│   ├── src/AppPage.tsx     # /app     create · verify · my invoices
│   ├── src/PayPage.tsx     # /pay/:id payer-facing receipt
│   └── src/lib/            # contract · wallet · config · format
├── deployments.json        # testnet contract id + token addresses
└── README.md
```

## 📜 Contract API

| Method | Auth | Description |
|--------|------|-------------|
| `create_invoice(merchant, token, amount, memo)` | merchant | Creates an invoice, returns its id |
| `pay_invoice(invoice_id, payer)` | payer | Transfers the token, marks the invoice PAID |
| `cancel_invoice(invoice_id)` | merchant | Cancels an unpaid invoice |
| `get_invoice(invoice_id)` | public | Returns the invoice/receipt (verification) |
| `list_by_merchant(merchant)` | public | Returns a merchant's invoice ids |

## 🗺️ Roadmap

- [x] Soroban contract · MVP methods
- [x] Testnet deployment
- [x] Frontend + multi-wallet connect
- [x] Public receipt verification by URL
- [ ] PDF receipt export
- [ ] Mainnet launch
- [ ] Recurring invoices & subscriptions

## 📄 License

MIT © 2026 — Built for the **Stellar** challenge.
