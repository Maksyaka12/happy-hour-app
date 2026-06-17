import { useState, useEffect } from 'react'
import { db } from '../config/supabase'

// Color configs for different event types
const TYPE_CONFIG = {
  deposit: {
    title: '#0A0B0D',
    badgeBg: '#FFFBEB',
    badgeText: '#D97706',
    value: '#0A0B0D' // Black text for deposit points
  },
  checkin: {
    title: '#0A0B0D',
    badgeBg: '#F0F5FF',
    badgeText: '#0000FF',
    value: '#0A0B0D'
  },
  win: {
    title: '#0A0B0D',
    badgeBg: '#F0FDF4',
    badgeText: '#15803D',
    value: '#0A0B0D'
  },
  boost: {
    title: '#0A0B0D',
    badgeBg: '#F0F5FF',
    badgeText: '#0000FF',
    value: '#0A0B0D'
  },
  quest: {
    title: '#0A0B0D',
    badgeBg: '#F5ECFF', // Purple-ish
    badgeText: '#9747FF',
    value: '#0A0B0D'
  },
  default: {
    title: '#0A0B0D',
    badgeBg: '#F1F3F7',
    badgeText: '#4B5563',
    value: '#0A0B0D'
  }
}

const formatDate = (dateStr) => {
  const d = new Date(dateStr)
  // Example output: "Apr 18"
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function HistorySection({ address }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [limit, setLimit] = useState(5)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    async function loadHistory() {
      if (!address) return
      
      setLoading(true)
      const { data, error } = await db
        .from('user_activity')
        .select('*')
        .eq('address', address.toLowerCase())
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Error loading history:', error)
      } else {
        setHistory(data || [])
        // If we received exactly 'limit' items, there might be more
        setHasMore(data?.length === limit)
      }
      setLoading(false)
    }

    loadHistory()
  }, [address, limit])

  const onLoadMore = () => {
    setLimit((prev) => prev + 5)
  }

  const onShowLess = () => {
    setLimit(5)
  }

  if (loading && history.length === 0) {
    return (
      <div style={{ marginTop: 20, textAlign: 'center', color: '#717886', fontSize: 14 }}>
        Loading history...
      </div>
    )
  }

  if (!loading && history.length === 0) {
    return null // Don't show history box if there is no history yet.
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: 24,
      marginTop: 20,
      padding: '20px 18px 16px',
      boxShadow: '0 8px 32px rgba(0, 82, 255, 0.02)',
      border: '1px solid #E5E9F0'
    }}>
      <div style={{ fontSize: 13.5, fontWeight: 850, color: '#0A0B0D', marginBottom: 12 }}>History</div>
      
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {history.map((record, index) => {
          const config = TYPE_CONFIG[record.type] || TYPE_CONFIG.default
          const isDeposit = record.type === 'deposit'

          let displayValue = record.value

          let displayAction = record.action
          if (displayAction === 'Daily Claim') {
            displayAction = 'Daily'
          }
          
          return (
            <div key={record.id} style={{
              display: 'grid',
              gridTemplateColumns: '60px 95px 45px 1fr',
              alignItems: 'center',
              gap: 6,
              padding: '10px 0',
              borderBottom: index !== history.length - 1 ? '1px solid #F1F3F7' : 'none'
            }}>
              {/* 1. Action */}
              <div style={{ position: 'relative', whiteSpace: 'nowrap', paddingTop: record.boost_mult > 1 ? 4 : 0 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: config.title }}>
                  {displayAction}
                </span>
                {record.boost_mult > 1 && (
                  <span style={{
                    position: 'absolute',
                    top: -5,
                    left: 2,
                    fontSize: 7,
                    fontWeight: 900,
                    color: record.boost_mult >= 5 ? '#9333EA' : '#059669',
                    background: record.boost_mult >= 5 ? 'rgba(147, 51, 234, 0.2)' : 'rgba(5, 150, 105, 0.2)',
                    border: `1px solid ${record.boost_mult >= 5 ? 'rgba(147, 51, 234, 0.4)' : 'rgba(5, 150, 105, 0.4)'}`,
                    padding: '1px 3px',
                    borderRadius: 4,
                    transform: 'rotate(-2deg)',
                    zIndex: 1,
                    backdropFilter: 'blur(4px)',
                    textTransform: 'lowercase'
                  }}>
                    {record.boost_mult}x boost
                  </span>
                )}
              </div>

              {/* 2. Badge */}
              <div>
                {record.badge && (
                  <span style={{
                    background: config.badgeBg,
                    color: config.badgeText,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 6,
                    whiteSpace: 'nowrap',
                    display: 'inline-block'
                  }}>
                    {record.badge}
                  </span>
                )}
              </div>

              {/* 3. Date */}
              <div style={{ fontSize: 11, color: '#717886', whiteSpace: 'nowrap' }}>
                {formatDate(record.created_at)}
              </div>

              {/* 4. Value */}
              <div style={{ fontSize: 12, fontWeight: 800, color: config.value, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {displayValue}
              </div>
            </div>
          )
        })}
      </div>

      {/* Load More Button */}
      {(hasMore || history.length > 5) && (
        <button
          onClick={hasMore ? onLoadMore : onShowLess}
          disabled={loading}
          style={{
            width: '100%',
            background: hasMore ? 'transparent' : 'rgba(239, 68, 68, 0.05)',
            border: `1px solid ${hasMore ? '#E5E9F0' : 'rgba(239, 68, 68, 0.1)'}`,
            borderRadius: 100,
            padding: '10px 14px',
            marginTop: 10,
            fontSize: 11,
            fontWeight: 800,
            color: hasMore ? '#0A0B0D' : '#DC2626',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            outline: 'none'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-0.5px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'none'}
        >
          {loading ? 'Loading...' : (hasMore ? 'Show More' : 'Show Less')}
        </button>
      )}
    </div>
  )
}
