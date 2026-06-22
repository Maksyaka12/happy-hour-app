import React from 'react'

export function ContestsSection({ setTab }) {
  return (
    <div style={{ padding: '0 16px 120px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes floatingLogo {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0px); }
        }
      ` }} />

      {/* Section Banner - Identical to Earn, but with USDC + HH logos */}
      <div style={{
        backgroundImage: 'url(/banner.jpg)',
        backgroundColor: '#0000FF',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: 24,
        padding: '36px 20px',
        marginBottom: 16,
        position: 'relative',
        minHeight: 120,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        boxSizing: 'border-box'
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 0 }} />
        
        {/* Floating $HH & USDC Logos */}
        {[
          { type: 'hh', top: '10%', left: '8%', size: 38, opacity: 0.45, r: '-15deg', blur: 0.4, dur: 4.5 },
          { type: 'usdc', bottom: '10%', left: '22%', size: 28, opacity: 0.4, r: '10deg', blur: 0, dur: 5.2 },
          { type: 'hh', top: '8%', right: '12%', size: 44, opacity: 0.5, r: '18deg', blur: 0.5, dur: 3.8 },
          { type: 'usdc', top: '45%', right: '28%', size: 24, opacity: 0.35, r: '-8deg', blur: 0.8, dur: 6.0 },
          { type: 'hh', bottom: '8%', right: '6%', size: 48, opacity: 0.55, r: '12deg', blur: 0, dur: 4.4 },
          { type: 'usdc', top: '40%', left: '4%', size: 32, opacity: 0.4, r: '15deg', blur: 0.3, dur: 5.0 }
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
            animation: `floatingLogo ${s.dur}s ease-in-out infinite`,
          }}>
            <img
              src={s.type === 'hh' ? '/logo.jfif' : '/usdc-logo.png'}
              alt=""
              style={{
                width: s.size,
                height: s.size,
                borderRadius: '50%',
                opacity: s.opacity,
                filter: s.blur > 0 ? `blur(${s.blur}px)` : 'none',
                transform: `rotate(${s.r})`,
                objectFit: 'cover'
              }}
            />
          </div>
        ))}

        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 38,
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1.1,
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            letterSpacing: '-0.5px'
          }}>
            Contests
          </div>
        </div>
      </div>

      {/* Info Card (Premium Glassmorphism Theme) */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 82, 255, 0.08) 0%, rgba(0, 82, 255, 0.03) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(0, 82, 255, 0.22)',
        borderRadius: 16,
        padding: '12px 16px',
        marginBottom: 16,
        boxShadow: '0 8px 32px rgba(0, 82, 255, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
        boxSizing: 'border-box'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          color: '#1E293B',
          fontFamily: "'Outfit', 'Inter', sans-serif",
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.5,
          flexWrap: 'wrap',
          textAlign: 'center'
        }}>
          <span>Follow contests to participate and earn</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: 6, border: '1px solid rgba(16,185,129,0.2)', fontWeight: 800, color: '#059669', fontSize: 11.5 }}>
            <img src="/logo.jfif" alt="$HH" style={{ width: 13, height: 13, borderRadius: '50%', objectFit: 'cover' }} />
            $HH
          </span>
          <span>and</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(0,82,255,0.1)', padding: '2px 6px', borderRadius: 6, border: '1px solid rgba(0,82,255,0.2)', fontWeight: 800, color: '#0052FF', fontSize: 11.5 }}>
            <img src="/usdc-logo.png" alt="USDC" style={{ width: 13, height: 13 }} />
            USDC
          </span>
          <span>rewards. Contests are added periodically.</span>
        </div>
      </div>

      {/* Feature Blocks Grid — Identical to Earn Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
        {/* Block 1: Happy Raids (Coming Soon overlay) */}
        <div
          style={{
            background: '#140505',
            borderRadius: 20,
            padding: '14px 14px 12px',
            cursor: 'default',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            height: 126,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)'
          }}
        >
          {/* Graded background image */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/banner.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'hue-rotate(330deg) brightness(0.4) contrast(1.15)',
            zIndex: 0,
            pointerEvents: 'none'
          }} />
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#FFFFFF' }}>Happy Raids</div>
            <div style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.7)', marginTop: 2, fontWeight: 600 }}>steal HP</div>
          </div>
          
          {/* Centered semi-transparent Play Badge */}
          <div style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: 30,
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: 12.5,
            fontWeight: 800
          }}
          >
            Play →
          </div>

          {/* Coming Soon Overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(20, 20, 20, 0.35)',
            backdropFilter: 'blur(1px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 800,
            zIndex: 2,
            borderRadius: 20
          }}>
            Coming Soon
          </div>
        </div>

        {/* Block 2: Happy Boxes (Dark Purple theme) */}
        <div
          onClick={() => setTab('boxes')}
          style={{
            background: '#090514',
            borderRadius: 20,
            padding: '14px 14px 12px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 8px 32px rgba(46,16,101,0.2)',
            height: 126,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(139,92,246,0.25)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-1.5px)'
            e.currentTarget.style.boxShadow = '0 12px 36px rgba(46,16,101,0.3)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(46,16,101,0.2)'
          }}
        >
          {/* Graded background image */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/banner.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'hue-rotate(50deg) brightness(0.6) contrast(1.15)',
            zIndex: 0,
            pointerEvents: 'none'
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#FFFFFF' }}>Happy Boxes</div>
            <div style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.7)', marginTop: 2, fontWeight: 600 }}>earn more HP</div>
          </div>

          {/* Centered semi-transparent Open Badge */}
          <div style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: 30,
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: 12.5,
            fontWeight: 800,
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          >
            Open →
          </div>
        </div>
      </div>
    </div>
  )
}
