import React from 'react';

export function EventBanner({ onClick }) {
  return (
    <div 
      onClick={onClick}
      style={{
        margin: '0 16px 16px',
        height: '140px',
        borderRadius: '24px',
        overflow: 'hidden',
        position: 'relative',
        background: '#000',
        boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 24px',
        border: '1px solid rgba(255,255,255,0.12)',
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
        background: 'linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.7))',
        zIndex: 1
      }} />

      {/* Content Area */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', width: '100%' }}>
        {/* Headline - Left Aligned */}
        <div style={{
          fontSize: '18px',
          fontWeight: 800,
          color: '#fff',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: '6px'
        }}>
          <span>🔥</span> Challenge is Live
        </div>

        {/* Subtext - Left Aligned */}
        <div style={{
          fontSize: '13px',
          fontWeight: 400,
          color: 'rgba(255,255,255,0.9)',
          letterSpacing: '0.2px',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          whiteSpace: 'nowrap'
        }}>
          <span style={{ fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
            50 <img src="/usdc-logo.png" alt="USDC" style={{ width: 16, height: 16 }} />
          </span>
          <span>can drop to anyone from any box</span>
        </div>

        {/* CTA Badge - Centered at the bottom */}
        <div style={{
          marginTop: '16px',
          display: 'flex',
          justifyContent: 'center',
          width: '100%'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255,255,255,0.15)',
            padding: '5px 14px',
            borderRadius: '50px',
            border: '1px solid rgba(255,255,255,0.25)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
          }} className="banner-cta">
            <span style={{ 
              fontSize: '10px', 
              fontWeight: 800, 
              color: '#fff', 
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>Open Box</span>
            <span style={{ fontSize: '13px', lineHeight: 1 }}>→</span>
          </div>
        </div>
      </div>
      
      {/* Shine Effect */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shine {
          0% { left: -100%; }
          20% { left: 100%; }
          100% { left: 100%; }
        }
        .event-banner-card:hover .banner-bg {
          transform: scale(1.05);
        }
        .event-banner-card:hover .banner-cta {
          background: rgba(255,255,255,0.25);
          transform: translateY(-2px);
        }
        .event-banner-card:active {
          transform: scale(0.98);
        }
      ` }} />
      <div style={{
        position: 'absolute',
        top: 0,
        left: '-100%',
        width: '50%',
        height: '100%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
        transform: 'skewX(-25deg)',
        animation: 'shine 6s infinite',
        zIndex: 1
      }} />
    </div>
  );
}
