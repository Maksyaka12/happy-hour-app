import React from 'react';

export function ContestBanner() {
  const handleClick = () => {
    window.open('https://x.com/happyhour_base/status/2056345151455256589?s=20', '_blank');
  };

  return (
    <div 
      onClick={handleClick}
      style={{
        margin: '0 16px 12px',
        height: '100px',
        borderRadius: '20px',
        overflow: 'hidden',
        position: 'relative',
        background: '#000',
        boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 24px',
        border: '1px solid rgba(255,255,255,0.12)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        userSelect: 'none',
      }}
      className="contest-banner-card"
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
        background: 'linear-gradient(90deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 100%)',
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
          <span>Contest is Live</span>
        </div>

        {/* Subtext with Arrow */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '13px',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.95)',
            letterSpacing: '0.2px',
            whiteSpace: 'nowrap'
          }}>
            <span style={{ fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: '20px', lineHeight: 1 }}>20</span>
              <img src="/usdc-logo.png" alt="USDC" style={{ width: 20, height: 20 }} />
            </span>
            <span>for randomly winner</span>
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
          * Follow us and join our TG group.<br />
          * Check details on our X contest's post.
        </div>
      </div>
      
      {/* Shine & Hover Effects */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shine {
          0% { left: -100%; }
          20% { left: 100%; }
          100% { left: 100%; }
        }
        .contest-banner-card:hover .banner-bg {
          transform: scale(1.03);
        }
        .contest-banner-card:hover .banner-arrow {
          transform: translateX(5px);
          opacity: 1;
        }
        .contest-banner-card:active {
          transform: scale(0.99);
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
