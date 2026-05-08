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
        alignItems: 'center',
        padding: '0',
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
        opacity: 0.6,
        zIndex: 0,
        transition: 'transform 0.6s ease'
      }} className="banner-bg" />
      
      {/* Sophisticated Dark Overlay */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(90deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 65%, rgba(0,0,0,0.2) 100%)',
        zIndex: 1
      }} />

      {/* 28/72 Layout (Shifted left for more space) */}
      <div style={{ 
        position: 'relative', 
        zIndex: 2, 
        display: 'flex', 
        width: '100%',
        height: '100%',
        alignItems: 'center'
      }}>
        
        {/* LEFT 28%: Prize Area */}
        <div style={{
          width: '28%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          borderRight: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(255,255,255,0.01)'
        }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '70px',
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1,
            letterSpacing: '-1.5px',
          }}>50</span>
          <img 
            src="/usdc-logo.png" 
            alt="USDC" 
            style={{ width: 30, height: 30, marginTop: 2, filter: 'drop-shadow(0 0 10px rgba(39, 117, 202, 0.4))' }} 
          />
        </div>

        {/* RIGHT 72%: Content Area */}
        <div style={{
          width: '72%',
          padding: '0 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 5
        }}>
          {/* Headline */}
          <div style={{
            fontSize: '17px',
            fontWeight: 800,
            color: '#fff',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            whiteSpace: 'nowrap'
          }}>
            Challenge is Live
          </div>

          {/* Subtext */}
          <div style={{
            fontSize: '13px',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '0.1px',
            whiteSpace: 'nowrap'
          }}>
            It can drop to anyone from any box
          </div>

          {/* CTA Badge */}
          <div style={{
            marginTop: 7,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255,255,255,0.1)',
            padding: '5px 12px',
            borderRadius: '50px',
            border: '1px solid rgba(255,255,255,0.15)',
            width: 'fit-content',
            transition: 'all 0.2s ease',
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
          background: rgba(255,255,255,0.2);
          transform: translateX(3px);
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
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
        transform: 'skewX(-25deg)',
        animation: 'shine 8s infinite',
        zIndex: 1
      }} />
    </div>
  );
}
