/* =====================================================================
   PayPage.tsx — Stellar Receipt "/pay/:id" payer-facing screen
   ---------------------------------------------------------------------
   Tasarım birebir korundu (tek koyu kart, PAID damgası, animasyonlar).
   Route'tan gelen `id` ile fatura zincirden çekilir; connectWallet /
   payNow gerçek Stellar Wallets Kit + Soroban çağrılarına bağlandı.
   TX Hash: bu oturumda ödenince ödeme tx'inden gerçek hash + explorer
   linki; önceden ödenmişte "—".
   ===================================================================== */

import { useEffect, useRef, useState, useCallback, CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import * as wallet from './lib/wallet';
import * as c from './lib/contract';
import { NETWORK } from './lib/config';
import { formatAmount, tokenSymbol } from './lib/format';
import { Status as CStatus, type Invoice as ContractInvoice } from './contract/receipt';

type Phase = 'unpaid' | 'signing' | 'paid';

interface Invoice {
  invoiceNum: number;
  amount: string;
  token: 'USDC' | 'XLM';
  memo: string;
  merchant: string;
  merchantFull: string;
  payerAddr: string;
  payerFull: string;
  createdAt: string;
  paidAt: string;
  ledger: string;
  contractId: string;
  contractFull: string;
}

const EXPLORER = 'https://stellar.expert/explorer/testnet';
const CONTRACT_SHORT = 'CDAG...2YSU';

const short = (a: string) => (a ? `${a.slice(0, 4)}...${a.slice(-4)}` : '—');
const shortHash = (h: string) => (h ? `${h.slice(0, 8)}...${h.slice(-4)}` : '—');

function fmtFull(t: bigint): string {
  if (!t) return '—';
  const d = new Date(Number(t) * 1000);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} · ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function mapInvoice(inv: ContractInvoice): Invoice {
  const n = Number(inv.id);
  return {
    invoiceNum: n,
    amount: formatAmount(inv.amount),
    token: tokenSymbol(inv.token),
    memo: inv.memo,
    merchant: short(inv.merchant),
    merchantFull: inv.merchant,
    payerAddr: inv.payer ? short(inv.payer) : '—',
    payerFull: inv.payer ?? '',
    createdAt: fmtFull(inv.created_at),
    paidAt: inv.paid_at ? fmtFull(inv.paid_at) : '—',
    ledger: '—',
    contractId: CONTRACT_SHORT,
    contractFull: NETWORK.contractId,
  };
}

export default function PayPage({ id }: { id: string }) {
  const navigate = useNavigate();
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/app'));

  const [raw, setRaw] = useState<ContractInvoice | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [phase, setPhase] = useState<Phase>('unpaid');
  const [cancelled, setCancelled] = useState(false);

  const [walletConnected, setWalletConnected] = useState(false);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [payerAddress, setPayerAddress] = useState('');
  const [sessionTxHash, setSessionTxHash] = useState<string | undefined>(undefined);

  const [toastOn, setToastOn] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setToastOn(true);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastOn(false), 2400);
  };

  const load = useCallback(async () => {
    try {
      const got = await c.getInvoice(BigInt(id));
      setRaw(got);
      if (got.status === CStatus.Paid) {
        setPhase('paid');
        // Önceden ödenmişse tx hash'i 'paid' event'inden çek (in-session ödemede zaten var).
        c.getPaymentTxHash(BigInt(id)).then((h) => h && setSessionTxHash((cur) => cur ?? h));
      }
      if (got.status === CStatus.Cancelled) setCancelled(true);
    } catch {
      setNotFound(true);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Önceki oturumdan cüzdan bağlıysa popup'sız geri yükle.
  useEffect(() => {
    const a = wallet.restore();
    if (a) {
      setPayerAddress(a);
      setWalletConnected(true);
    }
  }, []);

  const connectWallet = async () => {
    if (walletConnecting || walletConnected) return;
    setWalletConnecting(true);
    try {
      const a = await wallet.connect();
      setPayerAddress(a);
      setWalletConnected(true);
    } catch (e: any) {
      showToast(String(e.message ?? e), 'error');
    } finally {
      setWalletConnecting(false);
    }
  };

  const payNow = async () => {
    if (phase !== 'unpaid' || cancelled || !raw) return;
    try {
      let addr = payerAddress;
      if (!addr) {
        setWalletConnecting(true);
        addr = await wallet.connect();
        setPayerAddress(addr);
        setWalletConnected(true);
        setWalletConnecting(false);
      }
      setPhase('signing');
      // İmzala + gönder; hash'i hemen al (onayı bekleme).
      const { hash, confirm } = await c.payInvoiceOptimistic(addr, BigInt(id));
      // OPTIMISTIC: bildiğimiz verilerle anında PAID göster.
      setSessionTxHash(hash);
      setRaw((cur) =>
        cur
          ? {
              ...cur,
              status: CStatus.Paid,
              payer: addr,
              paid_at: BigInt(Math.floor(Date.now() / 1000)),
            }
          : cur,
      );
      setPhase('paid');
      showToast('Payment sent · confirming…');
      // Onayı ARKADA bekle; başarısızsa geri al.
      confirm()
        .then(() => showToast('Payment confirmed · receipt minted'))
        .catch((e: any) => {
          setSessionTxHash(undefined);
          setRaw((cur) =>
            cur ? { ...cur, status: CStatus.Pending, payer: undefined, paid_at: 0n } : cur,
          );
          setPhase('unpaid');
          showToast('Payment failed: ' + String(e.message ?? e), 'error');
        });
    } catch (e: any) {
      setWalletConnecting(false);
      setPhase('unpaid');
      showToast(String(e.message ?? e), 'error');
    }
  };

  const copyReceipt = async () => {
    const link = `${window.location.origin}/pay/${id}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast('Receipt link copied · ' + window.location.host + '/pay/' + id);
    } catch {
      showToast('Link: ' + link);
    }
  };

  const invoice = raw ? mapInvoice(raw) : null;
  const paid = phase === 'paid';
  const signing = phase === 'signing';
  const payLabel = signing ? 'Signing...' : 'Pay →';

  const cardStyle: CSSProperties = {
    position: 'relative',
    background: '#121826',
    border: `1px solid ${paid ? 'rgba(16,185,129,0.5)' : '#1E2433'}`,
    borderRadius: 18,
    padding: 28,
    transition: 'border-color 0.3s',
    boxShadow: paid ? '0 30px 80px rgba(16,185,129,.15)' : 'none',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 50% -20%, rgba(250,204,21,.05) 0%, transparent 60%), #0A0E1A',
        color: '#E4E7EB',
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <Keyframes />

      {toastOn && <Toast message={toastMsg} type={toastType} />}
      {signing && <PageOverlay />}

      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px 56px',
          borderBottom: '1px solid #1E2433',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Logo size={36} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', letterSpacing: '-0.02em' }}>
              Stellar<span style={{ color: '#FACC15' }}>Receipt</span>
            </div>
            <div style={{ ...mono(10, '#6B7280', 0.12), marginTop: 2 }}>/pay/{id}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TestnetPill />
          {!walletConnected ? (
            <button
              onClick={connectWallet}
              style={{
                background: '#FACC15',
                color: '#0A0E1A',
                padding: '10px 18px',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {walletConnecting && <MiniOrbit size={14} />}
              <span>{walletConnecting ? 'Connecting...' : 'Connect wallet'}</span>
            </button>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#121826',
                border: '1px solid #1E2433',
                padding: '7px 12px',
                borderRadius: 999,
              }}
            >
              <div style={{ width: 7, height: 7, background: '#10B981', borderRadius: '50%', boxShadow: '0 0 6px #10B981' }} />
              <div style={mono(12, '#fff')}>{short(payerAddress)}</div>
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '64px 32px 96px' }}>
        {notFound ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '72px 24px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: 'rgba(250,204,21,0.06)',
                border: '1px solid rgba(250,204,21,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FACC15" strokeWidth={1.5}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#E4E7EB', marginBottom: 6 }}>
              Invoice not found
            </div>
            <div style={{ ...mono(12, '#6B7280'), marginBottom: 24 }}>
              No invoice #{id} on this contract.
            </div>
            <button onClick={goBack} style={{ ...secondaryBtn, padding: '14px 24px' }}>
              ← Back to app
            </button>
          </div>
        ) : !invoice ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 24px' }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: '3px solid #1E2433',
                borderTopColor: '#FACC15',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: 16,
              }}
            />
            <div style={mono(12, '#6B7280')}>Loading…</div>
          </div>
        ) : (
          <>
            {/* Lead-in copy */}
            <div style={{ marginBottom: 32, animation: 'fade-up 0.4s ease-out' }}>
              {!paid ? (
                <div style={leadStyle}>
                  You owe <span style={{ color: '#FACC15' }}>{invoice.amount} {invoice.token}</span>
                  <br />
                  <span style={italicMuted('#9CA3AF')}>to a Stellar address.</span>
                </div>
              ) : (
                <div style={leadStyle}>
                  Paid.<br />
                  <span style={italicMuted('#FACC15')}>Sealed on the ledger.</span>
                </div>
              )}
            </div>

            {/* Single dark card — same shell for unpaid + paid */}
            <div style={cardStyle}>
              {/* Header row: status pill + invoice number */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: 22,
                  borderBottom: '1px solid #1E2433',
                  marginBottom: 4,
                }}
              >
                <StatusPill tone={paid ? 'paid' : cancelled ? 'cancelled' : 'pending'} />
                <div style={{ fontSize: 24, fontWeight: 600, color: '#fff', letterSpacing: '-0.02em' }}>
                  Invoice #{invoice.invoiceNum}
                </div>
              </div>

              {/* Field rows */}
              <Field label="Amount">
                <span style={{ fontSize: 22, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>
                  {invoice.amount} <span style={mono(12, '#6B7280')}>{invoice.token}</span>
                </span>
              </Field>
              <Field label="Memo">
                <span style={{ fontSize: 14, color: '#fff' }}>{invoice.memo}</span>
              </Field>
              <Field label="Issuer">
                <ExplorerLink href={`${EXPLORER}/account/${invoice.merchantFull}`} color="#FACC15">
                  {invoice.merchant}
                </ExplorerLink>
              </Field>
              <Field label="Payer">
                {!paid ? (
                  <span style={mono(13, '#6B7280')}>—</span>
                ) : (
                  <ExplorerLink href={`${EXPLORER}/account/${invoice.payerFull}`} color="#10B981">
                    {invoice.payerAddr}
                  </ExplorerLink>
                )}
              </Field>
              <Field label="Created">
                <span style={mono(13, '#fff')}>{invoice.createdAt}</span>
              </Field>
              <Field label="TX Hash" last>
                {paid && sessionTxHash ? (
                  <ExplorerLink href={`${EXPLORER}/tx/${sessionTxHash}`} color="#10B981">
                    {shortHash(sessionTxHash)}
                  </ExplorerLink>
                ) : (
                  <span style={mono(13, '#6B7280')}>—</span>
                )}
              </Field>

              {/* Action row */}
              {!paid ? (
                <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
                  {cancelled ? (
                    <div
                      style={{
                        flex: 1,
                        background: 'rgba(239,68,68,0.1)',
                        color: '#EF4444',
                        border: '1px solid #EF4444',
                        padding: '18px 24px',
                        borderRadius: 12,
                        fontWeight: 600,
                        fontSize: 15,
                        textAlign: 'center',
                      }}
                    >
                      Bu fatura iptal edilmiş — ödenemez.
                    </div>
                  ) : (
                    <button
                      onClick={payNow}
                      style={{
                        flex: 1,
                        background: '#FACC15',
                        color: '#0A0E1A',
                        padding: '18px 24px',
                        borderRadius: 12,
                        fontWeight: 600,
                        fontSize: 16,
                        textAlign: 'center',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        border: 'none',
                        animation: 'connect-pulse 2.5s ease-out infinite',
                      }}
                    >
                      {signing && <MiniOrbit size={18} />}
                      <span>{payLabel}</span>
                    </button>
                  )}
                  <button onClick={goBack} style={secondaryBtn}>
                    ← back
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
                  <button
                    onClick={copyReceipt}
                    style={{
                      flex: 1,
                      background: '#FACC15',
                      color: '#0A0E1A',
                      padding: 16,
                      borderRadius: 12,
                      fontWeight: 600,
                      fontSize: 14,
                      textAlign: 'center',
                      cursor: 'pointer',
                      border: 'none',
                    }}
                  >
                    Copy receipt link
                  </button>
                  <button onClick={goBack} style={secondaryBtn}>
                    ← back
                  </button>
                </div>
              )}

              {/* Fine print */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 18,
                  ...mono(10, '#6B7280', 0.1),
                }}
              >
                <div>FEE · ~$0.00001</div>
                <div>SETTLES IN ~5s</div>
                <a
                  href={`${EXPLORER}/contract/${invoice.contractFull}`}
                  target="_blank"
                  rel="noopener"
                  style={{
                    color: '#FACC15',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  CONTRACT · {invoice.contractId}
                  <ArrowIcon size={10} />
                </a>
              </div>

              {/* PAID stamp overlay (paid only) */}
              {paid && (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      top: -40,
                      right: 0,
                      width: 280,
                      height: 280,
                      borderRadius: '50%',
                      border: '3px solid #10B981',
                      pointerEvents: 'none',
                      animation: 'stamp-splat 1.4s ease-out forwards',
                      zIndex: 5,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: -38,
                      right: -32,
                      ...mono(56),
                      fontWeight: 700,
                      color: '#10B981',
                      border: '7px solid #10B981',
                      padding: '14px 30px',
                      borderRadius: 14,
                      letterSpacing: '0.12em',
                      background: 'rgba(10,14,26,0.85)',
                      backdropFilter: 'blur(6px)',
                      transformOrigin: 'center',
                      animation: 'stamp-drop 0.7s cubic-bezier(.5,1.6,.5,1) forwards',
                      opacity: 0,
                      boxShadow:
                        '0 6px 0 rgba(16,185,129,0.25), 0 20px 40px rgba(16,185,129,0.35)',
                      zIndex: 6,
                      pointerEvents: 'none',
                    }}
                  >
                    ✓ PAID
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </main>

      <footer
        style={{
          borderTop: '1px solid #1E2433',
          padding: '24px 56px',
          textAlign: 'center',
          ...mono(11, '#6B7280', 0.12),
        }}
      >
        BUILT ON STELLAR · v0.1
      </footer>
    </div>
  );
}

/* ============ small pieces ============ */

function Field({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '18px 0',
        borderBottom: last ? undefined : '1px solid #1E2433',
      }}
    >
      <div style={{ fontSize: 14, color: '#9CA3AF' }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function StatusPill({ tone }: { tone: 'pending' | 'paid' | 'cancelled' }) {
  const map = {
    paid: { color: '#10B981', bg: 'rgba(16,185,129,0.15)', label: '✓ PAID' },
    pending: { color: '#FACC15', bg: 'rgba(250,204,21,0.12)', label: '⌁ PENDING' },
    cancelled: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: '✕ CANCELLED' },
  }[tone];
  return (
    <div
      style={{
        ...mono(11, map.color, 0.12),
        background: map.bg,
        padding: '6px 12px',
        borderRadius: 999,
        fontWeight: 600,
      }}
    >
      {map.label}
    </div>
  );
}

function ExplorerLink({
  href,
  color,
  children,
}: {
  href: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      style={{
        ...mono(13, color),
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {children}
      <ArrowIcon size={11} />
    </a>
  );
}

function ArrowIcon({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

function TestnetPill() {
  return (
    <div
      style={{
        ...mono(11, '#10B981'),
        padding: '6px 12px',
        border: '1px solid #10B981',
        borderRadius: 999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          background: '#10B981',
          borderRadius: '50%',
          animation: 'pulse 2s ease-in-out infinite',
        }}
      />
      TESTNET
    </div>
  );
}

function MiniOrbit({ size = 18 }: { size?: number }) {
  const dot = Math.max(4, Math.round(size / 3));
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: dot,
          height: dot,
          margin: `${-dot / 2}px 0 0 ${-dot / 2}px`,
          background: '#0A0E1A',
          borderRadius: '50%',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 3,
          height: 3,
          margin: '-1.5px 0 0 -1.5px',
          background: '#0A0E1A',
          borderRadius: '50%',
          animation: 'mini-orbit-1 1.1s linear infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 2.5,
          height: 2.5,
          margin: '-1.25px 0 0 -1.25px',
          background: 'rgba(10,14,26,.7)',
          borderRadius: '50%',
          animation: 'mini-orbit-2 1.6s linear infinite',
        }}
      />
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
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 28,
            height: 28,
            margin: '-14px 0 0 -14px',
            background: '#FACC15',
            borderRadius: '50%',
            boxShadow: '0 0 40px rgba(250,204,21,.6)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 12,
            height: 12,
            margin: '-6px 0 0 -6px',
            background: '#fff',
            borderRadius: '50%',
            animation: 'page-orbit-1 1.6s linear infinite',
            boxShadow: '0 0 12px #fff',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 10,
            height: 10,
            margin: '-5px 0 0 -5px',
            background: '#38BDF8',
            borderRadius: '50%',
            animation: 'page-orbit-2 2.4s linear infinite',
            boxShadow: '0 0 10px #38BDF8',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 8,
            height: 8,
            margin: '-4px 0 0 -4px',
            background: '#10B981',
            borderRadius: '50%',
            animation: 'page-orbit-3 3.2s linear infinite',
            boxShadow: '0 0 10px #10B981',
          }}
        />
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

function Logo({ size = 36 }: { size?: number }) {
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

/* ============ style helpers ============ */

const leadStyle: CSSProperties = {
  fontSize: 44,
  fontWeight: 600,
  color: '#fff',
  letterSpacing: '-0.03em',
  lineHeight: 1.05,
};

const italicMuted = (color: string): CSSProperties => ({
  fontFamily: "'Instrument Serif', serif",
  fontStyle: 'italic',
  fontWeight: 400,
  color,
});

const secondaryBtn: CSSProperties = {
  background: 'transparent',
  border: '1px solid #2A3142',
  color: '#9CA3AF',
  padding: '18px 22px',
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function mono(size: number, color?: string, ls?: number): CSSProperties {
  const s: CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: size,
  };
  if (color) s.color = color;
  if (ls !== undefined) s.letterSpacing = `${ls}em`;
  return s;
}

/* ============ keyframes ============ */

function Keyframes() {
  return (
    <style>{`
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      @keyframes connect-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(250,204,21,.5); } 50% { box-shadow: 0 0 0 16px rgba(250,204,21,0); } }
      @keyframes mini-orbit-1 { from { transform: rotate(0deg) translateX(7px) rotate(0deg); } to { transform: rotate(360deg) translateX(7px) rotate(-360deg); } }
      @keyframes mini-orbit-2 { from { transform: rotate(140deg) translateX(7px) rotate(-140deg); } to { transform: rotate(500deg) translateX(7px) rotate(-500deg); } }
      @keyframes mini-orbit-3 { from { transform: rotate(260deg) translateX(7px) rotate(-260deg); } to { transform: rotate(620deg) translateX(7px) rotate(-620deg); } }
      @keyframes page-orbit-1 { from { transform: rotate(0deg) translateX(56px) rotate(0deg); } to { transform: rotate(360deg) translateX(56px) rotate(-360deg); } }
      @keyframes page-orbit-2 { from { transform: rotate(140deg) translateX(70px) rotate(-140deg); } to { transform: rotate(500deg) translateX(70px) rotate(-500deg); } }
      @keyframes page-orbit-3 { from { transform: rotate(260deg) translateX(84px) rotate(-260deg); } to { transform: rotate(620deg) translateX(84px) rotate(-620deg); } }
      @keyframes backdrop-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes toast-in { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }
      @keyframes stamp-drop {
        0% { transform: translateY(-220px) translateX(30px) rotate(60deg) scale(2.6); opacity: 0; }
        55% { transform: translateY(0) translateX(0) rotate(-8deg) scale(1.2); opacity: 1; }
        65% { transform: translateY(0) translateX(0) rotate(-14deg) scale(0.9); opacity: 1; }
        100% { transform: translateY(0) translateX(0) rotate(-12deg) scale(1); opacity: 1; }
      }
      @keyframes stamp-splat {
        0%, 50% { opacity: 0; transform: scale(0.4); }
        58% { opacity: 0.55; transform: scale(1.5); }
        80%, 100% { opacity: 0; transform: scale(2.4); }
      }
    `}</style>
  );
}
