import { useState, useEffect } from 'react'
import { db } from '../config/supabase'

// Color configs for different event types
const TYPE_CONFIG = {
  deposit: {
    title: '#0A0B0D',
    badgeBg: '#F0FDF4',
    badgeText: '#15803D',
    value: '#059669' // Green text for deposit
  },
  checkin: {
    title: '#0A0B0D',
    badgeBg: '#F0F5FF',
    badgeText: '#0000FF',
    value: '#0A0B0D'
  },
  win: {
    title: '#0A0B0D',
    badgeBg: '#FFFBEB',
    badgeText: '#D97706',
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
      const { data, error } = await db.client
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
    // 5 -> 10 -> 20 -> 150
    if (limit === 5) setLimit(10)
    else if (limit === 10) setLimit(20)
    else if (limit === 20) setLimit(150)
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
      borderRadius: 16,
      marginTop: 20,
      padding: '20px 20px 16px',
      boxShadow: '0 4px 14px rgba(10,11,13,0.03)',
      border: '1px solid rgba(0,0,0,0.04)'
    }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#0A0B0D', marginBottom: 12 }}>History</div>
      
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {history.map((record, index) => {
          const config = TYPE_CONFIG[record.type] || TYPE_CONFIG.default
          const isDeposit = record.type === 'deposit'
          
          return (
            <div key={record.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 0',
              borderBottom: index !== history.length - 1 ? '1px solid #F1F3F7' : 'none'
            }}>
              {/* Left Side */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: config.title }}>
                  {record.action}
                </span>

                {record.badge && (
                  <span style={{
                    background: config.badgeBg,
                    color: config.badgeText,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 8
                  }}>
                    {record.badge}
                  </span>
                )}

                <span style={{ fontSize: 13, color: '#717886', marginLeft: 4 }}>
                  {formatDate(record.created_at)}
                </span>
              </div>

              {/* Right Side */}
              <div style={{ fontSize: 15, fontWeight: 800, color: config.value }}>
                {record.value}
              </div>
            </div>
          )
        })}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={loading}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px solid #E5E7EB',
            borderRadius: 30,
            padding: '12px',
            marginTop: 8,
            fontSize: 14,
            fontWeight: 600,
            color: '#32353D',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s'
          }}
        >
          {loading ? 'Loading...' : 'More'}
        </button>
      )}
    </div>
  )
}
