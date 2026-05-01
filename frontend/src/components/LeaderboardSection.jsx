import { useEffect, useState } from 'react'
import { db } from '../config/supabase'
import { UserAvatar } from './UserAvatar'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')
const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF', '#FF9F1C', '#00B4D8', '#F72585', '#3A86FF', '#8338EC']
const pColor = (addr) => colors[parseInt(addr?.slice(2, 4) || '0', 16) % colors.length]
const medals = ['🥇', '🥈', '🥉']

export function LeaderboardSection({ address }) {
  const [leaders, setLeaders] = useState([])
  const [loading, setLoading] = useState(true)
  const [outsideRank, setOutsideRank] = useState(null)
  useEffect(() => {
    if (!address) return
    let alive = true

    const loadLeaders = async () => {
      // Load top 100
      const { data, error } = await db
        .from('users')
        .select('address, basename, points, wins, entries')
        .order('points', { ascending: false })
        .limit(100)

      if (error) {
        console.error('loadLeaders:', error)
        return
      }

      if (alive) {
        setLeaders(data ?? [])

        const inTopIndex = (data ?? []).findIndex(u => u.address?.toLowerCase() === address?.toLowerCase())
        if (inTopIndex === -1) {
          // User not in top 100 — fetch their exact rank
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
      .channel('leaderboard-users')
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
      {displayRank > 0 && (
        <div
          style={{
            background: 'linear-gradient(135deg,#0000FF,#3C8AFF)',
            borderRadius: 18,
            padding: '14px 18px',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 6px 24px rgba(0,0,255,0.35)',
          }}
        >
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 30, fontWeight: 900, color: '#fff', minWidth: 44 }}>#{displayRank}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 600, marginBottom: 2 }}>YOUR POSITION</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{displayEntry?.basename || short(address)}</div>
          </div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 26, fontWeight: 900, color: '#fff' }}>
            {(displayEntry?.points ?? 0).toLocaleString()} HP
          </div>
        </div>
      )}

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
                  <div style={{ fontSize: 11, color: '#717886', marginTop: 1 }}>
                    {u.wins} win{u.wins !== 1 ? 's' : ''} · {u.entries} entries
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: "'Barlow Condensed',sans-serif",
                    fontSize: 18,
                    fontWeight: 900,
                    color: i === 0 ? '#D97706' : i === 1 ? '#717886' : i === 2 ? '#CD7F32' : '#0A0B0D',
                  }}
                >
                  {u.points.toLocaleString()}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
