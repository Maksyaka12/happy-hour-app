import { useEffect, useState } from 'react'
import { db } from '../config/supabase'
import { UserAvatar } from './UserAvatar'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')
const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF', '#FF9F1C', '#00B4D8', '#F72585', '#3A86FF', '#8338EC']
const pColor = (addr) => colors[parseInt(addr?.slice(2, 4) || '0', 16) % colors.length]
const medals = ['🥇', '🥈', '🥉']

export function LeaderboardSection({ address }) {
  const [leaders, setLeaders] = useState([])
  const [dailyLeaders, setDailyLeaders] = useState([])
  const [activeTab, setActiveTab] = useState('main') // 'main' | 'daily'
  const [loading, setLoading] = useState(true)
  const [outsideRank, setOutsideRank] = useState(null)
  const [outsideDailyRank, setOutsideDailyRank] = useState(null)
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    if (!address) return
    let alive = true

    const loadLeaders = async () => {
      // Load top 100
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

    const loadDailyLeaders = async () => {
      const today = new Date().toISOString().slice(0, 10)
      console.log('Fetching daily leaders for:', today)

      const { data, error } = await db
        .from('daily_stats')
        .select('address, score, users!inner(basename)') // Explicit join
        .eq('day', today)
        .order('score', { ascending: false })
        .limit(20)

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
          // User not in top 20 daily — fetch their rank
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
      }
    }

    loadLeaders()
    loadDailyLeaders()

    const channel = db
      .channel('leaderboard-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, loadLeaders)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_stats' }, loadDailyLeaders)
      .subscribe()

    return () => {
      alive = false
      db.removeChannel(channel)
    }
  }, [address])

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      const nextDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
      const diff = nextDay - now

      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)

      setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const myRank = leaders.findIndex((u) => u.address?.toLowerCase() === address?.toLowerCase()) + 1
  const myEntry = leaders.find((u) => u.address?.toLowerCase() === address?.toLowerCase())
  const displayRank = myRank > 0 ? myRank : outsideRank?.rank
  const displayEntry = myRank > 0 ? myEntry : outsideRank

  const myDailyRank = dailyLeaders.findIndex((u) => u.address?.toLowerCase() === address?.toLowerCase()) + 1
  const myDailyEntry = dailyLeaders.find((u) => u.address?.toLowerCase() === address?.toLowerCase())
  const displayDailyRank = myDailyRank > 0 ? myDailyRank : outsideDailyRank?.rank
  const displayDailyScore = myDailyRank > 0 ? myDailyEntry?.score : outsideDailyRank?.score

  const getReward = (rank) => {
    if (!rank || rank > 20) return 0
    if (rank === 1) return 50
    if (rank <= 5) return 30
    if (rank <= 10) return 15
    if (rank <= 15) return 10
    return 5
  }

  const getRewardColor = (rank) => {
    if (rank === 1) return '#F4C81B' // Gold
    if (rank <= 5) return '#717886' // Silver
    if (rank <= 10) return '#B45309' // Bronze
    return '#0A0B0D' // Black
  }

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
        marginBottom: 14,
        position: 'relative',
        minHeight: 140, // Reduced height
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        {/* Dark overlay to make text more readable if image is light */}
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

        {/* Distinct Footer for Season End Info */}
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
            Ends in: <span style={{ color: '#F4C81B', fontWeight: 900 }}>Coming soon</span>
          </div>
        </div>
      </div>

      {activeTab === 'main' ? (
        displayRank > 0 && (
          <div
            style={{
              background: 'linear-gradient(135deg,#0000FF,#3C8AFF)',
              borderRadius: 18,
              padding: '10px 16px',
              marginBottom: 12,
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
                <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Your Position</div>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Current HP</div>
              </div>
              
              {/* Values Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                  {displayEntry?.basename || short(address)}
                </div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 900 }}>
                  {(displayEntry?.points ?? 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
        displayDailyRank > 0 && (
          <div
            style={{
              background: 'linear-gradient(135deg, #059669, #10B981)',
              borderRadius: 18,
              padding: '10px 16px',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              boxShadow: '0 6px 20px rgba(5,150,105,0.2)',
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
              #{displayDailyRank}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Labels Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Daily Rank</div>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Est. Reward</div>
              </div>
              
              {/* Values Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Score: {displayDailyScore}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 900 }}>
                  +{getReward(displayDailyRank)} <span style={{ fontSize: 9, opacity: 0.8 }}>HP</span>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        background: '#EEF0F3',
        borderRadius: 16,
        padding: 3,
        marginBottom: 16,
        gap: 3,
        border: '1px solid #DEE1E7',
        maxWidth: 400,
        margin: '0 auto 16px'
      }}>
        <button
          onClick={() => setActiveTab('main')}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: 13,
            border: 'none',
            fontSize: 10,
            fontWeight: 800,
            cursor: 'pointer',
            background: activeTab === 'main' ? '#fff' : 'transparent',
            color: activeTab === 'main' ? '#0000FF' : '#717886',
            boxShadow: activeTab === 'main' ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}
        >
          <span style={{ opacity: activeTab === 'main' ? 1 : 0.6 }}>🏆</span>
          SEASON 1
        </button>
        <button
          onClick={() => setActiveTab('daily')}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: 13,
            border: 'none',
            fontSize: 10,
            fontWeight: 800,
            cursor: 'pointer',
            background: activeTab === 'daily' ? '#fff' : 'transparent',
            color: activeTab === 'daily' ? '#0000FF' : '#717886',
            boxShadow: activeTab === 'daily' ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}
        >
          <span style={{ opacity: activeTab === 'daily' ? 1 : 0.6 }}>⚡</span>
          DAILY REWARDS
        </button>
      </div>

      {activeTab === 'main' ? (
        <>
          <div style={{ marginTop: 10 }} />

          {leaders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#EEF0F3', borderRadius: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🏆</div>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 900, color: '#0A0B0D', marginBottom: 6 }}>No players yet</div>
              <div style={{ fontSize: 13, color: '#717886' }}>Be the first to play!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {leaders.map((u, i) => {
                const isMe = u.address?.toLowerCase() === address?.toLowerCase()
                return (
                  <div
                    key={u.address}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      background: isMe ? '#EEF0F3' : '#fff',
                      border: `1px solid ${isMe ? 'rgba(0,0,255,0.2)' : '#DEE1E7'}`,
                      borderRadius: 14,
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ width: 30, textAlign: 'center', fontSize: i < 3 ? 20 : 13, fontWeight: 700, color: '#717886' }}>
                      {i < 3 ? medals[i] : i + 1}
                    </div>
                    <UserAvatar address={u.address} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: isMe ? 700 : 500,
                          color: isMe ? '#0000FF' : '#0A0B0D',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {u.basename || short(u.address)}
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: "'Barlow Condensed',sans-serif",
                        fontSize: 18,
                        fontWeight: 900,
                        color: i === 0 ? '#F4C81B' : i === 1 ? '#717886' : i === 2 ? '#B45309' : '#0A0B0D',
                        textShadow: i === 0 ? '0.5px 0.5px 0px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      {u.points.toLocaleString()}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#0A0B0D',
            borderRadius: 16,
            padding: '14px 18px',
            marginBottom: 16,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            border: '1px solid rgba(255,255,255,0.05)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Subtle glow effect */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(5,150,105,0.4), transparent)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18, animation: 'pulse 2s infinite' }}>🕒</span>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '0.3px' }}>
                REWARDS DISTRIBUTE IN
              </div>
            </div>
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 18,
              fontWeight: 900,
              color: '#10B981', // Neon Green for the timer
              textShadow: '0 0 10px rgba(16,185,129,0.3)'
            }}>
              {timeLeft}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {dailyLeaders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: '#EEF0F3', borderRadius: 20 }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>⚡</div>
                <div style={{ fontWeight: 700, color: '#0A0B0D' }}>Activity starts now!</div>
                <div style={{ fontSize: 12, color: '#717886' }}>Be the most active user today</div>
              </div>
            ) : (
              dailyLeaders.map((u, i) => {
                const isMe = u.address?.toLowerCase() === address?.toLowerCase()
                const rank = i + 1
                const reward = getReward(rank)
                const rColor = getRewardColor(rank)

                return (
                  <div
                    key={u.address}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      background: isMe ? '#EEF0F3' : '#fff',
                      border: `1px solid ${isMe ? 'rgba(0,0,255,0.2)' : '#DEE1E7'}`,
                      borderRadius: 14,
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ width: 30, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#717886' }}>
                      {rank}
                    </div>
                    <UserAvatar address={u.address} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0A0B0D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.basename || short(u.address)}
                      </div>
                      <div style={{ fontSize: 11, color: '#717886', fontWeight: 600 }}>Activity Score: {u.score}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: rColor, textTransform: 'uppercase', opacity: 0.8 }}>Reward</div>
                      <div style={{
                        fontFamily: "'Barlow Condensed',sans-serif",
                        fontSize: 18,
                        fontWeight: 900,
                        color: rColor,
                        textShadow: rank === 1 ? '0.5px 0.5px 0px rgba(0,0,0,0.05)' : 'none'
                      }}>
                        +{reward} <span style={{ fontSize: 11 }}>HP</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* How it works */}
          <div style={{ background: '#EEF0F3', border: '1px solid #DEE1E7', borderRadius: 16, padding: '18px 16px', marginTop: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#717886', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' }}>
              How it works
            </div>
            {[
              ['What are Activity Points?', 'All your in-app activity converts into activity points. Formula: daily check-in + tasks + in-app transactions + post approval + your streak (different values).'],
              ['When are rewards distributed?', 'Top 20 most active users automatically receive HP daily when the timer hits 0 (00:00 UTC).'],
              ['What happens when the timer hits 00:00?', 'The leaderboard resets along with your activity points. New day - new chance for everyone.'],
            ].map(([q, a], i, arr) => (
              <div key={i} style={{ marginBottom: i < arr.length - 1 ? 12 : 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#32353D', marginBottom: 3 }}>{q}</div>
                <div style={{ fontSize: 12, color: '#717886', lineHeight: 1.65 }}>{a}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
