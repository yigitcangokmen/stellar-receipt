/* =====================================================================
   AppPage.tsx — Stellar Receipt main app screen
   ---------------------------------------------------------------------
   React 18 + TypeScript. Inline styles only — no Tailwind, no UI kit.
   All state machines (connect, create invoice, verifier, success modal)
   are simulated locally with setTimeout. Replace the simulated bodies
   inside `connectWallet`, `createInvoice`, and `verify` with real
   Stellar SDK / Soroban contract calls when wiring up production.
   ===================================================================== */

import { useEffect, useRef, useState, CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import * as wallet from './lib/wallet';
import * as c from './lib/contract';
import { TOKENS } from './lib/config';
import { tokenSymbol, formatAmount } from './lib/format';
import { Status as CStatus, type Invoice as ContractInvoice } from './contract/receipt';

type Token = 'USDC' | 'XLM';
type Status = 'PAID' | 'PENDING';
type VerifyPhase = 'idle' | 'searching' | 'success' | 'error';

interface Invoice {
  number: number;
  id: string;
  shortId: string;
  hash: string;
  memo: string;
  payer: string;
  amount: string;
  token: Token;
  status: Status;
  createdAt: string;
  ledger: string;
  paidAt: string;
  payUrl?: string;
}

interface VerifyResult {
  id: string;
  memo: string;
  amount: string;
  token: Token;
  from: string;
  to: string;
  paidAt: string;
  ledger: string;
  txHash?: string;
  status: Status;
}

const short = (a: string) => (a ? `${a.slice(0, 4)}...${a.slice(-4)}` : '—');
const payLink = (n: number) => `${window.location.origin}/pay/${n}`;

function fmtShort(t: bigint): string {
  if (!t) return '—';
  const d = new Date(Number(t) * 1000);
  const mon = d.toLocaleString('en-US', { month: 'short' });
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${mon} ${d.getDate()} · ${hh}:${mm}`;
}

function toDesign(inv: ContractInvoice): Invoice {
  const n = Number(inv.id);
  return {
    number: n,
    id: 'INV-#' + n,
    shortId: '#' + n,
    hash: '',
    memo: inv.memo,
    payer: short(inv.merchant),
    amount: formatAmount(inv.amount),
    token: tokenSymbol(inv.token),
    status: inv.status === CStatus.Paid ? 'PAID' : 'PENDING',
    createdAt: fmtShort(inv.created_at),
    ledger: '—',
    paidAt: inv.paid_at ? fmtShort(inv.paid_at) : '—',
    payUrl: payLink(n),
  };
}

export default function AppPage() {
  const navigate = useNavigate();
  /* --- wallet --- */
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [address, setAddress] = useState('');

  /* --- invoice form --- */
  const [amount, setAmount] = useState<number | ''>(1250);
  const [token, setToken] = useState<Token>('XLM');
  const [memo, setMemo] = useState('Logo design — Acme Co.');
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  /* --- invoices list --- */
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  /* --- success modal --- */
  const [successOpen, setSuccessOpen] = useState(false);
  const [successInvoice, setSuccessInvoice] = useState<Invoice | null>(null);

  /* --- verifier --- */
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyPhase, setVerifyPhase] = useState<VerifyPhase>('idle');
  const [verifyLedger, setVerifyLedger] = useState(58231900);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const verifyTimerRef = useRef<number | null>(null);

  /* --- toast --- */
  const [toastMsg, setToastMsg] = useState('');
  const [toastOn, setToastOn] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (verifyTimerRef.current) window.clearInterval(verifyTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setToastOn(true);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastOn(false), 2400);
  };

  const loadInvoices = async (addr: string) => {
    const ids = await c.listByMerchant(addr);
    const items = await Promise.all(ids.map((id) => c.getInvoice(id)));
    setInvoices(items.reverse().map(toDesign));
  };

  // Önceki oturumdan bağlıysa popup'sız geri yükle.
  useEffect(() => {
    const a = wallet.restore();
    if (a) {
      setAddress(a);
      setConnected(true);
      loadInvoices(a).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- handlers (Soroban contract'a bağlı) --- */
  const connectWallet = async () => {
    if (connecting || connected) return;
    setConnecting(true);
    try {
      const addr = await wallet.connect();
      setAddress(addr);
      setConnected(true);
      await loadInvoices(addr);
      showToast('Wallet connected · ' + short(addr));
    } catch (e: any) {
      showToast(String(e.message ?? e), 'error');
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    wallet.clearSession();
    setConnected(false);
    setAddress('');
    setInvoices([]);
    showToast('Wallet disconnected');
  };

  const createInvoice = async () => {
    if (creatingInvoice) return;
    const amt = Number(amount);
    if (!amt || amt < 1) {
      showToast('Amount must be at least 1', 'error');
      return;
    }
    setCreatingInvoice(true);
    try {
      const id = await c.createInvoice(
        address,
        TOKENS[token].sac,
        c.toStroops(String(amt)),
        memo || 'New invoice',
      );
      await loadInvoices(address);
      const inv = toDesign(await c.getInvoice(id));
      setSuccessInvoice(inv);
      setSuccessOpen(true);
    } catch (e: any) {
      showToast(String(e.message ?? e), 'error');
    } finally {
      setCreatingInvoice(false);
    }
  };

  const verify = async () => {
    const val = verifyInput.trim();
    if (!val) return;
    const v = val.replace(/^#/, '');
    setVerifyPhase('searching');
    if (verifyTimerRef.current) window.clearInterval(verifyTimerRef.current);
    verifyTimerRef.current = window.setInterval(
      () => setVerifyLedger((n) => n + 1),
      200,
    );
    try {
      if (!/^\d+$/.test(v)) throw new Error('not a number');
      const inv = await c.getInvoice(BigInt(v));
      const isPaid = inv.status === CStatus.Paid;
      const txHash = isPaid ? await c.getPaymentTxHash(BigInt(v)) : undefined;
      if (verifyTimerRef.current) window.clearInterval(verifyTimerRef.current);
      setVerifyResult({
        id: 'INV-#' + Number(inv.id),
        memo: inv.memo,
        amount: formatAmount(inv.amount),
        token: tokenSymbol(inv.token),
        from: inv.payer ? short(inv.payer) : '—',
        to: short(inv.merchant),
        paidAt: inv.paid_at ? fmtShort(inv.paid_at) : '—',
        ledger: '—',
        txHash,
        status: isPaid ? 'PAID' : 'PENDING',
      });
      setVerifyPhase('success');
    } catch {
      if (verifyTimerRef.current) window.clearInterval(verifyTimerRef.current);
      setVerifyPhase('error');
    }
  };

  const openPay = (n: number) => navigate('/pay/' + n);

  /* --- derived view-model --- */
  const tokBtn = (t: Token, color: string) => {
    const active = token === t;
    return {
      background: active ? color : '#0A0E1A',
      color: active ? '#0A0E1A' : '#9CA3AF',
      border: '1px solid ' + (active ? color : '#2A3142'),
    } as CSSProperties;
  };

  const paidCount = invoices.filter((i) => i.status === 'PAID').length;
  const pendingCount = invoices.filter((i) => i.status === 'PENDING').length;

  const subtitle = !connected
    ? 'Connect your wallet to see your invoices'
    : invoices.length === 0
      ? 'No invoices yet — create one above'
      : `${invoices.length} records for this wallet`;

  /* ===================== render ===================== */
  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 50% -20%, rgba(250,204,21,.04) 0%, transparent 60%), #0A0E1A',
        color: '#E4E7EB',
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <Keyframes />

      {/* Create-invoice page overlay (orbit) */}
      {creatingInvoice && <PageOverlay />}

      {/* Success modal */}
      {successOpen && successInvoice && (
        <SuccessModal
          invoice={successInvoice}
          onClose={() => setSuccessOpen(false)}
          onOpenPay={() => successInvoice && openPay(successInvoice.number)}
          onCopy={() => {
            if (successInvoice.payUrl) showToast('Link copied · ' + successInvoice.payUrl);
          }}
        />
      )}

      {/* Toast */}
      {toastOn && <Toast message={toastMsg} type={toastType} />}

      {/* Header */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Logo size={44} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              Stellar<span style={{ color: '#FACC15' }}>Receipt</span>
            </div>
            <div style={mono(11, '#6B7280', 0.1, 4)}>On-chain receipts you can verify. On Stellar.</div>
          </div>
        </div>

        {!connected ? (
          <button
            onClick={connectWallet}
            style={{
              background: '#FACC15',
              color: '#0A0E1A',
              padding: '13px 26px',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              animation: 'connect-pulse 2.5s ease-out infinite',
            }}
          >
            {connecting && <MiniOrbit />}
            <span>{connecting ? 'Connecting...' : 'Connect wallet'}</span>
          </button>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: '#121826',
              border: '1px solid #1E2433',
              padding: '10px 16px',
              borderRadius: 999,
              animation: 'pop 0.4s cubic-bezier(.5,1.6,.5,1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  background: '#10B981',
                  borderRadius: '50%',
                  boxShadow: '0 0 8px #10B981',
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              />
              <div style={mono(12, '#10B981', 0.08)}>TESTNET</div>
            </div>
            <div style={{ width: 1, height: 16, background: '#2A3142' }} />
            <div style={mono(13, '#fff')}>{short(address)}</div>
            <button
              onClick={disconnect}
              style={{ ...mono(11, '#6B7280'), cursor: 'pointer', paddingLeft: 8, borderLeft: '1px solid #2A3142', background: 'transparent', border: 'none' }}
            >
              disconnect
            </button>
          </div>
        )}
      </header>

      <main style={{ maxWidth: 1320, margin: '0 auto', padding: '48px 56px 96px' }}>
        {/* Top row: Create + Verify */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          {/* === Create invoice === */}
          <div style={panel}>
            <h2 style={panelTitle}>Create invoice</h2>
            <p style={panelSub}>Amount, payer, memo → written on-chain</p>

            {!connected ? (
              <LockedHint
                text="Connect your wallet to create invoices"
                hint="Freighter · Albedo · xBull supported"
                iconType="lock"
              />
            ) : (
              <div style={{ animation: 'fade-up 0.4s ease-out' }}>
                <div style={{ marginBottom: 22 }}>
                  <Label>AMOUNT</Label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 10,
                      background: '#0A0E1A',
                      border: '1px solid #2A3142',
                      borderRadius: 10,
                      padding: '14px 16px',
                    }}
                  >
                    <input
                      type="number"
                      min={0}
                      max={1000000}
                      step={1}
                      value={amount}
                      placeholder="0"
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') return setAmount('');
                        const n = Number(raw);
                        if (Number.isNaN(n)) return;
                        setAmount(Math.min(1000000, Math.max(0, n)));
                      }}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: 'transparent',
                        border: 'none',
                        color: '#FACC15',
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: 32,
                        fontWeight: 600,
                        letterSpacing: '-0.02em',
                        lineHeight: 1,
                        outline: 'none',
                        padding: 0,
                      }}
                    />
                    <div style={mono(14, '#6B7280')}>{token}</div>
                  </div>
                  <div style={{ ...mono(10, '#6B7280'), marginTop: 6 }}>1 – 1,000,000</div>
                </div>

                <div style={{ marginBottom: 22 }}>
                  <Label>TOKEN</Label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setToken('USDC')} style={{ ...tokenChip, ...tokBtn('USDC', '#38BDF8') }}>USDC</button>
                    <button onClick={() => setToken('XLM')} style={{ ...tokenChip, ...tokBtn('XLM', '#FACC15') }}>XLM</button>
                  </div>
                </div>

                <div style={{ marginBottom: 22 }}>
                  <Label>MEMO</Label>
                  <input
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="Logo design — Acme Co."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: '#0A0E1A',
                      border: '1px solid #2A3142',
                      borderRadius: 8,
                      padding: '12px 14px',
                      color: '#fff',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  onClick={createInvoice}
                  style={{
                    width: '100%',
                    background: creatingInvoice ? '#1A1410' : '#FACC15',
                    color: '#0A0E1A',
                    padding: '14px 22px',
                    borderRadius: 10,
                    fontWeight: 600,
                    fontSize: 14,
                    textAlign: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    border: 'none',
                    minHeight: 20,
                  }}
                >
                  {creatingInvoice && (
                    <>
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: 0,
                          background: '#FACC15',
                          animation: 'btn-progress 1.4s ease-out forwards',
                          borderRadius: '10px 0 0 10px',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background:
                            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,.4) 50%, transparent 100%)',
                          animation: 'btn-scan 1.2s linear infinite',
                          pointerEvents: 'none',
                        }}
                      />
                    </>
                  )}
                  <span style={{ position: 'relative' }}>
                    {creatingInvoice ? 'Writing on-chain...' : 'Create invoice →'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* === Verify receipt === */}
          <div style={panel}>
            <h2 style={panelTitle}>Verify receipt</h2>
            <p style={panelSub}>No wallet needed · anyone can verify</p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <input
                type="text"
                value={verifyInput}
                onChange={(e) => {
                  setVerifyInput(e.target.value);
                  setVerifyPhase('idle');
                }}
                placeholder="Type invoice number (e.g. 1)..."
                spellCheck={false}
                autoComplete="off"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: '#0A0E1A',
                  border: '1px solid #2A3142',
                  borderRadius: 10,
                  padding: '14px 16px',
                  color: '#FACC15',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <button
                onClick={verify}
                style={{
                  background: '#FACC15',
                  color: '#0A0E1A',
                  padding: '14px 22px',
                  fontWeight: 600,
                  fontSize: 14,
                  borderRadius: 10,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                  border: 'none',
                }}
              >
                {verifyPhase === 'searching' && (
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      border: '2px solid rgba(10,14,26,.3)',
                      borderTopColor: '#0A0E1A',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                )}
                <span>
                  {verifyPhase === 'searching'
                    ? 'Querying...'
                    : verifyPhase === 'success'
                      ? '✓ Verified'
                      : 'Verify'}
                </span>
              </button>
            </div>

            {verifyPhase === 'idle' && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '32px 16px',
                  border: '1px dashed #2A3142',
                  borderRadius: 10,
                }}
              >
                <div style={mono(11, '#6B7280', 0.15)}>AWAITING QUERY</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>Type an invoice number above</div>
              </div>
            )}

            {verifyPhase === 'searching' && (
              <div
                style={{
                  background: '#0A0E1A',
                  border: '1px solid #1E2433',
                  borderRadius: 10,
                  padding: 24,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: '30%',
                    background:
                      'linear-gradient(90deg, transparent 0%, rgba(250,204,21,.1) 50%, transparent 100%)',
                    animation: 'scan 1.8s ease-in-out infinite',
                  }}
                />
                <div style={{ ...mono(12), lineHeight: 1.9, position: 'relative' }}>
                  <div style={{ color: '#FACC15' }}>→ Connecting to Soroban RPC...</div>
                  <div style={{ color: '#FACC15' }}>→ Querying ledger #{verifyLedger.toLocaleString('en-US')}</div>
                  <div style={{ color: '#FACC15' }}>→ Resolving contract: CDAG...2YSU</div>
                  <div style={{ color: '#6B7280' }}>→ get_invoice({verifyInput})</div>
                </div>
              </div>
            )}

            {verifyPhase === 'success' && verifyResult && <VerifyReceipt r={verifyResult} />}

            {verifyPhase === 'error' && (
              <div
                style={{
                  background: '#0A0E1A',
                  border: '1px solid #EF4444',
                  borderRadius: 10,
                  padding: 22,
                  display: 'flex',
                  gap: 14,
                  alignItems: 'center',
                  animation: 'fade-up 0.3s ease-out',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    background: 'rgba(239,68,68,.15)',
                    border: '1px solid #EF4444',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={2.5}>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#EF4444', letterSpacing: '-0.01em' }}>
                    Receipt not found
                  </div>
                  <div style={{ ...mono(12, '#9CA3AF'), marginTop: 3 }}>
                    No invoice with that number on-chain.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* === My invoices === */}
        <div style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
            <div>
              <h2 style={panelTitle}>My invoices</h2>
              <div style={{ fontSize: 13, color: '#6B7280' }}>{subtitle}</div>
            </div>
            {connected && (
              <div style={{ display: 'flex', gap: 18, ...mono(11, '#6B7280') }}>
                <div>
                  TOTAL <span style={{ color: '#fff', fontWeight: 600, marginLeft: 4 }}>{invoices.length}</span>
                </div>
                <div>
                  PAID <span style={{ color: '#10B981', fontWeight: 600, marginLeft: 4 }}>{paidCount}</span>
                </div>
                <div>
                  PENDING <span style={{ color: '#FACC15', fontWeight: 600, marginLeft: 4 }}>{pendingCount}</span>
                </div>
              </div>
            )}
          </div>

          {!connected ? (
            <LockedHint
              big
              text="Connect your wallet to see your invoices"
              hint="All your history lives on-chain — impossible to lose"
              iconType="file"
            />
          ) : invoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#6B7280' }}>No invoices found.</div>
          ) : (
            <div>
              <div style={tableRow(true)}>
                <div>INVOICE</div>
                <div>MEMO</div>
                <div>ISSUER</div>
                <div>AMOUNT</div>
                <div>STATUS</div>
                <div />
              </div>
              {invoices.map((inv) => (
                <div
                  key={inv.number}
                  className="inv-row"
                  onClick={() => openPay(inv.number)}
                  style={{ ...tableRow(false), cursor: 'pointer' }}
                >
                  <div style={mono(12, '#FACC15')}>{inv.shortId}</div>
                  <div>
                    <div style={{ fontSize: 14, color: '#fff' }}>{inv.memo}</div>
                    <div style={{ ...mono(10, '#6B7280'), marginTop: 3 }}>{inv.createdAt}</div>
                  </div>
                  <div style={mono(12, '#9CA3AF')}>{inv.payer}</div>
                  <div
                    style={{
                      fontFamily: "'Space Grotesk'",
                      fontSize: 18,
                      fontWeight: 600,
                      color: '#fff',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {inv.amount}{' '}
                    <span style={{ ...mono(11, '#6B7280') }}>{inv.token}</span>
                  </div>
                  <StatusPill status={inv.status} />
                  <div style={{ textAlign: 'right' }}>
                    {inv.status === 'PENDING' ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openPay(inv.number);
                        }}
                        style={{
                          ...mono(10, '#FACC15'),
                          cursor: 'pointer',
                          padding: '4px 10px',
                          border: '1px solid #FACC15',
                          borderRadius: 4,
                          background: 'transparent',
                        }}
                      >
                        ↗ link
                      </button>
                    ) : (
                      <span style={mono(10, '#6B7280')}>✓</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer
          style={{
            marginTop: 56,
            textAlign: 'center',
            ...mono(11, '#6B7280', 0.1),
          }}
        >
          TESTNET · CDAG...2YSU · v0.1 MVP
        </footer>
      </main>
    </div>
  );
}

/* ============== sub-components ============== */

function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 84 84" fill="none">
      <rect x="2" y="2" width="80" height="80" rx="18" fill="#FACC15" />
      <path d="M24 22 L24 60 L30 56 L36 60 L42 56 L48 60 L54 56 L60 60 L60 22 Z" fill="#0A0E1A" />
      <rect x="30" y="30" width="24" height="2.5" rx="1.25" fill="#FACC15" />
      <rect x="30" y="38" width="18" height="2.5" rx="1.25" fill="#FACC15" />
      <path
        d="M42 44 L43.6 48.4 L48 48.4 L44.5 51.1 L45.9 55.5 L42 52.8 L38.1 55.5 L39.5 51.1 L36 48.4 L40.4 48.4 Z"
        fill="#FACC15"
      />
    </svg>
  );
}

function MiniOrbit() {
  return (
    <div style={{ position: 'relative', width: 18, height: 18 }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 6, height: 6, margin: '-3px 0 0 -3px', background: '#0A0E1A', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 3, height: 3, margin: '-1.5px 0 0 -1.5px', background: '#0A0E1A', borderRadius: '50%', animation: 'mini-orbit-1 1.1s linear infinite' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 2.5, height: 2.5, margin: '-1.25px 0 0 -1.25px', background: 'rgba(10,14,26,.7)', borderRadius: '50%', animation: 'mini-orbit-2 1.6s linear infinite' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 2, height: 2, margin: '-1px 0 0 -1px', background: 'rgba(10,14,26,.5)', borderRadius: '50%', animation: 'mini-orbit-3 2.2s linear infinite' }} />
    </div>
  );
}

function PageOverlay() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(10,14,26,0.86)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'backdrop-in 0.25s ease-out',
      }}
    >
      <div style={{ position: 'relative', width: 160, height: 160 }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 28, height: 28, margin: '-14px 0 0 -14px', background: '#FACC15', borderRadius: '50%', boxShadow: '0 0 40px rgba(250,204,21,.6)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 12, height: 12, margin: '-6px 0 0 -6px', background: '#fff', borderRadius: '50%', animation: 'page-orbit-1 1.6s linear infinite', boxShadow: '0 0 12px #fff' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 10, height: 10, margin: '-5px 0 0 -5px', background: '#38BDF8', borderRadius: '50%', animation: 'page-orbit-2 2.4s linear infinite', boxShadow: '0 0 10px #38BDF8' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 8, height: 8, margin: '-4px 0 0 -4px', background: '#10B981', borderRadius: '50%', animation: 'page-orbit-3 3.2s linear infinite', boxShadow: '0 0 10px #10B981' }} />
      </div>
    </div>
  );
}

function Toast({ message, type = 'success' }: { message: string; type?: 'success' | 'error' }) {
  const err = type === 'error';
  return (
    <div
      style={{
        position: 'fixed',
        top: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        maxWidth: '90vw',
        background: err ? '#EF4444' : '#10B981',
        color: '#fff',
        padding: '14px 22px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: err ? '0 8px 24px rgba(239,68,68,.3)' : '0 8px 24px rgba(16,185,129,.3)',
        animation: 'toast-in 0.3s ease-out',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3}>
        {err ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M5 12l5 5L20 7" />}
      </svg>
      {message}
    </div>
  );
}

function SuccessModal({
  invoice,
  onClose,
  onOpenPay,
  onCopy,
}: {
  invoice: Invoice;
  onClose: () => void;
  onOpenPay: () => void;
  onCopy: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(10,14,26,0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        animation: 'backdrop-in 0.25s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 520,
          background: 'linear-gradient(180deg, #121826 0%, #0F141F 100%)',
          border: '1px solid rgba(250,204,21,0.3)',
          borderRadius: 20,
          padding: '40px 36px',
          animation: 'modal-in 0.5s cubic-bezier(.2,.9,.3,1.2)',
          overflow: 'hidden',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#6B7280',
            fontSize: 18,
            background: 'transparent',
            border: 'none',
          }}
        >
          ✕
        </button>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <div
            style={{
              width: 72,
              height: 72,
              background: '#10B981',
              borderRadius: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 12px 32px rgba(16,185,129,.4), 0 0 0 6px rgba(16,185,129,.12)',
              animation: 'stamp-drop 0.7s cubic-bezier(.5,1.6,.5,1)',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 600, color: '#fff', letterSpacing: '-0.025em', lineHeight: 1.1 }}>
            Written on-chain.
            <br />
            <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400, color: '#FACC15' }}>
              Share the link.
            </span>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(10,14,26,0.6)',
            border: '1px solid #1E2433',
            borderRadius: 12,
            padding: '18px 20px',
            marginTop: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {invoice.memo}
            </div>
            <div style={{ ...mono(10, '#6B7280'), marginTop: 4 }}>ISSUER · {invoice.payer}</div>
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 600, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1, marginLeft: 16 }}>
            {invoice.amount} <span style={mono(12, '#6B7280')}>{invoice.token}</span>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ ...mono(10, '#6B7280', 0.18), marginBottom: 10 }}>PAYMENT LINK</div>
          <div
            onClick={onOpenPay}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: '#0A0E1A',
              border: '1px dashed #FACC15',
              borderRadius: 10,
              padding: '14px 16px',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FACC15" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <div style={{ ...mono(13, '#FACC15'), flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {invoice.payUrl}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 14, textAlign: 'center', background: 'transparent', border: '1px solid #2A3142', color: '#9CA3AF', fontSize: 13, fontWeight: 500, borderRadius: 10, cursor: 'pointer' }}>
            Close
          </button>
          <button onClick={onCopy} style={{ flex: 1, padding: 14, textAlign: 'center', background: '#FACC15', color: '#0A0E1A', fontSize: 13, fontWeight: 600, borderRadius: 10, cursor: 'pointer', border: 'none' }}>
            Copy link →
          </button>
        </div>
      </div>
    </div>
  );
}

function VerifyReceipt({ r }: { r: VerifyResult }) {
  const ring = r.status === 'PAID' ? '#10B981' : '#FACC15';
  const badgeBg = r.status === 'PAID' ? '#10B981' : '#FACC15';
  const badgeColor = r.status === 'PAID' ? '#fff' : '#0A0E1A';
  const header = r.status === 'PAID' ? 'VERIFIED RECEIPT' : 'PENDING INVOICE';
  const badge = r.status === 'PAID' ? '✓ AUTHENTIC' : '⌁ AWAITING PAYMENT';
  return (
    <div
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, #FAFAF7 0%, #F4F4F0 100%)',
        color: '#0A0E1A',
        borderRadius: 12,
        padding: 24,
        boxShadow: `0 0 0 1.5px ${ring}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={mono(9, '#6B7280', 0.15)}>{header}</div>
          <div style={{ ...mono(12, '#0A0E1A'), marginTop: 3 }}>{r.id}</div>
        </div>
        <div style={{ ...mono(10, badgeColor, 0.1), background: badgeBg, padding: '5px 12px', borderRadius: 999, fontWeight: 600 }}>
          {badge}
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#4B5563', marginBottom: 4 }}>{r.memo}</div>
      <div style={{ fontFamily: "'Space Grotesk'", fontSize: 36, fontWeight: 600, color: '#0A0E1A', letterSpacing: '-0.02em', lineHeight: 1 }}>
        {r.amount} <span style={{ fontSize: 16, color: '#6B7280' }}>{r.token}</span>
      </div>
      <div
        style={{
          borderTop: '1px dashed #D1D5DB',
          margin: '16px 0',
          paddingTop: 14,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          ...mono(10),
        }}
      >
        <KV k="FROM" v={r.from} />
        <KV k="TO" v={r.to} />
        <KV k="PAID AT" v={r.paidAt} />
        <div>
          <div style={{ color: '#9CA3AF', marginBottom: 2 }}>TX HASH</div>
          <div>
            {r.txHash ? (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${r.txHash}`}
                target="_blank"
                rel="noopener"
                style={{ color: '#10B981', textDecoration: 'none' }}
              >
                {r.txHash.slice(0, 8)}...{r.txHash.slice(-4)} ↗
              </a>
            ) : (
              '—'
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div style={{ color: '#9CA3AF', marginBottom: 2 }}>{k}</div>
      <div>{v}</div>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const paid = status === 'PAID';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: paid ? 'rgba(16,185,129,.12)' : 'rgba(250,204,21,.12)',
        color: paid ? '#10B981' : '#FACC15',
        ...mono(10, undefined, 0.1),
        padding: '5px 10px',
        borderRadius: 999,
        fontWeight: 600,
        justifySelf: 'start',
      }}
    >
      {paid ? '✓ PAID' : '⌁ PENDING'}
    </div>
  );
}

function LockedHint({
  text,
  hint,
  iconType,
  big = false,
}: {
  text: string;
  hint: string;
  iconType: 'lock' | 'file';
  big?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: big ? '60px 24px' : '48px 24px',
        textAlign: 'center',
        border: '1px dashed #2A3142',
        borderRadius: 12,
        background: 'rgba(10,14,26,0.4)',
      }}
    >
      <div
        style={{
          width: big ? 64 : 56,
          height: big ? 64 : 56,
          background: 'rgba(250,204,21,.06)',
          border: '1px solid rgba(250,204,21,.2)',
          borderRadius: big ? 16 : 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: big ? 20 : 18,
        }}
      >
        {iconType === 'lock' ? (
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#FACC15" strokeWidth={2}>
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        ) : (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#FACC15" strokeWidth={1.5}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        )}
      </div>
      <div style={{ fontSize: big ? 16 : 15, color: '#E4E7EB', fontWeight: 500, marginBottom: 6 }}>{text}</div>
      <div style={mono(12, '#6B7280')}>{hint}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ ...mono(10, '#9CA3AF', 0.15), marginBottom: 10 }}>{children}</div>;
}

/* ============== style helpers ============== */

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '28px 56px',
  borderBottom: '1px solid #1E2433',
  background: 'rgba(10,14,26,0.7)',
  backdropFilter: 'blur(10px)',
  position: 'sticky',
  top: 0,
  zIndex: 10,
};

const panel: CSSProperties = {
  background: '#121826',
  border: '1px solid #1E2433',
  borderRadius: 16,
  padding: 32,
  position: 'relative',
  overflow: 'hidden',
};

const panelTitle: CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
  color: '#fff',
  letterSpacing: '-0.01em',
  margin: '0 0 6px',
};

const panelSub: CSSProperties = {
  fontSize: 13,
  color: '#6B7280',
  margin: '0 0 28px',
};

const tokenChip: CSSProperties = {
  flex: 1,
  padding: 10,
  textAlign: 'center',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 12,
  fontWeight: 600,
};

function tableRow(header: boolean): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: '80px 1fr 130px 140px 120px 80px',
    gap: 16,
    padding: header ? '12px 16px' : '16px',
    borderBottom: '1px solid #1E2433',
    ...(header ? mono(10, '#6B7280', 0.15) : {}),
    alignItems: header ? undefined : 'center',
    animation: header ? undefined : 'invoice-in 0.4s ease-out forwards',
  };
}

function mono(
  size: number,
  color?: string,
  ls: number = 0,
  marginTop?: number,
): CSSProperties {
  const s: CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: size,
  };
  if (color) s.color = color;
  if (ls) s.letterSpacing = `${ls}em`;
  if (marginTop !== undefined) s.marginTop = marginTop;
  return s;
}

/* ============== keyframes ============== */
function Keyframes() {
  return (
    <style>{`
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      @keyframes connect-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(250,204,21,.5); } 50% { box-shadow: 0 0 0 16px rgba(250,204,21,0); } }
      @keyframes mini-orbit-1 { from { transform: rotate(0deg) translateX(7px) rotate(0deg); } to { transform: rotate(360deg) translateX(7px) rotate(-360deg); } }
      @keyframes mini-orbit-2 { from { transform: rotate(140deg) translateX(7px) rotate(-140deg); } to { transform: rotate(500deg) translateX(7px) rotate(-500deg); } }
      @keyframes mini-orbit-3 { from { transform: rotate(260deg) translateX(7px) rotate(-260deg); } to { transform: rotate(620deg) translateX(7px) rotate(-620deg); } }
      @keyframes btn-progress { 0% { width: 0; } 70% { width: 88%; } 100% { width: 100%; } }
      @keyframes btn-scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
      @keyframes page-orbit-1 { from { transform: rotate(0deg) translateX(56px) rotate(0deg); } to { transform: rotate(360deg) translateX(56px) rotate(-360deg); } }
      @keyframes page-orbit-2 { from { transform: rotate(140deg) translateX(70px) rotate(-140deg); } to { transform: rotate(500deg) translateX(70px) rotate(-500deg); } }
      @keyframes page-orbit-3 { from { transform: rotate(260deg) translateX(84px) rotate(-260deg); } to { transform: rotate(620deg) translateX(84px) rotate(-620deg); } }
      @keyframes fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes pop { 0% { opacity: 0; transform: scale(0.9); } 60% { transform: scale(1.04); } 100% { opacity: 1; transform: scale(1); } }
      @keyframes stamp-drop { 0% { transform: translateY(-220px) translateX(30px) rotate(60deg) scale(2.6); opacity: 0; } 55% { transform: translateY(0) translateX(0) rotate(-8deg) scale(1.2); opacity: 1; } 65% { transform: translateY(0) translateX(0) rotate(-14deg) scale(0.9); opacity: 1; } 100% { transform: translateY(0) translateX(0) rotate(-12deg) scale(1); opacity: 1; } }
      @keyframes toast-in { 0% { opacity: 0; transform: translate(-50%, -20px); } 100% { opacity: 1; transform: translate(-50%, 0); } }
      @keyframes invoice-in { 0% { opacity: 0; transform: translateY(-12px) scale(0.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes backdrop-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes modal-in { 0% { opacity: 0; transform: translateY(40px) scale(0.92); } 60% { opacity: 1; transform: translateY(0) scale(1.02); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
      .inv-row { transition: background 0.15s; }
      .inv-row:hover { background: rgba(255,255,255,0.025); }
    `}</style>
  );
}
