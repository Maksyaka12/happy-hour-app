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
        boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 24px',
        border: '1px solid rgba(255,255,255,0.08)',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
      onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
    >
      {/* Background Image with Overlay */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'url(/event-boxes.jfif)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.65,
        zIndex: 0
      }} />
      
      {/* Gradient Overlay for Text Readability */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(90deg, rgba(10,11,13,0.85) 0%, rgba(10,11,13,0.3) 70%, transparent 100%)',
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
          padding: '4px 12px',
          borderRadius: '50px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          marginBottom: '10px'
        }}>
          <span style={{ fontSize: '13px' }}>🔥</span>
          <span style={{ 
            fontSize: '10px', 
            fontWeight: 900, 
            color: '#fff', 
            textTransform: 'uppercase',
            letterSpacing: '0.8px'
          }}>Challenge is live</span>
        </div>

        <h2 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '26px',
          fontWeight: 900,
          color: '#fff',
          lineHeight: 1.1,
          margin: 0,
          textShadow: '0 4px 15px rgba(0,0,0,0.6)',
          maxWidth: '280px',
          letterSpacing: '-0.3px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span>50</span>
            <div style={{ 
              width: 24, height: 24, 
              background: '#2775CA', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 900,
              color: '#fff',
              boxShadow: '0 0 10px rgba(39, 117, 202, 0.5)'
            }}>
              $
            </div>
            <span>CAN DROP</span>
          </div>
          <div style={{ fontSize: '18px', opacity: 0.9, marginTop: 2, fontWeight: 800 }}>
            TO ANYONE FROM ANY BOX
          </div>
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

      {/* Small Hint Arrow */}
      <div style={{
        position: 'absolute',
        right: '24px',
        top: '50%',
        transform: 'translateY(-50%)',
        fontSize: '20px',
        color: '#fff',
        opacity: 0.5,
        zIndex: 2
      }}>
        →
      </div>
    </div>
  );
}
