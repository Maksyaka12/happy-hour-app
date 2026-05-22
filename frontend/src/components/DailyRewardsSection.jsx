import { useEffect, useState } from 'react'
import { db } from '../config/supabase'
import { UserAvatar } from './UserAvatar'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

export function DailyRewardsSection({ address }) {
  const [dailyLeaders, setDailyLeaders] = useState([])
  const [outsideDailyRank, setOutsideDailyRank] = useState(null)
  const [timeLeft, setTimeLeft] = useState('')
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

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px 20px', color: '#717886' }}>Loading…</div>
  }

  return (
    <div style={{ paddingBottom: 120, padding: '0 12px 120px' }}>
      {/* Premium Glassmorphic Daily Rewards Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0D1527 0%, #052E16 100%)',
        borderRadius: 24,
        padding: '22px 16px 24px',
        marginBottom: 16,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 12px 40px rgba(5,46,22,0.3)',
        overflow: 'hidden',
        border: '1px solid rgba(16,185,129,0.2)'
      }}>
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

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 34,
            fontWeight: 900,
            color: '#fff',
            lineHeight: 1,
            textShadow: '0 4px 15px rgba(0,0,0,0.6)',
            letterSpacing: '-0.5px',
            textTransform: 'uppercase'
          }}>
            DAILY REWARDS
          </div>
          
          <div style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 50,
            padding: '4px 14px',
            fontSize: 10,
            fontWeight: 800,
            color: '#10B981',
            display: 'inline-block',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            🏆 Top 20 most active users of the day get HP rewards
          </div>

          {/* Countdown Clock */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.35)',
            backdropFilter: 'blur(10px)',
            borderRadius: 14,
            padding: '10px 20px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            width: '100%',
            maxWidth: 220,
            marginTop: 4
          }}>
            <div style={{
              fontSize: 9,
              fontWeight: 800,
              color: 'rgba(255, 255, 255, 0.5)',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: 4
            }}>
              Distribute in
            </div>
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 24,
              fontWeight: 900,
              color: '#10B981',
              letterSpacing: '1px',
              lineHeight: 1
            }}>
              {timeLeft}
            </div>
          </div>
        </div>
      </div>

      {/* User Rank Card */}
      {displayDailyRank > 0 && (
        <div
          style={{
            background: 'linear-gradient(135deg, #059669, #10B981)',
            borderRadius: 18,
            padding: '12px 18px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 6px 20px rgba(5,150,105,0.2)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)'
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Your Daily Rank</div>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Est. Reward</div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Score: {displayDailyScore}</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 900 }}>
                +{getReward(displayDailyRank)} <span style={{ fontSize: 9, opacity: 0.8 }}>HP</span>
              </div>
            </div>
          </div>
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
            const badgeBg = rank === 1 ? 'rgba(252, 211, 77, 0.2)' 
                         : (rank >= 2 && rank <= 5) ? 'rgba(226, 232, 240, 0.6)' 
                         : (rank >= 6 && rank <= 10) ? 'rgba(253, 186, 116, 0.2)' 
                         : '#F8F9FC'
            
            const badgeBorder = rank === 1 ? 'rgba(252, 211, 77, 0.5)'
                             : (rank >= 2 && rank <= 5) ? 'rgba(226, 232, 240, 1)'
                             : (rank >= 6 && rank <= 10) ? 'rgba(253, 186, 116, 0.5)'
                             : '#DEE1E7'

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
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 14,
                  fontWeight: 900,
                  color: '#32353D',
                  minWidth: 24,
                  textAlign: 'center'
                }}>
                  {rank}
                </div>

                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <UserAvatar address={u.address} size={28} />
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
                    {u.basename || short(u.address)}
                  </div>
                  <div style={{ fontSize: 10, color: '#717886', fontWeight: 600 }}>Score: {u.score}</div>
                </div>

                {/* Reward Badge */}
                <div style={{
                  background: badgeBg,
                  border: `1px solid ${badgeBorder}`,
                  borderRadius: 10,
                  width: 78, 
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 13,
                    fontWeight: 900,
                    color: '#32353D'
                  }}>
                    +{getReward(rank)} <span style={{ fontSize: 9, opacity: 0.8, fontWeight: 700 }}>HP</span>
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
          ['When are rewards distributed?', 'Top 20 most active users automatically receive HP daily when the timer hits 0 (00:00 UTC).'],
          ['What happens when the timer hits 00:00?', 'The leaderboard resets along with your activity points. New day - new chance for everyone.'],
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
