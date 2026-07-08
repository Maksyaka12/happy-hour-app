import { useState, useEffect, useMemo } from 'react'
import { UserAvatar } from './UserAvatar'
import { db } from '../config/supabase'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

export function AccountPage({ address, basename }) {
  const [userStats, setUserStats] = useState({
    referral_count: 0,
    referral_points: 0,
    ref_code: null
  })

  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => {
    if (!address) return;
    const fetchUserStats = async () => {
      try {
        const { data, error } = await db
          .from('users')
          .select('referral_count, referral_points, ref_code')
          .eq('address', address.toLowerCase())
          .single()
        
        if (data) {
          setUserStats(data)
        }
      } catch (err) {
        console.error("Error fetching user stats in AccountPage:", err)
      }
    }
    fetchUserStats()
  }, [address])

  const referralLink = useMemo(() => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://happyhour.bot'
    return userStats.ref_code
      ? `${baseUrl}/r?ref=${userStats.ref_code}`
      : `${baseUrl}/r?ref=${address}`
  }, [address, userStats.ref_code])

  const displayName = basename || short(address)

  return (
    <div style={{
      width: '100%',
      maxWidth: 600,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 32,
      animation: 'fadeIn 0.3s ease',
      color: '#FFFFFF'
    }}>
      {/* Header Profile Section */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <h1 style={{
          fontSize: 24,
          fontWeight: 800,
          margin: 0,
          fontFamily: "'Outfit', 'Inter', sans-serif",
          alignSelf: 'flex-start',
          marginBottom: 16
        }}>
          Account
        </h1>

        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'rgba(255, 255, 255, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
        }}>
          <UserAvatar address={address} size={80} />
        </div>

        <div style={{
          fontSize: 16,
          fontWeight: 600,
          color: '#FFFFFF'
        }}>
          {displayName}
        </div>
      </div>

      {/* Referral Hub Section */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 20,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC' }}>Referral link</div>
        </div>
        <div style={{ fontSize: 14, color: '#94A3B8' }}>
          Share your link — every friend who joins boosts your HP by 30%.
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: 12,
          padding: '12px 16px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ fontSize: 14, fontFamily: 'monospace', color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 16 }}>
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
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94A3B8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              transition: 'color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#FFFFFF'}
            onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
          >
            {linkCopied ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            )}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 20,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          <div style={{ fontSize: 14, color: '#94A3B8', fontWeight: 600 }}>Total Referrals</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
            {userStats.referral_count}
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 20,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          <div style={{ fontSize: 14, color: '#94A3B8', fontWeight: 600 }}>HP Earned</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
            {userStats.referral_points}
          </div>
        </div>
      </div>

    </div>
  )
}
