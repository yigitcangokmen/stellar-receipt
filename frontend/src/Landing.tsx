import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/* =====================================================================
   Landing.tsx — Stellar Receipt landing page
   ---------------------------------------------------------------------
   Presentation only. No real wallet, no real RPC.
   The Pay demo uses local setTimeout/setInterval to simulate the flow.
   Wire `onConnect` / `onCreateInvoice` to your real handlers from above.
   ===================================================================== */

interface Props {
  onConnect?: () => void;
  onCreateInvoice?: () => void;
}

type SignPhase = 'idle' | 'review' | 'submitting' | 'done';

const START_LEDGER = 58231904;

export default function Landing({ onConnect, onCreateInvoice }: Props) {
  const navigate = useNavigate();
  const goApp = () => navigate('/app');
  const connect = onConnect ?? goApp;
  const createInvoice = onCreateInvoice ?? goApp;

  // Demo state — wallet sign flow
  const [phase, setPhase] = useState<SignPhase>('idle');
  const [ledger, setLedger] = useState<number>(START_LEDGER);
  const [submitStatus, setSubmitStatus] = useState<string>('Signing transaction...');
  const tickerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tickerRef.current) window.clearInterval(tickerRef.current);
    };
  }, []);

  const startPay = () => phase === 'idle' && setPhase('review');
  const reject = () => setPhase('idle');

  const sign = () => {
    setPhase('submitting');
    setSubmitStatus('Signing transaction...');
    if (tickerRef.current) window.clearInterval(tickerRef.current);
    tickerRef.current = window.setInterval(() => setLedger((n) => n + 1), 200);
    window.setTimeout(() => setSubmitStatus('Submitting to network...'), 600);
    window.setTimeout(() => setSubmitStatus('Waiting for confirmation...'), 1400);
    window.setTimeout(() => {
      if (tickerRef.current) window.clearInterval(tickerRef.current);
      setPhase('done');
    }, 2400);
  };

  const reset = () => {
    if (tickerRef.current) window.clearInterval(tickerRef.current);
    setPhase('idle');
    setLedger(START_LEDGER);
  };

  // Pay button label/colors per phase
  const payLabel =
    phase === 'idle'
      ? 'Pay 1,250 USDC →'
      : phase === 'review'
        ? 'Waiting for wallet...'
        : phase === 'submitting'
          ? 'Submitting...'
          : '✓ Paid · receipt minted';
  const payBg = phase === 'done' ? '#10B981' : phase === 'idle' ? '#FACC15' : '#2A3142';
  const payColor = phase === 'done' ? '#fff' : phase === 'idle' ? '#0A0E1A' : '#9CA3AF';
  const showSpinner = phase === 'review' || phase === 'submitting';

  return (
    <div
      style={{
        background: '#0A0E1A',
        color: '#E4E7EB',
        fontFamily: "'Space Grotesk', sans-serif",
        minHeight: '100vh',
      }}
    >
      <Keyframes />

      {/* Nav */}
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px 64px',
          borderBottom: '1px solid #1E2433',
          position: 'sticky',
          top: 0,
          background: 'rgba(10,14,26,0.85)',
          backdropFilter: 'blur(12px)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo size={32} />
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: '#fff',
              letterSpacing: '-0.02em',
            }}
          >
            Stellar<span style={{ color: '#FACC15' }}>Receipt</span>
          </div>
        </div>
        <button
          onClick={connect}
          style={{
            background: '#FACC15',
            color: '#0A0E1A',
            padding: '10px 20px',
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 6,
            cursor: 'pointer',
            border: 'none',
          }}
        >
          Launch app →
        </button>
      </nav>

      {/* Hero */}
      <section
        style={{
          padding: '120px 64px 100px',
          display: 'grid',
          gridTemplateColumns: '1.05fr 0.95fr',
          gap: 72,
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          maxWidth: 1280,
          margin: '0 auto',
        }}
      >
        <Starfield />

        <div style={{ position: 'relative' }}>
          <h1
            style={{
              fontSize: 96,
              fontWeight: 600,
              color: '#fff',
              lineHeight: 1,
              letterSpacing: '-0.04em',
              marginBottom: 40,
              marginTop: 0,
            }}
          >
            Every receipt,
            <br />
            <span
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontStyle: 'italic',
                fontWeight: 400,
                color: '#FACC15',
              }}
            >
              written in stars.
            </span>
          </h1>
          <p
            style={{
              fontSize: 22,
              color: '#9CA3AF',
              lineHeight: 1.4,
              maxWidth: 460,
              marginBottom: 56,
              fontWeight: 400,
              marginTop: 0,
            }}
          >
            Proof of payment. On Stellar. Forever.
          </p>
          <button
            onClick={createInvoice}
            style={{
              background: '#FACC15',
              color: '#0A0E1A',
              padding: '20px 36px',
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 10,
              cursor: 'pointer',
              border: 'none',
            }}
          >
            Create an invoice →
          </button>
        </div>

        {/* Hero receipt + PAID stamp animation (auto-loops) */}
        <div
          style={{
            position: 'relative',
            minHeight: 480,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <HeroReceipt />
        </div>
      </section>

      {/* Try-it header */}
      <section style={{ padding: '160px 64px 40px', maxWidth: 1280, margin: '0 auto' }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            color: '#FACC15',
            letterSpacing: '0.18em',
            marginBottom: 18,
          }}
        >
          // TRY IT
        </div>
        <h2
          style={{
            fontSize: 72,
            fontWeight: 600,
            color: '#fff',
            letterSpacing: '-0.035em',
            lineHeight: 1,
            margin: 0,
          }}
        >
          Pay something.
          <br />
          <span
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: 'italic',
              fontWeight: 400,
              color: '#FACC15',
            }}
          >
            Then verify it.
          </span>
        </h2>
      </section>

      {/* Wallet sign demo */}
      <section style={{ padding: '56px 64px 80px', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 24 }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: '#FACC15',
              letterSpacing: '0.18em',
            }}
          >
            01
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: '#fff',
              letterSpacing: '0.18em',
            }}
          >
            WALLET SIGN
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: '#6B7280',
            }}
          >
            — click Pay, sign in the wallet, watch the receipt mint
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 32,
            alignItems: 'start',
          }}
        >
          {/* LEFT — invoice */}
          <div
            style={{
              background: '#121826',
              border: '1px solid #1E2433',
              borderRadius: 14,
              padding: 36,
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: '#fff',
                letterSpacing: '-0.02em',
                marginBottom: 4,
              }}
            >
              Logo design — Acme Co.
            </div>
            <div
              style={{
                fontFamily: "'Space Grotesk'",
                fontSize: 48,
                fontWeight: 600,
                color: '#fff',
                letterSpacing: '-0.03em',
                lineHeight: 1,
                margin: '18px 0',
              }}
            >
              1,250 <span style={{ fontSize: 22, color: '#6B7280' }}>USDC</span>
            </div>

            <button
              onClick={startPay}
              style={{
                width: '100%',
                background: payBg,
                color: payColor,
                padding: '16px 26px',
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 8,
                cursor: phase === 'idle' ? 'pointer' : 'default',
                textAlign: 'center',
                marginTop: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                border: 'none',
              }}
            >
              {showSpinner && (
                <span
                  style={{
                    width: 16,
                    height: 16,
                    border: '2px solid rgba(10,14,26,.3)',
                    borderTopColor: '#0A0E1A',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
              )}
              {payLabel}
            </button>

            {phase === 'done' && (
              <div
                style={{
                  marginTop: 18,
                  padding: '14px 16px',
                  background: 'rgba(16,185,129,.06)',
                  border: '1px solid #10B981',
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      color: '#10B981',
                      letterSpacing: '0.15em',
                    }}
                  >
                    ✓ MINTED
                  </div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 12,
                      color: '#fff',
                      marginTop: 4,
                    }}
                  >
                    /receipt/9c14e211b822
                  </div>
                </div>
                <button
                  onClick={reset}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: '#FACC15',
                    cursor: 'pointer',
                    background: 'transparent',
                    border: 'none',
                  }}
                >
                  ↻ replay
                </button>
              </div>
            )}
          </div>

          {/* RIGHT — wallet/receipt stage */}
          <div
            style={{
              background: '#121826',
              border: '1px solid #1E2433',
              borderRadius: 14,
              padding: 24,
              minHeight: 380,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {phase === 'idle' && (
              <div
                style={{
                  textAlign: 'center',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  color: '#6B7280',
                  letterSpacing: '0.15em',
                }}
              >
                ← CLICK "PAY" TO TRIGGER
                <br />
                WALLET POPUP
              </div>
            )}

            {phase === 'review' && <FreighterModal onReject={reject} onSign={sign} />}

            {phase === 'submitting' && (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    border: '3px solid #1E2433',
                    borderTopColor: '#FACC15',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 20px',
                  }}
                />
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 14,
                    color: '#FACC15',
                    letterSpacing: '0.1em',
                  }}
                >
                  {submitStatus}
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: '#6B7280',
                    marginTop: 10,
                  }}
                >
                  Ledger #{ledger.toLocaleString()}
                </div>
              </div>
            )}

            {phase === 'done' && <DoneReceipt ledger={ledger} />}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid #1E2433',
          padding: '32px 64px',
          textAlign: 'center',
          fontSize: 12,
          color: '#6B7280',
        }}
      >
        Built on Stellar.
      </footer>
    </div>
  );
}

