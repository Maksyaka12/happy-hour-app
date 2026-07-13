import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { UserAvatar } from './UserAvatar'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

const SPIN_CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  .acc-toggle {
    position: relative; width: 44px; height: 24px;
    background: rgba(255,255,255,0.1); border-radius: 12px;
    cursor: pointer; transition: background 0.3s ease; flex-shrink: 0;
  }
  .acc-toggle.active { background: #16A34A; }
  .acc-toggle-knob {
    position: absolute; top: 2px; left: 2px;
    width: 20px; height: 20px; background: #FFFFFF;
    border-radius: 50%; transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  .acc-toggle.active .acc-toggle-knob { transform: translateX(20px); }
  .acc-toggle.disabled { opacity: 0.5; cursor: not-allowed; }
`

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
      <line x1="12" y1="2" x2="12" y2="6"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
      <line x1="2" y1="12" x2="6" y2="12"/>
      <line x1="18" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
      <line x1="16.24" y1="4.93" x2="19.07" y2="7.76"/>
    </svg>
  )
}

function AccountRow({ icon, label, subLabel, linked, loading, onToggle, canUnlink = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {icon}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#FFFFFF', lineHeight: 1 }}>{label}</div>
            {linked && (
              <div style={{ background: 'rgba(22,163,74,0.15)', color: '#16A34A', padding: '0 6px', height: 16, display: 'flex', alignItems: 'center', borderRadius: 4, fontSize: 11, fontWeight: 600, border: '1px solid rgba(22,163,74,0.3)' }}>
                Linked
              </div>
            )}
          </div>
          <div style={{ fontSize: 13, color: linked ? '#94A3B8' : '#64748B', marginTop: 2 }}>
            {linked ? subLabel : 'Not linked'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {loading && <Spinner />}
        <div
          className={`acc-toggle ${linked ? 'active' : ''} ${(loading || (linked && !canUnlink)) ? 'disabled' : ''}`}
          onClick={!loading && !(linked && !canUnlink) ? onToggle : undefined}
        >
          <div className="acc-toggle-knob" />
        </div>
      </div>
    </div>
  )
}

const XIcon = () => (
  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  </div>
)

const TGIcon = () => (
  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#2AABEE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.12.03-1.99 1.26-5.61 3.71-.53.37-1.01.55-1.44.54-.48-.01-1.39-.27-2.07-.49-.83-.27-1.49-.41-1.43-.87.03-.24.36-.49.98-.75 3.84-1.67 6.4-2.77 7.68-3.3 3.65-1.51 4.41-1.78 4.9-1.79.11 0 .36.03.52.16.14.11.18.26.19.37.01.07.02.24.01.35z"/>
    </svg>
  </div>
)

const EmailIcon = () => (
  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    <img src="/gmail_logo.webp" alt="Gmail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  </div>
)

export function AccountSection({ address, onRequireWallet }) {
  const {
    user: privyUser,
    linkTwitter, unlinkTwitter,
    linkTelegram, unlinkTelegram,
    linkEmail, unlinkEmail,
  } = usePrivy()

  const [loadingX, setLoadingX] = useState(false)
  const [loadingTg, setLoadingTg] = useState(false)
  const [loadingEmail, setLoadingEmail] = useState(false)

  const [unlinkConfirm, setUnlinkConfirm] = useState(null)

  const linkedTwitter = privyUser?.linkedAccounts?.find(a => a.type === 'twitter_oauth')
  const linkedTelegram = privyUser?.linkedAccounts?.find(a => a.type === 'telegram')
  const linkedEmail = privyUser?.linkedAccounts?.find(a => a.type === 'email')

  const linkedCount = [linkedTwitter, linkedTelegram, linkedEmail,
    ...(privyUser?.linkedAccounts?.filter(a => a.type === 'wallet') || [])
  ].filter(Boolean).length

  const wrap = async (setLoading, fn) => {
    setLoading(true)
    try { await fn() } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const handleToggleX = () => {
    if (!privyUser) { onRequireWallet?.(); return }
    if (linkedTwitter) {
      setUnlinkConfirm({ type: 'X (Twitter)', action: () => wrap(setLoadingX, () => unlinkTwitter(linkedTwitter.subject)) })
    } else {
      wrap(setLoadingX, () => linkTwitter())
    }
  }

  const handleToggleTg = () => {
    if (!privyUser) { onRequireWallet?.(); return }
    if (linkedTelegram) {
      setUnlinkConfirm({ type: 'Telegram', action: () => wrap(setLoadingTg, () => unlinkTelegram(linkedTelegram.telegramUserId)) })
    } else {
      wrap(setLoadingTg, () => linkTelegram())
    }
  }

  const handleToggleEmail = () => {
    if (!privyUser) { onRequireWallet?.(); return }
    if (linkedEmail) {
      setUnlinkConfirm({ type: 'Email', action: () => wrap(setLoadingEmail, () => unlinkEmail(linkedEmail.address)) })
    } else {
      wrap(setLoadingEmail, () => linkEmail())
    }
  }

  const displayName = linkedTwitter?.username ? `@${linkedTwitter.username}` : linkedEmail?.address ? linkedEmail.address : short(address)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.3s ease', color: '#FFFFFF' }}>
      <style>{SPIN_CSS}</style>

      {/* Avatar + Name */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          <UserAvatar address={address} size={80} profilePictureUrl={linkedTwitter?.profilePictureUrl} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#FFFFFF' }}>{displayName}</div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#F8FAFC' }}>Linked accounts</h2>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>Manage your linked social accounts</div>
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* X (Twitter) */}
          <AccountRow
            icon={<XIcon />}
            label="X (Twitter)"
            subLabel={linkedTwitter?.username ? `@${linkedTwitter.username}` : 'Connected'}
            linked={!!linkedTwitter}
            loading={loadingX}
            canUnlink={linkedCount > 1}
            onToggle={handleToggleX}
          />

          {/* Telegram */}
          <AccountRow
            icon={<TGIcon />}
            label="Telegram"
            subLabel={linkedTelegram?.username
              ? `@${linkedTelegram.username}`
              : linkedTelegram?.firstName
              ? linkedTelegram.firstName
              : 'Connected'}
            linked={!!linkedTelegram}
            loading={loadingTg}
            canUnlink={linkedCount > 1}
            onToggle={handleToggleTg}
          />

          {/* Email */}
          <AccountRow
            icon={<EmailIcon />}
            label="Email"
            subLabel={linkedEmail?.address || 'Connected'}
            linked={!!linkedEmail}
            loading={loadingEmail}
            canUnlink={linkedCount > 1}
            onToggle={handleToggleEmail}
          />
        </div>
      </div>

      {/* Confirmation Modal */}
      {unlinkConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }} onClick={() => setUnlinkConfirm(null)} />
          <div style={{ position: 'relative', background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.2s ease', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', margin: 0 }}>Unlink {unlinkConfirm.type}?</h3>
            <div style={{ fontSize: 15, color: '#94A3B8', lineHeight: 1.5 }}>
              Are you sure you want to unlink your {unlinkConfirm.type} account?
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setUnlinkConfirm(null)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.05)', color: '#FFFFFF', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  unlinkConfirm.action()
                  setUnlinkConfirm(null)
                }}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: '#EF4444', color: '#FFFFFF', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
              >
                Unlink
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
