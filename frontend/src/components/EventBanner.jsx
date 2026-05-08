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
        background: '#0A0B0D',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        border: '1px solid rgba(255,255,255,0.1)',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        userSelect: 'none',
        textAlign: 'center'
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
        opacity: 0.5,
        zIndex: 0,
        transition: 'transform 0.5s ease'
      }} className="banner-bg" />
      
      {/* Dark overlay for text focus */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle, rgba(10,11,13,0.7) 0%, rgba(10,11,13,0.9) 100%)',
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
          padding: '3px 10px',
          borderRadius: '50px',
          marginBottom: '12px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
        }}>
          <span style={{ fontSize: '10px' }}>🔥</span>
          <span style={{ 
            fontSize: '9px', 
            fontWeight: 900, 
            color: '#000', 
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>Challenge is live</span>
        </div>

        {/* Main Title Area - Centered */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          marginBottom: '12px'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: 8,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '30px',
            fontWeight: 900,
            color: '#fff',
            letterSpacing: '-0.5px',
            lineHeight: 1
          }}>
            <span>50</span>
            <img src="/usdc-logo.png" alt="USDC" style={{ width: 26, height: 26, filter: 'drop-shadow(0 0 8px rgba(39, 117, 202, 0.6))' }} />
            <span>CAN DROP</span>
          </div>
          <div style={{ 
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '16px', 
            fontWeight: 700, 
            color: 'rgba(255,255,255,0.9)',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            to anyone from any box
          </div>
        </div>

        {/* CTA Button - Centered below text */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(255,255,255,0.15)',
          padding: '6px 16px',
          borderRadius: '50px',
          border: '1px solid rgba(255,255,255,0.2)',
          backdropFilter: 'blur(5px)',
          transition: 'all 0.2s ease'
        }} className="banner-cta">
          <span style={{ 
            fontSize: '11px', 
            fontWeight: 900, 
            color: '#fff', 
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>Try your luck</span>
          <span style={{ fontSize: '14px', lineHeight: 1 }}>→</span>
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
          transform: scale(1.08);
        }
        .event-banner-card:hover .banner-cta {
          background: rgba(255,255,255,0.25);
          transform: translateY(-2px);
        }
        .event-banner-card:active {
          transform: scale(0.97);
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