/* ===== Sub-components ===== */

function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 84 84" fill="none">
      <rect x="2" y="2" width="80" height="80" rx="18" fill="#FACC15" />
      <path
        d="M24 22 L24 60 L30 56 L36 60 L42 56 L48 60 L54 56 L60 60 L60 22 Z"
        fill="#0A0E1A"
      />
      <rect x="30" y="30" width="24" height="2.5" rx="1.25" fill="#FACC15" />
      <rect x="30" y="38" width="18" height="2.5" rx="1.25" fill="#FACC15" />
      <path
        d="M42 44 L43.6 48.4 L48 48.4 L44.5 51.1 L45.9 55.5 L42 52.8 L38.1 55.5 L39.5 51.1 L36 48.4 L40.4 48.4 Z"
        fill="#FACC15"
      />
    </svg>
  );
}

function Starfield() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage: [
          'radial-gradient(1.2px 1.2px at 15% 25%, rgba(255,255,255,.5) 50%, transparent 50%)',
          'radial-gradient(1px 1px at 60% 18%, rgba(255,255,255,.6) 50%, transparent 50%)',
          'radial-gradient(1.5px 1.5px at 80% 65%, rgba(250,204,21,.7) 50%, transparent 50%)',
          'radial-gradient(1px 1px at 35% 80%, rgba(255,255,255,.4) 50%, transparent 50%)',
          'radial-gradient(1.2px 1.2px at 90% 40%, rgba(56,189,248,.5) 50%, transparent 50%)',
          'radial-gradient(1px 1px at 8% 55%, rgba(255,255,255,.35) 50%, transparent 50%)',
          'radial-gradient(1px 1px at 45% 12%, rgba(250,204,21,.4) 50%, transparent 50%)',
          'radial-gradient(1px 1px at 25% 90%, rgba(56,189,248,.3) 50%, transparent 50%)',
        ].join(', '),
      }}
    />
  );
}

