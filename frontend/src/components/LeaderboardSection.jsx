import { useEffect, useState } from 'react'
import { db } from '../config/supabase'
import { UserAvatar } from './UserAvatar'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')



const getUsdcReward = (rank) => {
  if (rank === 1) return { value: '200', type: 'usdc' }
  if (rank === 2) return { value: '150', type: 'usdc' }
  if (rank === 3) return { value: '100', type: 'usdc' }
  if (rank >= 4 && rank <= 10) return { value: '50', type: 'usdc' }
  if (rank >= 11 && rank <= 20) return { value: '30', type: 'usdc' }
  if (rank >= 21 && rank <= 30) return { value: '🎁', type: 'special' }
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
              background: 'linear-gradient(135deg, #0000FF 0%, #3C8AFF 100%)',
              borderRadius: 20,
              padding: '12px 16px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 8px 24px rgba(0,0,255,0.25)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            {/* Left: Rank & User Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              {/* Rank */}
              <div style={{ 
                fontFamily: "'Barlow Condensed', sans-serif", 
                fontSize: 32, 
                fontWeight: 900, 
                lineHeight: 1,
                minWidth: 40,
                textAlign: 'center',
                borderRight: '1px solid rgba(255,255,255,0.2)',
                paddingRight: 10
              }}>
                #{displayRank}
              </div>
              
              {/* User Details */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayEntry?.basename || short(address)}
                </div>
                <div style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: 4, 
                  background: 'rgba(255,255,255,0.15)', 
                  padding: '2px 8px', 
                  borderRadius: 6, 
                  marginTop: 4,
                  fontSize: 10,
                  fontWeight: 700
                }}>
                  ⚡ {(displayEntry?.points ?? 0).toLocaleString()} HP
                </div>
              </div>
            </div>

            {/* Right: Est. Reward Gold/Glass Ticket */}
            {myReward && (
              <div style={{
                background: '#fff',
                color: '#0000FF',
                borderRadius: 14,
                padding: '6px 12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                border: '1px solid rgba(255,255,255,0.5)',
                marginLeft: 12,
                flexShrink: 0
              }}>
                <span style={{ fontSize: 8, fontWeight: 900, color: '#717886', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Est. Reward
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  {myReward.type === 'usdc' ? (
                    <>
                      <img src="/usdc-logo.png" alt="USDC" style={{ width: 14, height: 14, borderRadius: '50%' }} />
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 900, color: '#0000FF', lineHeight: 1 }}>
                        {myReward.value}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: 14, fontWeight: 900, color: '#059669', lineHeight: 1 }}>
                      {myReward.value}
                    </span>
                  )}
                </div>
              </div>
            )}
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
                {/* Unified Rank + Reward Pill */}
                {(() => {
                  const capsuleStyle = (() => {
                    const rank = idx + 1;
                    if (rank >= 1 && rank <= 30) {
                      return { bg: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#fff', border: 'none', shadow: 'none', div: 'rgba(255,255,255,0.25)' }
                    }
                    return { bg: '#F1F5F9', color: '#64748B', border: 'none', shadow: 'none', div: 'transparent' }
                  })();

                  return (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: capsuleStyle.bg,
                      color: capsuleStyle.color,
                      border: capsuleStyle.border,
                      boxShadow: capsuleStyle.shadow,
                      borderRadius: 12,
                      padding: '4px 6px',
                      gap: 6,
                      minHeight: 28,
                      width: 84, // Uniform fixed width for perfect vertical alignment
                      flexShrink: 0
                    }}>
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: 14,
                        fontWeight: 900,
                        letterSpacing: '-0.3px'
                      }}>
                        #{idx + 1}
                      </span>
                      
                      {reward && (
                        <>
                          <div style={{ width: 1, height: 12, background: capsuleStyle.div }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {reward.type === 'usdc' ? (
                              <>
                                <img src="/usdc-logo.png" alt="" style={{ width: 13, height: 13, borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                <span style={{
                                  fontFamily: "'Barlow Condensed', sans-serif",
                                  fontSize: 13,
                                  fontWeight: 900,
                                  letterSpacing: '-0.2px'
                                }}>
                                  {reward.value}
                                </span>
                              </>
                            ) : (
                              <span style={{
                                fontSize: 10,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.2px'
                              }}>
                                {reward.value}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}

                <div style={{ position: 'relative', flexShrink: 0, marginLeft: 2 }}>
                  <UserAvatar address={entry.address} size={28} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#0A0B0D',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.basename || short(entry.address)}
                    </span>
                    {address && entry.address?.toLowerCase() === address.toLowerCase() && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: '#0000FF',
                        background: 'rgba(0,0,255,0.06)',
                        padding: '1px 6px',
                        borderRadius: 6,
                        flexShrink: 0
                      }}>
                        (you)
                      </span>
                    )}
                  </div>
                </div>

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
