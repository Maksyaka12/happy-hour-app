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
        padding: '0 30px',
        border: '1px solid rgba(255,255,255,0.15)',
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
        transition: 'transform 0.5s ease'
      }} className="banner-bg" />
      
      {/* Subtle overlay */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(90deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
        zIndex: 1
      }} />

      {/* Main Content Layout: Left (Large Prize) | Right (Text + CTA) */}
      <div style={{ 
        position: 'relative', 
        zIndex: 2, 
        display: 'flex', 
        alignItems: 'center', 
        width: '100%',
        gap: '24px'
      }}>
        
        {/* Left Side: Big 50 USDC */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '72px',
          fontWeight: 900,
          color: '#fff',
          lineHeight: 1,
          letterSpacing: '-2px',
          textShadow: '0 0 30px rgba(255,255,255,0.2)'
        }}>
          <span>50</span>
          <img src="/usdc-logo.png" alt="USDC" style={{ width: 56, height: 56, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }} />
        </div>

        {/* Right Side: Description + CTA */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          flex: 1
        }}>
          <div style={{
            fontSize: '15px',
            color: 'rgba(255,255,255,0.95)',
            fontWeight: 400,
            lineHeight: 1.3,
            maxWidth: '180px',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)'
          }}>
            It can drop to anyone<br />from any box
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255,255,255,0.15)',
            padding: '6px 14px',
            borderRadius: '50px',
            border: '1px solid rgba(255,255,255,0.25)',
            backdropFilter: 'blur(10px)',
            width: 'fit-content',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
          }} className="banner-cta">
            <span style={{ 
              fontSize: '11px', 
              fontWeight: 900, 
              color: '#fff', 
              textTransform: 'uppercase',
              letterSpacing: '0.8px'
            }}>Open Box</span>
            <span style={{ fontSize: '14px', lineHeight: 1 }}>→</span>
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
          transform: translateX(4px);
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