function HeroReceipt() {
  return (
    <div
      className="hero-receipt"
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, #FAFAF7 0%, #F4F4F0 100%)',
        color: '#0A0E1A',
        borderRadius: 14,
        padding: 36,
        boxShadow:
          '0 30px 80px rgba(250,204,21,.18), 0 0 0 1px rgba(250,204,21,.25)',
      }}
    >
      <div style={{ marginBottom: 26 }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: '#6B7280',
            letterSpacing: '0.15em',
          }}
        >
          RECEIPT
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            color: '#0A0E1A',
            marginTop: 4,
          }}
        >
          INV-7a3f9b4c...e91c
        </div>
      </div>

      <div style={{ fontSize: 14, color: '#4B5563', marginBottom: 8 }}>
        Logo design — Acme Co.
      </div>
      <div
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 52,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        1,250 <span style={{ fontSize: 24, color: '#6B7280' }}>USDC</span>
      </div>

      <div
        style={{
          borderTop: '1px dashed #D1D5DB',
          margin: '28px 0',
          paddingTop: 22,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
        }}
      >
        <Field label="FROM" value="GBQH...K3M2" />
        <Field label="TO" value="GA7X...P9LD" />
        <Field label="PAID AT" value="2026-06-25 14:32" />
        <Field label="LEDGER" value="#58,231,904" />
      </div>

      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 8 }}
      >
        <CheckIcon />
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: '#10B981',
          }}
        >
          Verified on Stellar ledger
        </div>
      </div>

      <div
        className="hero-stamp"
        style={{
          position: 'absolute',
          top: '38%',
          right: -28,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 32,
          fontWeight: 700,
          color: '#10B981',
          border: '5px solid #10B981',
          padding: '10px 22px',
          borderRadius: 10,
          letterSpacing: '0.12em',
          background: 'rgba(255,255,255,0.92)',
          textShadow: '0 0 8px rgba(16,185,129,0.15)',
          boxShadow: '0 4px 0 rgba(16,185,129,0.15)',
        }}
      >
        ✓ PAID
      </div>
      <div
        className="hero-stamp-splat"
        style={{
          position: 'absolute',
          top: '50%',
          right: 30,
          width: 180,
          height: 180,
          borderRadius: '50%',
          border: '2px solid #10B981',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: '#9CA3AF', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#0A0E1A' }}>{value}</div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#10B981"
      strokeWidth="2.5"
    >
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

function FreighterModal({
  onReject,
  onSign,
}: {
  onReject: () => void;
  onSign: () => void;
}) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 360,
        background: '#1A1F2E',
        border: '1px solid #2A3142',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,.5)',
      }}
    >
      <div
        style={{
          background: '#FACC15',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0A0E1A"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
          </svg>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              color: '#0A0E1A',
              fontWeight: 700,
              letterSpacing: '0.1em',
            }}
          >
            FREIGHTER
          </div>
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: '#0A0E1A',
          }}
        >
          TESTNET
        </div>
      </div>
      <div style={{ padding: '24px 22px' }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: '#6B7280',
            letterSpacing: '0.15em',
          }}
        >
          REVIEW TRANSACTION
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: '#fff',
            margin: '10px 0',
            letterSpacing: '-0.01em',
          }}
        >
          Sign payment
        </div>
        <div
          style={{
            background: '#0A0E1A',
            borderRadius: 8,
            padding: 16,
            marginTop: 12,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
          }}
        >
          <KV k="to" v="GBQH...K3M2" />
          <KV k="amount" v="1,250 USDC" vColor="#FACC15" />
          <KV k="fee" v="0.00001 XLM" vColor="#10B981" />
          <KV k="memo" v="INV-7a3f9b4c" />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button
            onClick={onReject}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid #2A3142',
              color: '#9CA3AF',
              padding: 12,
              borderRadius: 8,
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Reject
          </button>
          <button
            onClick={onSign}
            style={{
              flex: 1,
              background: '#FACC15',
              border: 'none',
              color: '#0A0E1A',
              padding: 12,
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Sign &amp; submit
          </button>
        </div>
      </div>
    </div>
  );
}

