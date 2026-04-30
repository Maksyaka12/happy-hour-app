import React from 'react'

export function HappyBoxesSection({ address }) {
  const boxes = [
    {
      id: 'common',
      name: 'Common Box',
      price: '0.50',
      color: '#8B5A2B', // Bronze-ish
      bg: '#FAF4ED',
      icon: '📦',
      description: 'A solid start. Good chance for a quick HP boost.',
      rewards: 'Up to 250 HP'
    },
    {
      id: 'epic',
      name: 'Epic Box',
      price: '2.00',
      color: '#9333EA', // Purple
      bg: '#F3E8FF',
      icon: '🎁',
      description: 'High stakes, high rewards. Better odds for jackpots.',
      rewards: 'Up to 1,500 HP + Tickets'
    },
    {
      id: 'legendary',
      name: 'Legendary Box',
      price: '5.00',
      color: '#D97706', // Gold
      bg: '#FEF3C7',
      icon: '👑',
      description: 'The ultimate prize pool. Guaranteed massive rewards.',
      rewards: 'Up to 5,000 HP + VIP Badge'
    }
  ]

  const handleOpenBox = (boxId) => {
    // For now, just a placeholder. Later this will open TxModal.
    console.log(`User wants to open: ${boxId}`)
    alert(`Opening ${boxId} box... (Smart contract integration coming soon!)`)
  }

  return (
    <div style={{ paddingBottom: 80, animation: 'fadeIn 0.3s ease' }}>
      <style>
        {`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes bouncePulse { 
            0% { transform: scale(1); } 
            50% { transform: scale(1.05); } 
            100% { transform: scale(1); } 
          }
          .box-card { transition: all 0.2s ease; }
          .box-card:active { transform: scale(0.98); }
        `}
      </style>

      {/* Header Banner */}
      <div style={{ background: 'linear-gradient(135deg, #0000FF 0%, #4F46E5 100%)', borderRadius: 24, padding: 24, marginBottom: 20, color: '#fff', boxShadow: '0 8px 32px rgba(0,0,255,0.2)' }}>
        <div style={{ fontSize: 32, marginBottom: 8, animation: 'bouncePulse 2s infinite' }}>🎁</div>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, letterSpacing: -0.5 }}>Happy Boxes</div>
        <div style={{ fontSize: 14, color: '#A5B4FC', lineHeight: 1.5, fontWeight: 500 }}>
          Test your luck! Open a box to win massive HP, free raffle tickets, and exclusive badges.
        </div>
      </div>

      {/* Box List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {boxes.map((box) => (
          <div key={box.id} className="box-card" style={{ background: '#fff', border: '1px solid #DEE1E7', borderRadius: 20, padding: 18, boxShadow: '0 4px 12px rgba(10,11,13,0.03)' }}>
            <div style={{ display: 'flex', gap: 16 }}>
              {/* Icon / Image Placeholder */}
              <div style={{ width: 64, height: 64, background: box.bg, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0, border: \`1px solid \${box.color}30\` }}>
                {box.icon}
              </div>
              
              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0A0B0D', marginBottom: 4 }}>
                  {box.name}
                </div>
                <div style={{ fontSize: 13, color: '#717886', lineHeight: 1.4, marginBottom: 8 }}>
                  {box.description}
                </div>
                <div style={{ display: 'inline-block', background: box.bg, color: box.color, padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 800 }}>
                  🏆 {box.rewards}
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={() => handleOpenBox(box.id)}
              style={{
                width: '100%',
                marginTop: 16,
                background: box.id === 'epic' || box.id === 'legendary' ? '#0000FF' : '#EEF0F3',
                color: box.id === 'epic' || box.id === 'legendary' ? '#fff' : '#0A0B0D',
                borderRadius: 50,
                padding: '12px',
                fontSize: 15,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: box.id === 'legendary' ? '0 4px 16px rgba(0,0,255,0.3)' : 'none'
              }}
            >
              Open for <span style={{ color: box.id === 'common' ? '#0000FF' : '#A5B4FC', marginLeft: 6, display: 'flex', alignItems: 'center' }}>
                {box.price}
                <img src="/usdc-logo.png" alt="USDC" style={{ width: 16, height: 16, marginLeft: 3, display: 'inline-block', verticalAlign: 'middle' }} />
              </span>
            </button>
          </div>
        ))}
      </div>

    </div>
  )
}
