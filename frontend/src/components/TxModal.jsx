// src/components/TxModal.jsx
import { createPortal } from 'react-dom'

export function TxModal({ title, subtitle, amount, currency = 'USDC', isPending, isConfirming, isSuccess, error, onConfirm, onCancel }) {
  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(10,11,13,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        width: '100%', maxWidth: 480, background: '#fff',
        borderRadius: '24px 24px 0 0',
        border: '1px solid #DEE1E7', borderBottom: 'none',
        padding: '20px 22px 40px',
        animation: 'slideUp 0.24s cubic-bezier(0.22,1,0.36,1)',
        boxShadow: '0 -8px 40px rgba(10,11,13,0.12)',
      }}>
        {/* Drag handle */}
        <div style={{ width: 36, height: 4, background: '#DEE1E7', borderRadius: 2, margin: '0 auto 20px' }} />

        {isSuccess ? (
          <div style={{ textAlign: 'center', padding: '16px 0 24px' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: '#D1FAE5',
              margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, border: '2px solid #059669',
            }}>✓</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, color: '#0A0B0D' }}>Confirmed!</div>
            <div style={{ color: '#717886', fontSize: 14 }}>You're in the raffle · Good luck 🍀</div>
          </div>
        ) : (isPending || isConfirming) ? (
          <div style={{ textAlign: 'center', padding: '16px 0 24px' }}>
            <div style={{
              width: 44, height: 44, border: '3px solid #0000FF', borderTopColor: 'transparent',
              borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px',
            }} />
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: '#0A0B0D' }}>
              {isPending ? 'Confirm in wallet…' : 'Confirming on Base…'}
            </div>
            <div style={{ color: '#717886', fontSize: 13 }}>
              {isPending ? 'Check your wallet' : 'Waiting for confirmation'}
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Close Button at top-right */}
            <button
              onClick={onCancel}
              style={{
                position: 'absolute', top: -10, right: 0,
                background: '#F1F3F7', border: 'none', borderRadius: '50%',
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#717886', fontSize: 18, zIndex: 10,
              }}
            >
              ✕
            </button>

            <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 4, color: '#0A0B0D' }}>{title}</div>
            {subtitle && <div style={{ color: '#717886', fontSize: 13, marginBottom: 20 }}>{subtitle}</div>}

            <div style={{
              background: '#F0F5FF', border: '1px solid rgba(0,0,255,0.15)',
              borderRadius: 16, padding: '18px 20px', marginBottom: 20,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ color: '#717886', fontSize: 13 }}>Amount</span>
                <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 32, fontWeight: 900, color: '#0000FF' }}>
                  {amount} <span style={{ fontSize: 18 }}>{currency}</span>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#717886', fontSize: 13 }}>Network</span>
                <span style={{ color: '#0000FF', fontSize: 13, fontWeight: 700 }}>Base Mainnet</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ color: '#717886', fontSize: 13 }}>To</span>
                <span style={{ color: '#32353D', fontSize: 13, fontFamily: "'DM Mono',monospace" }}>
                  {`${String(typeof window !== 'undefined' ? '' : '').slice(0,0)}Happy Hour pool`}
                </span>
              </div>
            </div>

            <button
              onClick={onConfirm}
              style={{
                width: '100%', background: '#0000FF', color: '#fff',
                borderRadius: 50, padding: '15px', fontSize: 15, fontWeight: 700,
                marginBottom: 10, boxShadow: '0 6px 20px rgba(0,0,255,0.3)',
                border: 'none', cursor: 'pointer',
              }}
            >
              Confirm Transaction
            </button>

            {error && (
              <div style={{
                background: '#FEE2E2', border: '1px solid #FC401F',
                borderRadius: 12, padding: '10px 14px', marginBottom: 10,
                fontSize: 13, color: '#FC401F', textAlign: 'center',
              }}>
                {error.message?.includes('rejected') || error.message?.includes('denied')
                  ? 'Transaction cancelled'
                  : error.shortMessage || error.message || 'Transaction failed'
                }
              </div>
            )}

            <button
              onClick={onCancel}
              style={{
                width: '100%', background: 'transparent', color: '#717886',
                borderRadius: 50, padding: '12px', fontSize: 14, fontWeight: 500,
                border: 'none', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