function KV({ k, v, vColor = '#fff' }: { k: string; v: string; vColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
      <span style={{ color: '#6B7280' }}>{k}</span>
      <span style={{ color: vColor }}>{v}</span>
    </div>
  );
}

function DoneReceipt({ ledger }: { ledger: number }) {
  return (
    <div
      style={{
        width: '100%',
        background: 'linear-gradient(180deg, #FAFAF7 0%, #F4F4F0 100%)',
        color: '#0A0E1A',
        borderRadius: 14,
        padding: 28,
        boxShadow:
          '0 30px 60px rgba(16,185,129,.2), 0 0 0 1px rgba(16,185,129,.4)',
        position: 'relative',
        transformOrigin: 'center',
        animation: 'card-in 0.4s ease-out, stamp-shake 1.4s ease-out',
      }}
    >
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: '#6B7280',
          letterSpacing: '0.15em',
        }}
      >
        RECEIPT
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 13,
          color: '#0A0E1A',
          marginTop: 4,
        }}
      >
        INV-7a3f9b4c...e91c
      </div>
      <div style={{ fontSize: 13, color: '#4B5563', margin: '18px 0 6px' }}>
        Logo design — Acme Co.
      </div>
      <div
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 44,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        1,250 <span style={{ fontSize: 20, color: '#6B7280' }}>USDC</span>
      </div>
      <div
        style={{
          borderTop: '1px dashed #D1D5DB',
          margin: '22px 0',
          paddingTop: 18,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
        }}
      >
        <Field label="FROM" value="GA7X...P9LD" />
        <Field label="TO" value="GBQH...K3M2" />
        <Field label="LEDGER" value={`#${ledger.toLocaleString()}`} />
        <div>
          <div style={{ color: '#9CA3AF', marginBottom: 3 }}>STATUS</div>
          <div style={{ color: '#10B981' }}>CONFIRMED</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5">
          <path d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="10" />
        </svg>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: '#10B981',
          }}
        >
          Verified on Stellar ledger
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: '38%',
          right: 60,
          width: 180,
          height: 180,
          borderRadius: '50%',
          border: '2px solid #10B981',
          pointerEvents: 'none',
          animation: 'stamp-splat 1.4s ease-out forwards',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '30%',
          right: -28,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 30,
          fontWeight: 700,
          color: '#10B981',
          border: '5px solid #10B981',
          padding: '8px 20px',
          borderRadius: 10,
          letterSpacing: '0.12em',
          background: 'rgba(255,255,255,0.92)',
          transformOrigin: 'center',
          animation: 'stamp-drop 0.7s cubic-bezier(.5,1.6,.5,1) forwards',
          animationDelay: '0.15s',
          opacity: 0,
          boxShadow: '0 4px 0 rgba(16,185,129,0.15)',
        }}
      >
        ✓ PAID
      </div>
    </div>
  );
}

