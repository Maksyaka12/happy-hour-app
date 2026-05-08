import React from 'react';

export function EventBanner() {
  return (
    <div style={{
      margin: '0 16px 16px',
      height: '160px',
      borderRadius: '24px',
      overflow: 'hidden',
      position: 'relative',
      background: '#0A0B0D',
      boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '0 24px',
      border: '1px solid rgba(255,255,255,0.08)',
      cursor: 'default'
    }}>
      {/* Background Image with Overlay */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'url(/event-boxes.jfif)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.7,
        zIndex: 0
      }} />
      
      {/* Gradient Overlay for Text Readability */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(90deg, rgba(10,11,13,0.9) 0%, rgba(10,11,13,0.4) 60%, transparent 100%)',
        zIndex: 1
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(12px)',
          padding: '5px 14px',
          borderRadius: '50px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          marginBottom: '12px'
        }}>
          <span style={{ fontSize: '14px' }}>🔥</span>
          <span style={{ 
            fontSize: '11px', 
            fontWeight: 900, 
            color: '#fff', 
            textTransform: 'uppercase',
            letterSpacing: '0.8px'
          }}>Challenge is live</span>
        </div>

        <h2 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '32px',
          fontWeight: 900,
          color: '#fff',
          lineHeight: 1.05,
          margin: 0,
          textShadow: '0 4px 15px rgba(0,0,0,0.6)',
          maxWidth: '260px',
          letterSpacing: '-0.5px'
        }}>
          50 USDC CAN DROP FROM ANY BOX FOR ANYONE
        </h2>
      </div>
      
      {/* Animated Shine Effect */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shine {
          0% { left: -100%; }
          20% { left: 100%; }
          100% { left: 100%; }
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
