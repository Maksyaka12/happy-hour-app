import { useEffect, useState } from 'react'
import { db } from '../config/supabase'
import { UserAvatar } from './UserAvatar'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

const UsdcIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <circle cx="12" cy="12" r="12" fill="#2775CA" />
    <path d="M12 4v16M8 8h6.5a2.5 2.5 0 0 1 0 5H9.5a2.5 2.5 0 0 0 0 5H16" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const getUsdcReward = (rank) => {
  if (rank === 1) return { value: '200', type: 'usdc' }
  if (rank === 2) return { value: '150', type: 'usdc' }
  if (rank === 3) return { value: '100', type: 'usdc' }
  if (rank >= 4 && rank <= 10) return { value: '50', type: 'usdc' }
  if (rank >= 11 && rank <= 20) return { value: '30', type: 'usdc' }
  if (rank >= 21 && rank <= 30) return { value: 'Consolation 🎁', type: 'special' }
  return null
}

export function LeaderboardSection({ address }) {
  const [leaders, setLeaders] = useState([])
  const [loading, setLoading] = useState(true)
  const [outsideRank, setOutsideRank] = useState(null)

  useEffect(() => {
    if (!address) return
    let alive = true

    const loadLeaders = async () => {
      // Load top 50
      const { data, error } = await db
        .from('users')
        .select('address, basename, points, wins, entries')
        .order('points', { ascending: false })
        .limit(50)

      if (error) {
        console.error('loadLeaders:', error)
        return
      }

      if (alive) {
        setLeaders(data ?? [])

        const inTopIndex = (data ?? []).findIndex(u => u.address?.toLowerCase() === address?.toLowerCase())
        if (inTopIndex === -1) {
          // User not in top 50 — fetch their exact rank
          const { data: myData } = await db
            .from('users')
            .select('points, basename')
            .eq('address', address.toLowerCase())
            .single()

          if (myData && alive) {
            const { count } = await db
              .from('users')
              .select('*', { count: 'exact', head: true })
              .gt('points', myData.points)
            setOutsideRank({ rank: (count || 0) + 1, points: myData.points, basename: myData.basename })
          }
        } else {
          setOutsideRank(null)
        }

        setLoading(false)
      }
    }

    loadLeaders()

    const channel = db
      .channel('leaderboard-users-season')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, loadLeaders)
      .subscribe()

    return () => {
      alive = false
      db.removeChannel(channel)
    }
  }, [address])

  const myRank = leaders.findIndex((u) => u.address?.toLowerCase() === address?.toLowerCase()) + 1
  const myEntry = leaders.find((u) => u.address?.toLowerCase() === address?.toLowerCase())
  const displayRank = myRank > 0 ? myRank : outsideRank?.rank
  const displayEntry = myRank > 0 ? myEntry : outsideRank

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px 20px', color: '#717886' }}>Loading…</div>
  }

  return (
    <div style={{ paddingBottom: 120, padding: '0 12px 120px' }}>
      {/* Season 1 Banner */}
      <div style={{
        backgroundImage: 'url(/banner.jpg)',
        backgroundColor: '#0000FF', // Fallback
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: 24,
        padding: '32px 20px',
        marginBottom: 16,
        position: 'relative',
        minHeight: 140,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 0 }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', paddingTop: 0, paddingBottom: 20 }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 52,
            fontWeight: 900,
            color: '#fff',
            lineHeight: 1,
            textShadow: '0 4px 15px rgba(0,0,0,0.6)',
            marginBottom: 12,
            letterSpacing: '-1px'
          }}>
            SEASON 1
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(10px)',
            borderRadius: 50,
            padding: '6px 20px',
            fontSize: 11,
            fontWeight: 800,
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)',
            display: 'inline-block',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
          }}>
            🏆 TOP USERS WILL GET USDC REWARDS
          </div>
        </div>

        {/* Distinct Footer for Season End Info - UPDATED */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(12px)',
          padding: '8px 0',
          textAlign: 'center',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          zIndex: 2
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 800,
            color: 'rgba(255,255,255,0.7)',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            Ends in: <span style={{ color: '#F4C81B', fontWeight: 900 }}>Countdown Coming Soon</span>
          </div>
        </div>
      </div>

      {/* User Rank Card */}
      {displayRank > 0 && (() => {
        const myReward = getUsdcReward(displayRank);
        return (
          <div
            style={{
              background: 'linear-gradient(135deg,#0000FF,#3C8AFF)',
              borderRadius: 18,
              padding: '10px 16px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              boxShadow: '0 6px 20px rgba(0,0,255,0.25)',
              color: '#fff'
            }}
          >
            <div style={{ 
              fontFamily: "'Barlow Condensed', sans-serif", 
              fontSize: 28, 
              fontWeight: 900, 
              lineHeight: 1,
              minWidth: 38 
            }}>
              #{displayRank}
            </div>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Labels Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.3px', flex: '1 1 0', textAlign: 'left' }}>Your Position</div>
                {myReward && <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.3px', flex: '1 1 0', textAlign: 'center' }}>Est. Reward</div>}
                <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.3px', flex: '1 1 0', textAlign: 'right' }}>Current HP</div>
              </div>
              
              {/* Values Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 0', textAlign: 'left' }}>
                  {displayEntry?.basename || short(address)}
                </div>
                {myReward && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', flex: '1 1 0', transform: 'translateY(1px)' }}>
                    {myReward.type === 'usdc' ? (
                      <>
                        <UsdcIcon size={12} />
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 900, color: '#fff' }}>
                          {myReward.value}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 800, color: '#FFD93D' }}>
                        {myReward.value}
                      </span>
                    )}
                  </div>
                )}
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 900, flex: '1 1 0', textAlign: 'right' }}>
                  {(displayEntry?.points ?? 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Leaders List */}
      {leaders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#EEF0F3', borderRadius: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏆</div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 900, color: '#0A0B0D', marginBottom: 6 }}>No players yet</div>
          <div style={{ fontSize: 13, color: '#717886' }}>Be the first to play!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {leaders.map((entry, idx) => {
            const reward = getUsdcReward(idx + 1)
            return (
              <div
                key={entry.address}
                style={{
                  background: '#fff',
                  border: '1px solid #DEE1E7',
                  borderRadius: 14,
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  boxShadow: '0 2px 6px rgba(10,11,13,0.02)',
                }}
              >
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 14,
                  fontWeight: 900,
                  color: '#32353D',
                  minWidth: 24,
                  textAlign: 'center'
                }}>
                  {idx + 1}
                </div>

                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <UserAvatar address={entry.address} size={28} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#0A0B0D',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {entry.basename || short(entry.address)}
                  </div>
                </div>

                {/* USDC Reward Badge */}
                {reward && (
                  <div style={{
                    background: reward.type === 'usdc' ? 'rgba(39, 117, 202, 0.06)' : 'rgba(16, 185, 129, 0.06)',
                    border: reward.type === 'usdc' ? '1px solid rgba(39, 117, 202, 0.18)' : '1px solid rgba(16, 185, 129, 0.18)',
                    borderRadius: 10,
                    padding: '4px 10px',
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    flexShrink: 0
                  }}>
                    {reward.type === 'usdc' ? (
                      <>
                        <UsdcIcon size={12} />
                        <span style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: 13,
                          fontWeight: 900,
                          color: '#2775CA',
                          letterSpacing: '-0.2px'
                        }}>
                          {reward.value}
                        </span>
                      </>
                    ) : (
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: 11,
                        fontWeight: 800,
                        color: '#059669',
                        letterSpacing: '-0.1px'
                      }}>
                        {reward.value}
                      </span>
                    )}
                  </div>
                )}

                {/* Points Badge */}
                <div style={{
                  background: '#F8F9FC',
                  border: '1px solid #DEE1E7',
                  borderRadius: 10,
                  width: 70, 
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 14,
                    fontWeight: 800,
                    color: '#32353D'
                  }}>
                    {entry.points.toLocaleString()}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
