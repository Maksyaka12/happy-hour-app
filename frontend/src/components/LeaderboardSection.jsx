import { useEffect, useState } from 'react'
import { db } from '../config/supabase'
import { UserAvatar } from './UserAvatar'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

const calculateSeasonTimeLeft = () => {
  // Target date: June 19, 2026 at 10:00:00 UTC (exactly 21 days from May 29, 2026)
  // Month index 5 is June
  const target = new Date(Date.UTC(2026, 5, 19, 10, 0, 0))
  const now = new Date()
  const diff = target.getTime() - now.getTime()
  
  if (isNaN(diff) || diff <= 0) return '00d 00h 00m 00s'
  
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  
  return `${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
}


const getUsdcReward = (rank) => {
  if (rank === 1) return { value: '200', type: 'usdc' }
  if (rank === 2) return { value: '150', type: 'usdc' }
  if (rank === 3) return { value: '100', type: 'usdc' }
  if (rank >= 4 && rank <= 10) return { value: '50', type: 'usdc' }
  if (rank >= 11 && rank <= 20) return { value: '30', type: 'usdc' }
  if (rank >= 21 && rank <= 30) return { value: '🎁', type: 'usdc' }
  return null
}

export function LeaderboardSection({ address }) {
  const [leaders, setLeaders] = useState([])
  const [loading, setLoading] = useState(true)
  const [outsideRank, setOutsideRank] = useState(null)
  const [seasonTimeLeft, setSeasonTimeLeft] = useState(calculateSeasonTimeLeft())

  useEffect(() => {
    const timer = setInterval(() => {
      setSeasonTimeLeft(calculateSeasonTimeLeft())
    }, 1000)
    return () => clearInterval(timer)
  }, [])


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
        minHeight: 160,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 0 }} />

        {/* Floating trophy background decorations */}
        {[
          { top: -10, right: '8%', size: 54, opacity: 0.14, r: '-12deg', blur: 0.5, dur: 4.2 },
          { top: 45, right: '18%', size: 32, opacity: 0.11, r: '14deg', blur: 0, dur: 4.8 },
          { top: -20, left: '12%', size: 48, opacity: 0.12, r: '22deg', blur: 1, dur: 5.4 },
          { bottom: -8, left: '26%', size: 40, opacity: 0.13, r: '-15deg', blur: 0.8, dur: 4.0 },
          { bottom: 10, right: '3%', size: 62, opacity: 0.16, r: '8deg', blur: 1.2, dur: 4.6 }
        ].map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: s.top,
            right: s.right,
            left: s.left,
            bottom: s.bottom,
            zIndex: 1,
            pointerEvents: 'none',
            userSelect: 'none',
            animation: `seasonalTrophyFloat ${s.dur}s ease-in-out infinite`,
          }}>
            <div style={{
              fontSize: `${s.size}px`,
              opacity: s.opacity,
              filter: s.blur > 0 ? `blur(${s.blur}px) drop-shadow(0 0 10px rgba(60,138,255,0.25))` : 'drop-shadow(0 0 10px rgba(60,138,255,0.25))',
              transform: `rotate(${s.r})`,
            }}>
              🏆
            </div>
          </div>
        ))}

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes seasonalTrophyFloat {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
            100% { transform: translateY(0px); }
          }
        ` }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', paddingTop: 0, paddingBottom: 32 }}>
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
            padding: '4px 12px',
            fontSize: 9,
            fontWeight: 800,
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)',
            display: 'inline-block',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
          }}>
            🏆 TOP-30 USERS WILL GET USDC REWARDS
          </div>
        </div>

        {/* Distinct Footer for Season End Info - UPDATED */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(12px)',
          padding: '8px 0',
          textAlign: 'center',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          zIndex: 2
        }}>
          <div style={{
            fontSize: 12,
            fontWeight: 800,
            color: 'rgba(255,255,255,0.75)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}>
            <span>DISTRIBUTE IN:</span>
            <span style={{ 
              color: '#3C8AFF', 
              textShadow: '0 0 10px rgba(60,138,255,0.4)',
              background: 'rgba(60,138,255,0.1)',
              padding: '1px 6px',
              borderRadius: 6,
              border: '1px solid rgba(60,138,255,0.2)',
              fontWeight: 900, 
              fontFamily: "'DM Mono', monospace",
              fontSize: 13,
              letterSpacing: '0.5px'
            }}>{seasonTimeLeft}</span>
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
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.75)',
                  letterSpacing: '0.3px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {displayEntry?.basename || short(address)}
                </div>
                <div style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#fff',
                  lineHeight: 1.2
                }}>
                  {(displayEntry?.points ?? 0).toLocaleString()} HP
                </div>
              </div>
            </div>

            {/* Right: Est. Reward or Reach Top 30 Badge */}
            {myReward ? (
              <div style={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: '#fff',
                borderRadius: 14,
                padding: '6px 12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                marginLeft: 12,
                flexShrink: 0,
                boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
              }}>
                <span style={{ 
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: 8, 
                  fontWeight: 700, 
                  color: 'rgba(255, 255, 255, 0.75)', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.6px' 
                }}>
                  Est. Reward
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  {myReward.type === 'usdc' ? (
                    <>
                      <span style={{ 
                        fontFamily: "'Montserrat', sans-serif", 
                        fontSize: 14, 
                        fontWeight: 700, 
                        color: '#fff', 
                        lineHeight: 1 
                      }}>
                        {myReward.value}
                      </span>
                      <img src="/usdc-logo.png" alt="USDC" style={{ width: 14, height: 14, borderRadius: '50%' }} />
                    </>
                  ) : (
                    <span style={{ 
                      fontFamily: "'Montserrat', sans-serif", 
                      fontSize: 13, 
                      fontWeight: 700, 
                      color: '#FFF', 
                      lineHeight: 1 
                    }}>
                      {myReward.value}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: '#fff',
                borderRadius: 14,
                padding: '8px 12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                marginLeft: 12,
                flexShrink: 0,
                boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                maxWidth: 130,
                textAlign: 'center'
              }}>
                <span style={{ 
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: 8, 
                  fontWeight: 800, 
                  color: '#FFE4E6',
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  lineHeight: 1.2
                }}>
                  REACH TOP 30
                </span>
                <span style={{ 
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: 7.5, 
                  fontWeight: 600, 
                  color: 'rgba(255, 255, 255, 0.85)', 
                  marginTop: 2,
                  letterSpacing: '0.2px',
                  lineHeight: 1.1
                }}>
                  To Get Rewards
                </span>
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
                        fontFamily: "'Montserrat', sans-serif",
                        fontSize: 13,
                        fontWeight: 600,
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
                                <span style={{
                                  fontFamily: "'Montserrat', sans-serif",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  letterSpacing: '-0.2px'
                                }}>
                                  {reward.value}
                                </span>
                                <img src="/usdc-logo.png" alt="" style={{ width: 13, height: 13, borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                              </>
                            ) : (
                              <span style={{
                                fontFamily: "'Montserrat', sans-serif",
                                fontSize: 11,
                                fontWeight: 600,
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
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
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
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
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
