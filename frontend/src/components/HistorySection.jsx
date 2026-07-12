import { useState, useEffect } from 'react'
import { db } from '../config/supabase'

// Badge color configs by type and history mode
const HP_CONFIG = {
  deposit: {
    label: 'Deposit',
    badgeBg: '#EFF6FF',
    badgeText: '#2563EB',
    valuePrefix: '+',
    valueColor: '#0A0B0D'
  },
  win: {
    label: 'Win',
    badgeBg: '#F0FDF4',
    badgeText: '#15803D',
    valuePrefix: '+',
    valueColor: '#0A0B0D'
  },
  win_daily: {
    label: 'Win Daily',
    badgeBg: '#F5F3FF',
    badgeText: '#7C3AED',
    valuePrefix: '+',
    valueColor: '#0A0B0D'
  },
  checkin: {
    label: 'Check-in',
    badgeBg: '#FFF7ED',
    badgeText: '#EA580C',
    valuePrefix: '+',
    valueColor: '#0A0B0D'
  },
  default: {
    label: '',
    badgeBg: '#F1F3F7',
    badgeText: '#4B5563',
    valuePrefix: '+',
    valueColor: '#0A0B0D'
  }
}

const HH_CONFIG = {
  deposit: {
    label: 'Deposit',
    badgeBg: '#EFF6FF',
    badgeText: '#2563EB',
    valuePrefix: '-',
    valueColor: '#0A0B0D'
  },
  win: {
    label: 'Win',
    badgeBg: '#F0FDF4',
    badgeText: '#15803D',
    valuePrefix: '+',
    valueColor: '#0A0B0D'
  },
  win_daily: {
    label: 'Win Daily',
    badgeBg: '#F5F3FF',
    badgeText: '#7C3AED',
    valuePrefix: '+',
    valueColor: '#0A0B0D'
  },
  default: {
    label: '',
    badgeBg: '#F1F3F7',
    badgeText: '#4B5563',
    valuePrefix: '+',
    valueColor: '#0A0B0D'
  }
}

const formatDate = (dateStr) => {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const formatHP = (val) => {
  const n = parseFloat(val || 0)
  return n.toFixed(2)
}

const formatHH = (val) => {
  const n = parseFloat(val || 0)
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'b'
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'm'
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k'
  return n.toFixed(2)
}

export function HistorySection({ address }) {
  const [historyTab, setHistoryTab] = useState('hp') // 'hp' | 'hh'
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
        setHasMore(data?.length === limit)
      }
      setLoading(false)
    }
    loadHistory()
  }, [address, limit])

  const onLoadMore = () => setLimit((prev) => prev + 5)
  const onShowLess = () => setLimit(5)

  if (loading && history.length === 0) {
    return (
      <div style={{ marginTop: 20, textAlign: 'center', color: '#717886', fontSize: 14 }}>
        Loading history...
      </div>
    )
  }

  if (!loading && history.length === 0) {
    return null
  }

  // Filter records by tab
  const hpTypes = ['deposit', 'win', 'win_daily', 'checkin']
  const hhTypes = ['deposit', 'win', 'win_daily']

  const filteredHistory = historyTab === 'hp'
    ? history.filter(r => hpTypes.includes(r.type))
    : history.filter(r => hhTypes.includes(r.type))

  return (
    <div style={{
      background: '#fff',
      borderRadius: 24,
      marginTop: 20,
      padding: '20px 18px 16px',
      boxShadow: '0 8px 32px rgba(0, 82, 255, 0.02)',
      border: '1px solid #E5E9F0'
    }}>
      {/* Header with switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 850, color: '#0A0B0D' }}>History</div>
        {/* HP / $HH Switcher */}
        <div style={{
          display: 'flex',
          background: '#EEF0F3',
          border: '1px solid #DEE1E7',
          borderRadius: 10,
          padding: 3,
          gap: 3
        }}>
          {[
            { id: 'hp', label: 'HP' },
            { id: 'hh', label: '$HH' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setHistoryTab(t.id)}
              style={{
                padding: '4px 10px',
                borderRadius: 7,
                border: 'none',
                background: historyTab === t.id ? '#FFFFFF' : 'transparent',
                color: historyTab === t.id ? '#0000FF' : '#717886',
                fontSize: 10.5,
                fontWeight: 800,
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.15s',
                boxShadow: historyTab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {filteredHistory.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#717886', fontSize: 12, padding: '12px 0' }}>
            No {historyTab === 'hp' ? 'HP' : '$HH'} history yet
          </div>
        ) : filteredHistory.map((record, index) => {
          const config = historyTab === 'hp'
            ? (HP_CONFIG[record.type] || HP_CONFIG.default)
            : (HH_CONFIG[record.type] || HH_CONFIG.default)

          // Build badge label
          let badgeLabel = config.label
          // For checkin: show streak from badge field e.g. "Streak (8d)"
          if (record.type === 'checkin' && record.badge) {
            badgeLabel = `Check-in`
          }
          // Show round number from badge for deposit/win
          const roundBadge = record.badge || ''

          // Build value display
          let valueDisplay
          if (historyTab === 'hp') {
            valueDisplay = `${config.valuePrefix}${formatHP(record.value)} HP`
          } else {
            // $HH tab: value_hh column or derive from value
            const hhVal = record.value_hh ?? record.value
            valueDisplay = (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                <span>{config.valuePrefix}{formatHH(hhVal)}</span>
                <img src="/logo.jfif" alt="$HH" style={{ width: 11, height: 11, borderRadius: '50%', objectFit: 'cover' }} />
              </span>
            )
          }

          return (
            <div key={record.id} style={{
              display: 'grid',
              gridTemplateColumns: '60px 1fr 45px auto',
              alignItems: 'center',
              gap: 6,
              padding: '10px 0',
              borderBottom: index !== filteredHistory.length - 1 ? '1px solid #F1F3F7' : 'none'
            }}>
              {/* 1. Action Type */}
              <div style={{ fontSize: 11, fontWeight: 800, color: '#0A0B0D', whiteSpace: 'nowrap' }}>
                {historyTab === 'hp' && record.type === 'checkin' ? 'Check-in' : config.label}
              </div>

              {/* 2. Badge */}
              <div>
                {roundBadge && (
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
                    {roundBadge}
                  </span>
                )}
              </div>

              {/* 3. Date */}
              <div style={{ fontSize: 11, color: '#717886', whiteSpace: 'nowrap' }}>
                {formatDate(record.created_at)}
              </div>

              {/* 4. Value */}
              <div style={{ fontSize: 12, fontWeight: 800, color: config.valueColor, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {valueDisplay}
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