/* ===== Keyframes — injected once into <head> via a styled tag ===== */
function Keyframes() {
  return (
    <style>{`
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes hero-shake {
        0%, 32%, 40%, 100% { transform: rotate(-1.5deg) translate(0,0); }
        33% { transform: rotate(-1.5deg) translate(-6px, 4px); }
        35% { transform: rotate(-1.5deg) translate(6px, -2px); }
        37% { transform: rotate(-1.5deg) translate(-3px, 1px); }
        39% { transform: rotate(-1.5deg) translate(2px, 0); }
      }
      @keyframes hero-stamp {
        0%, 15% { opacity: 0; transform: translateY(-260px) translateX(40px) rotate(60deg) scale(2.6); }
        32% { opacity: 1; transform: translateY(0) translateX(0) rotate(-8deg) scale(1.18); }
        36% { opacity: 1; transform: translateY(0) translateX(0) rotate(-14deg) scale(0.92); }
        42%, 90% { opacity: 1; transform: translateY(0) translateX(0) rotate(-12deg) scale(1); }
        100% { opacity: 0; transform: translateY(-260px) translateX(40px) rotate(60deg) scale(2.6); }
      }
      @keyframes hero-splat {
        0%, 30% { opacity: 0; transform: translate(-50%,-50%) scale(0.4); }
        34% { opacity: 0.55; transform: translate(-50%,-50%) scale(1.4); }
        44%, 100% { opacity: 0; transform: translate(-50%,-50%) scale(2.4); }
      }
      @keyframes stamp-drop { 0% { transform: translateY(-220px) translateX(30px) rotate(60deg) scale(2.6); opacity: 0; } 55% { transform: translateY(0) translateX(0) rotate(-8deg) scale(1.2); opacity: 1; } 65% { transform: translateY(0) translateX(0) rotate(-14deg) scale(0.9); opacity: 1; } 100% { transform: translateY(0) translateX(0) rotate(-12deg) scale(1); opacity: 1; } }
      @keyframes stamp-shake { 0%, 55%, 100% { transform: rotate(-1deg) translate(0,0); } 58% { transform: rotate(-1deg) translate(-5px, 3px); } 62% { transform: rotate(-1deg) translate(5px, -2px); } 66% { transform: rotate(-1deg) translate(-2px, 1px); } 70% { transform: rotate(-1deg) translate(1px, 0); } }
      @keyframes stamp-splat { 0%, 50% { opacity: 0; transform: translate(-50%,-50%) scale(0.4); } 58% { opacity: 0.55; transform: translate(-50%,-50%) scale(1.5); } 80%, 100% { opacity: 0; transform: translate(-50%,-50%) scale(2.4); } }
      @keyframes card-in { 0% { opacity: 0; transform: rotate(-1deg) translateY(20px) scale(0.95); } 100% { opacity: 1; transform: rotate(-1deg) translateY(0) scale(1); } }
      .hero-receipt { animation: hero-shake 4.5s ease-out infinite; transform: rotate(-1.5deg); transform-origin: center; }
      .hero-stamp { animation: hero-stamp 4.5s cubic-bezier(.5,1.6,.5,1) infinite; transform-origin: center; }
      .hero-stamp-splat { animation: hero-splat 4.5s ease-out infinite; }
    `}</style>
  );
}
