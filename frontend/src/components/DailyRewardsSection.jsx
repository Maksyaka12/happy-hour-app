import { useEffect, useState } from 'react'
import { db } from '../config/supabase'
import { UserAvatar } from './UserAvatar'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

const calculateTimeLeft = () => {
  const now = new Date()
  const nextDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  const diff = nextDay - now

  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function DailyRewardsSection({ address }) {
  const [dailyLeaders, setDailyLeaders] = useState([])
  const [outsideDailyRank, setOutsideDailyRank] = useState(null)
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) return
    let alive = true

    const loadDailyLeaders = async () => {
      const today = new Date().toISOString().slice(0, 10)
      console.log('Fetching daily leaders for:', today)

      const { data, error } = await db
        .from('daily_stats')
        .select('address, score, users!inner(basename)')
        .eq('day', today)
        .order('score', { ascending: false })
        .limit(30)

      if (error) {
        console.error('loadDailyLeaders error:', error)
      } else if (!error && alive) {
        setDailyLeaders(data?.map(d => ({
          address: d.address,
          score: d.score,
          basename: d.users?.basename
        })) || [])

        const inTopIndex = (data ?? []).findIndex(u => u.address?.toLowerCase() === address?.toLowerCase())
        if (inTopIndex === -1 && alive) {
          const { data: myData } = await db
            .from('daily_stats')
            .select('score')
            .eq('address', address.toLowerCase())
            .eq('day', today)
            .maybeSingle()

          if (myData) {
            const { count } = await db
              .from('daily_stats')
              .select('*', { count: 'exact', head: true })
              .eq('day', today)
              .gt('score', myData.score)
            setOutsideDailyRank({ rank: (count || 0) + 1, score: myData.score })
          } else {
            setOutsideDailyRank(null)
          }
        } else {
          setOutsideDailyRank(null)
        }
        setLoading(false)
      }
    }

    loadDailyLeaders()

    const channel = db
      .channel('daily-leaderboard-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_stats' }, loadDailyLeaders)
      .subscribe()

    return () => {
      alive = false
      db.removeChannel(channel)
    }
  }, [address])

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const myDailyRank = dailyLeaders.findIndex((u) => u.address?.toLowerCase() === address?.toLowerCase()) + 1
  const myDailyEntry = dailyLeaders.find((u) => u.address?.toLowerCase() === address?.toLowerCase())
  const displayDailyRank = myDailyRank > 0 ? myDailyRank : outsideDailyRank?.rank
  const displayDailyScore = myDailyRank > 0 ? myDailyEntry?.score : outsideDailyRank?.score
  const displayDailyEntry = myDailyRank > 0 ? myDailyEntry : outsideDailyRank

  const getReward = (rank) => {
    if (!rank || rank > 30) return 0
    if (rank === 1) return 20.0
    if (rank <= 5) return 15.0
    if (rank <= 10) return 10.0
    if (rank <= 20) return 5.0
    return 3.0
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px 20px', color: '#717886' }}>Loading…</div>
  }

  return (
    <div style={{ paddingBottom: 120, padding: '0 12px 120px' }}>
      {/* Premium Glassmorphic Daily Rewards Banner */}
      <div style={{
        background: '#0D1527',
        borderRadius: 24,
        padding: '32px 20px',
        marginBottom: 16,
        position: 'relative',
        minHeight: 160,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 12px 40px rgba(5,46,22,0.3)',
        overflow: 'hidden',
        border: '1px solid rgba(16,185,129,0.2)'
      }}>
        {/* Branded background banner in green tones */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/banner.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'hue-rotate(-120deg) brightness(0.65) contrast(1.15)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.5) 100%)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />

        {/* Glow overlay */}
        <div style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: '180px',
          height: '180px',
          background: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />

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
            animation: `dailyTrophyFloat ${s.dur}s ease-in-out infinite`,
          }}>
            <div style={{
              fontSize: `${s.size}px`,
              opacity: s.opacity,
              filter: s.blur > 0 ? `blur(${s.blur}px) drop-shadow(0 0 10px rgba(16,185,129,0.25))` : 'drop-shadow(0 0 10px rgba(16,185,129,0.25))',
              transform: `rotate(${s.r})`,
            }}>
              🏆
            </div>
          </div>
        ))}

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', paddingTop: 0, paddingBottom: 32 }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 46,
            fontWeight: 900,
            color: '#fff',
            lineHeight: 1,
            textShadow: '0 4px 15px rgba(0,0,0,0.6)',
            marginBottom: 12,
            letterSpacing: '-1px'
          }}>
            DAILY <span style={{ color: '#10B981' }}>HP</span> REWARDS
          </div>
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            backdropFilter: 'blur(10px)',
            borderRadius: 50,
            padding: '4px 12px',
            fontSize: 9,
            fontWeight: 800,
            color: '#10B981',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'inline-block',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
          }}>
            🏆 TOP-30 MOST ACTIVE USERS OF THE DAY GET HP
          </div>
        </div>

        {/* Distinct Footer for Daily End Info */}
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
            <span>Distribute in:</span>
            <span style={{ 
              color: '#10B981', 
              textShadow: '0 0 10px rgba(16,185,129,0.4)',
              background: 'rgba(16,185,129,0.1)',
              padding: '1px 6px',
              borderRadius: 6,
              border: '1px solid rgba(16,185,129,0.2)',
              fontWeight: 900, 
              fontFamily: "'DM Mono', monospace",
              fontSize: 13,
              letterSpacing: '0.5px'
            }}>{timeLeft}</span>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes dailyTrophyFloat {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
            100% { transform: translateY(0px); }
          }
        ` }} />
      </div>

      {/* User Rank Card */}
      {address && (
        <div
          style={{
            background: displayDailyRank > 0 ? 'linear-gradient(135deg, #059669, #10B981)' : 'linear-gradient(135deg, #374151, #1F2937)',
            borderRadius: 18,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: displayDailyRank > 0 ? '0 6px 20px rgba(5,150,105,0.2)' : '0 6px 20px rgba(55,65,81,0.15)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            opacity: displayDailyRank > 0 ? 1 : 0.85
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
              {displayDailyRank > 0 ? `#${displayDailyRank}` : '—'}
            </div>
            
            {/* User Details */}
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 10,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.75)',
                letterSpacing: '0.3px',
                textTransform: 'uppercase'
              }}>
                Your Daily Rank
              </div>
              <div style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 15,
                fontWeight: 700,
                color: '#fff',
                lineHeight: 1.2
              }}>
                Activity Points: {(displayDailyScore || 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Right: Est. Reward Gold/Glass Ticket */}
          {getReward(displayDailyRank) > 0 && (
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
                <span style={{ 
                  fontFamily: "'Montserrat', sans-serif", 
                  fontSize: 14, 
                  fontWeight: 700, 
                  color: '#fff', 
                  lineHeight: 1 
                }}>
                  +{getReward(displayDailyRank)}
                </span>
                <span style={{ 
                  fontFamily: "'Montserrat', sans-serif", 
                  fontSize: 14, 
                  fontWeight: 700, 
                  color: '#fff', 
                  lineHeight: 1 
                }}>
                  HP
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {dailyLeaders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: '#EEF0F3', borderRadius: 20 }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>⚡</div>
            <div style={{ fontWeight: 700, color: '#0A0B0D' }}>Activity starts now!</div>
            <div style={{ fontSize: 12, color: '#717886' }}>Be the most active user today</div>
          </div>
        ) : (
          dailyLeaders.map((u, i) => {
            const rank = i + 1
            const rewardHP = getReward(rank)

            const capsuleStyle = (() => {
              if (rank >= 1 && rank <= 30) {
                return { bg: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#fff', border: 'none', shadow: 'none', div: 'rgba(255,255,255,0.25)' }
              }
              return { bg: '#F1F5F9', color: '#64748B', border: 'none', shadow: 'none', div: 'transparent' }
            })();

            return (
              <div
                key={u.address}
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
                  gap: 5,
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
                    #{rank}
                  </span>
                  
                  {rewardHP > 0 && (
                    <>
                      <div style={{ width: 1, height: 12, background: capsuleStyle.div }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <span style={{
                          fontFamily: "'Montserrat', sans-serif",
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#fff',
                          letterSpacing: '-0.2px'
                        }}>
                          +{rewardHP}
                        </span>
                        <span style={{
                          fontFamily: "'Montserrat', sans-serif",
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#fff'
                        }}>
                          HP
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div style={{ position: 'relative', flexShrink: 0, marginLeft: 2 }}>
                  <UserAvatar address={u.address} size={28} />
                </div>

                {/* Middle: User details */}
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
                      {u.basename || short(u.address)}
                    </span>
                    {address && u.address?.toLowerCase() === address.toLowerCase() && (
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

                {/* Right: Activity Points Badge */}
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
                    {(u.score ?? 0).toLocaleString()}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Interactive Accordion / How it works */}
      <div style={{ 
        background: '#EEF0F3', 
        border: '1px solid #DEE1E7', 
        borderRadius: 16, 
        padding: '16px', 
        marginTop: 24 
      }}>
        <div style={{ 
          fontSize: 9, 
          fontWeight: 800, 
          color: '#717886', 
          letterSpacing: '0.5px', 
          marginBottom: 14, 
          textTransform: 'uppercase' 
        }}>
          How it works
        </div>
        {[
          ['What are Activity Points?', 'All your in-app activity converts into activity points. Formula: daily check-in + tasks + in-app transactions + post approval + your streak.'],
          ['When are rewards distributed?', 'Top-30 most active users automatically receive HP daily when the timer hits 00:00 (00:00 UTC).'],
          ['What happens when the timer hits 00:00?', 'The leaderboard resets along with your activity points. New day - new chance for everyone to earn HP.'],
        ].map(([q, a], i, arr) => (
          <div key={i} style={{ marginBottom: i < arr.length - 1 ? 14 : 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0A0B0D', marginBottom: 3 }}>{q}</div>
            <div style={{ fontSize: 10, color: '#717886', lineHeight: 1.6, fontWeight: 500 }}>{a}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
