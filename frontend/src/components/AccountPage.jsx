import { useState, useEffect, useMemo } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { UserAvatar } from './UserAvatar'
import { db } from '../config/supabase'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

function LinkedAccountRow({ icon, label, value, linked, onLink, onUnlink, canUnlink = true, isLast = false }) {
  const [loading, setLoading] = useState(false)

  const handleAction = async () => {
    if (loading) return
    setLoading(true)
    try {
      if (linked) { if (onUnlink) await onUnlink() }
      else { if (onLink) await onLink() }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', background: linked ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: linked ? '#3B82F6' : '#94A3B8', flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: linked ? '#FFFFFF' : '#94A3B8' }}>{label}</div>
          {value && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{value}</div>}
        </div>
      </div>
      {(onLink || onUnlink) && (
        <button
          onClick={handleAction}
          disabled={loading || (linked && !canUnlink)}
          style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', border: '1px solid', borderColor: linked ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.4)', background: linked ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)', color: linked ? '#EF4444' : '#3B82F6', opacity: (loading || (linked && !canUnlink)) ? 0.5 : 1 }}
        >
          {loading ? '…' : linked ? 'Unlink' : 'Link'}
        </button>
      )}
    </div>
  )
}

export function AccountPage({ address, basename, privyUser }) {
  const { linkWallet, unlinkWallet, linkEmail, unlinkEmail, linkTwitter, unlinkTwitter, linkTelegram, unlinkTelegram } = usePrivy()

  const [userStats, setUserStats] = useState({ referral_count: 0, referral_points: 0, ref_code: null })
  const [linkCopied, setLinkCopied] = useState(false)

  const linkedWallets = privyUser?.linkedAccounts?.filter(a => a.type === 'wallet') || []
  // Separate embedded (Privy-managed) from external (MetaMask, Coinbase, etc.)
  const embeddedWallets = linkedWallets.filter(a => a.walletClientType === 'privy' || a.connectorType === 'embedded')
  const externalWallets = linkedWallets.filter(a => a.walletClientType !== 'privy' && a.connectorType !== 'embedded')
  // Only show one embedded wallet (the most recent one) to avoid confusion from duplicates
  const primaryEmbedded = embeddedWallets.slice(-1)

  const linkedEmail = privyUser?.linkedAccounts?.find(a => a.type === 'email')
  const linkedTwitter = privyUser?.linkedAccounts?.find(a => a.type === 'twitter_oauth')
  const linkedTelegram = privyUser?.linkedAccounts?.find(a => a.type === 'telegram')
  const linkedAccountsCount = [linkedEmail, linkedTwitter, linkedTelegram, ...linkedWallets].filter(Boolean).length

  useEffect(() => {
    if (!address) return
    const fetchUserStats = async () => {
      try {
        const { data } = await db.from('users').select('referral_count, referral_points, ref_code').eq('address', address.toLowerCase()).single()
        if (data) setUserStats(data)
      } catch (err) { console.error('Error fetching user stats:', err) }
    }
    fetchUserStats()
  }, [address])

  const referralLink = useMemo(() => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://happyhour.bot'
    return userStats.ref_code ? `${baseUrl}/r?ref=${userStats.ref_code}` : `${baseUrl}/r?ref=${address}`
  }, [address, userStats.ref_code])

  const displayName = linkedTwitter?.username ? `@${linkedTwitter.username}` : linkedEmail?.address ? linkedEmail.address : basename || short(address)

  return (
    <div style={{ width: '100%', maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.3s ease', color: '#FFFFFF' }}>

      {/* Avatar + Name */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          <UserAvatar address={address} size={80} profilePictureUrl={privyUser?.twitter?.profilePictureUrl} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#FFFFFF' }}>{displayName}</div>
      </div>

      {/* Wallets */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC', marginBottom: 4 }}>Wallets</div>
        <div style={{ fontSize: 13, color: '#94A3B8' }}>
          Manage your account wallets.
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '20px 0' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Embedded Wallet — always exactly 1 */}
          {primaryEmbedded.length > 0 ? primaryEmbedded.map(w => (
            <LinkedAccountRow
              key={w.address}
              icon={<img src="/logo.jfif" alt="HH" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              label="HH Embedded Wallet"
              value={short(w.address)}
              linked={true}
              canUnlink={false}
            />
          )) : (
            <LinkedAccountRow
              icon={<img src="/logo.jfif" alt="HH" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              label="HH Embedded Wallet"
              value="Creating…"
              linked={false}
            />
          )}

          {/* External Wallets (MetaMask, Coinbase, etc.) */}
          {externalWallets.length > 0 ? externalWallets.map((w, i) => (
            <LinkedAccountRow
              key={w.address}
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>}
              label="External Wallet"
              value={short(w.address)}
              linked={true}
              isLast={i === externalWallets.length - 1}
            />
          )) : (
            <LinkedAccountRow
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>}
              label="External Wallet"
              value={null}
              linked={false}
              onLink={linkWallet}
              isLast={true}
            />
          )}
        </div>
      </div>

      {/* Backup Email */}
      {linkedEmail && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC' }}>Your backup email</div>
          </div>
          <div style={{ fontSize: 14, color: '#94A3B8', marginTop: 4 }}>
            {linkedEmail.address}
          </div>
        </div>
      )}


      {/* Referral Hub */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC' }}>Referral link</div>
        </div>
        <div style={{ fontSize: 14, color: '#94A3B8' }}>
          Share your link — earn 30% of all HP from every friend who joins.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 16px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 13, fontFamily: 'monospace', color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 12 }}>
            {referralLink}
          </div>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(referralLink)
                setLinkCopied(true)
                setTimeout(() => setLinkCopied(false), 2000)
              } catch {}
            }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center', padding: 4 }}
          >
            {linkCopied
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            }
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 14, color: '#94A3B8', fontWeight: 600 }}>Total Referrals</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF' }}>{userStats.referral_count}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 14, color: '#94A3B8', fontWeight: 600 }}>HP Earned</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF' }}>{userStats.referral_points}</div>
        </div>
      </div>

    </div>
  )
}
