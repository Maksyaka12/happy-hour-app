import React from 'react';

export function EventBanner({ onClick }) {
  return (
    <div 
      onClick={onClick}
      style={{
        margin: '0 16px 16px',
        height: '160px',
        borderRadius: '24px',
        overflow: 'hidden',
        position: 'relative',
        background: '#000',
        boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        border: '1px solid rgba(255,255,255,0.15)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        userSelect: 'none',
        textAlign: 'center'
      }}
      className="event-banner-card"
    >
      {/* Background Image - Higher Opacity to be visible */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'url(/event-boxes.jfif)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.8,
        zIndex: 0,
        transition: 'transform 0.5s ease'
      }} className="banner-bg" />
      
      {/* Subtle overlay to help text contrast without turning it black */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.6))',
        zIndex: 1
      }} />

      {/* Content Container */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Status Badge - White with Black Text */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: '#fff',
          padding: '4px 14px',
          borderRadius: '50px',
          marginBottom: '10px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          minWidth: '120px',
          justifyContent: 'center'
        }}>
          <span style={{ fontSize: '10px' }}>🔥</span>
          <span style={{ 
            fontSize: '9px', 
            fontWeight: 900, 
            color: '#000', 
            textTransform: 'uppercase',
            letterSpacing: '0.8px'
          }}>Challenge is live</span>
        </div>

        {/* Main Title Area */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
          marginBottom: '10px'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: 10,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '34px',
            fontWeight: 900,
            color: '#fff',
            letterSpacing: '-0.5px',
            lineHeight: 1,
            textShadow: '0 2px 10px rgba(0,0,0,0.8)'
          }}>
            <span>50</span>
            <img src="/usdc-logo.png" alt="USDC" style={{ width: 32, height: 32, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }} />
            <span>CAN DROP</span>
          </div>
          <div style={{ 
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '18px', 
            fontWeight: 800, 
            color: '#fff',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            textShadow: '0 2px 6px rgba(0,0,0,0.8)',
            opacity: 0.95
          }}>
            to anyone from any box
          </div>
        </div>

        {/* CTA Button - SAME SIZE as top badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'rgba(255,255,255,0.2)',
          padding: '4px 14px',
          borderRadius: '50px',
          border: '1px solid rgba(255,255,255,0.4)',
          backdropFilter: 'blur(8px)',
          minWidth: '120px',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
        }} className="banner-cta">
          <span style={{ 
            fontSize: '9px', 
            fontWeight: 900, 
            color: '#fff', 
            textTransform: 'uppercase',
            letterSpacing: '0.8px'
          }}>Try your luck</span>
          <span style={{ fontSize: '12px', lineHeight: 1 }}>→</span>
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
          background: rgba(255,255,255,0.35);
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
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
        transform: 'skewX(-25deg)',
        animation: 'shine 6s infinite',
        zIndex: 1
      }} />
    </div>
  );
}
