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
        background: '#0A0B0D',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 24px',
        border: '1px solid rgba(255,255,255,0.1)',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        userSelect: 'none'
      }}
      className="event-banner-card"
    >
      {/* Background Image with sophisticated overlay */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'url(/event-boxes.jfif)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.6,
        zIndex: 0,
        transition: 'transform 0.5s ease'
      }} className="banner-bg" />
      
      {/* Dark gradient for text focus */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(90deg, rgba(10,11,13,0.95) 0%, rgba(10,11,13,0.5) 50%, transparent 100%)',
        zIndex: 1
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* Status Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(10px)',
          padding: '4px 12px',
          borderRadius: '50px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '10px'
        }}>
          <span style={{ fontSize: '12px' }}>🔥</span>
          <span style={{ 
            fontSize: '10px', 
            fontWeight: 800, 
            color: '#fff', 
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>Challenge is live</span>
        </div>

        {/* Main Title Area */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '32px',
            fontWeight: 900,
            color: '#fff',
            letterSpacing: '-0.5px'
          }}>
            <span>50</span>
            <img src="/usdc-logo.png" alt="USDC" style={{ width: 28, height: 28, filter: 'drop-shadow(0 0 8px rgba(39, 117, 202, 0.6))' }} />
            <span style={{ color: '#fff' }}>CAN DROP</span>
          </div>
          <div style={{ 
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '18px', 
            fontWeight: 700, 
            color: 'rgba(255,255,255,0.8)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            to anyone from any box
          </div>
        </div>
      </div>
      
      {/* CTA Button / Arrow */}
      <div style={{
        position: 'absolute',
        right: '24px',
        bottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(255,255,255,0.1)',
        padding: '6px 14px',
        borderRadius: '50px',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(5px)',
        zIndex: 3,
        transition: 'all 0.2s ease'
      }} className="banner-cta">
        <span style={{ 
          fontSize: '11px', 
          fontWeight: 900, 
          color: '#fff', 
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>Try your luck</span>
        <span style={{ fontSize: '16px', lineHeight: 1 }}>→</span>
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
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
        transform: 'skewX(-25deg)',
        animation: 'shine 6s infinite',
        zIndex: 1
      }} />
    </div>
  );
}
