import React from 'react';

export function EventBanner({ onClick }) {
  return (
    <div 
      onClick={onClick}
      style={{
        margin: '0 16px 12px',
        height: '100px',
        borderRadius: '20px',
        overflow: 'hidden',
        position: 'relative',
        background: 'var(--bg2)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 24px',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        userSelect: 'none',
      }}
      className="event-banner-card"
    >
      {/* Background Image */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'url(/event-boxes.jfif)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.7,
        zIndex: 0,
        transition: 'transform 0.6s ease'
      }} className="banner-bg" />
      
      {/* Dark Overlay */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(90deg, rgba(28,29,44,0.95) 0%, rgba(28,29,44,0.85) 100%)',
        zIndex: 1
      }} />

      {/* Content Area */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', width: '100%' }}>
        {/* Headline */}
        <div style={{
          fontSize: '16px',
          fontWeight: 800,
          color: '#fff',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: '4px'
        }}>
          <span>🔥</span> 
          <span>Challenge is Live</span>
          <div style={{
            background: 'rgba(244, 200, 27, 0.2)',
            color: '#F4C81B',
            padding: '1px 6px',
            borderRadius: '50px',
            fontSize: '8px',
            fontWeight: 900,
            marginLeft: '6px',
            border: '1px solid rgba(244, 200, 27, 0.4)',
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            boxShadow: '0 0 10px rgba(244, 200, 27, 0.1)',
            animation: 'pulse-glow 2s infinite',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}>
            x2 chance now
          </div>
        </div>

        {/* Subtext with Arrow */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%'
        }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.95)',
            letterSpacing: '0.2px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap'
          }}>
            <span style={{ fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: '20px', lineHeight: 1 }}>50</span>
              <img src="/usdc-logo.png" alt="USDC" style={{ width: 20, height: 20 }} />
            </span>
            <span>can drop to anyone from any box</span>
          </div>

          <div style={{
            fontSize: '24px',
            color: '#fff',
            opacity: 0.8,
            transition: 'transform 0.2s ease'
          }} className="banner-arrow">
            →
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{
          fontSize: '7px',
          color: 'rgba(255,255,255,0.5)',
          marginTop: '6px',
          letterSpacing: '0.1px',
          fontWeight: 400,
          lineHeight: 1.4
        }}>
          * The event is live as long as this banner is visible.<br />
          * Once someone finds the 50 USDC, the banner will be automatically removed.
        </div>
      </div>
      
      {/* Shine & Hover Effects */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shine {
          0% { left: -100%; }
          20% { left: 100%; }
          100% { left: 100%; }
        }
        @keyframes pulse-glow {
          0% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0.8; transform: scale(1); }
        }
        .event-banner-card:hover .banner-bg {
          transform: scale(1.03);
        }
        .event-banner-card:hover .banner-arrow {
          transform: translateX(5px);
          opacity: 1;
        }
        .event-banner-card:active {
          transform: scale(0.99);
        }
      ` }} />
      <div style={{
        position: 'absolute',
        top: 0,
        left: '-100%',
        width: '50%',
        height: '100%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
        transform: 'skewX(-25deg)',
        animation: 'shine 8s infinite',
        zIndex: 1
      }} />
    </div>
  );
}
