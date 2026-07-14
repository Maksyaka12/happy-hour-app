// src/styles.js

export const CSS = `
  :root {
    --blue:      #0000FF;
    --cerulean:  #3C8AFF;
    --black:     #0A0B0D;
    --white:     #FFFFFF;
    --gray-10:   #EEF0F3;
    --gray-15:   #DEE1E7;
    --gray-30:   #B1B7C3;
    --gray-50:   #717886;
    --gray-80:   #32353D;
    --red:       #FC401F;
    --green:     #059669;
    --gold:      #D97706;
    --bg:        #1C1D2C;
    --bg2:       #13141F;
    --bg3:       #28293D;
    --text:      #FFFFFF;
    --text2:     #A0A5B5;
    --muted:     #8F95B2;
    --border:    #2E2F3A;
    --border2:   #3B3D4F;
    --blue-bg:   #1E2030;
    --blue-bg2:  #25273C;
    --green-bg:  rgba(5, 150, 105, 0.15);
    --red-bg:    rgba(252, 64, 31, 0.15);
    --shadow:    0 1px 4px rgba(10,11,13,0.07), 0 4px 12px rgba(10,11,13,0.04);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; overscroll-behavior: none; }
  body {
    font-family: 'Inter', -apple-system, sans-serif;
    color: var(--text);
    -webkit-font-smoothing: antialiased;
    background: var(--bg2);
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  .dark-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .dark-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }
  .dark-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.25);
    border-radius: 3px;
  }
  .dark-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.4);
  }

  button { -webkit-tap-highlight-color: transparent; }
  button:active { transform: scale(0.97); }

  .app-bg { min-height: 100vh; background: var(--bg2); }

  .connect-bg {
    background: linear-gradient(160deg, #EBF0FF 0%, #DDEAFF 40%, #E8EEFF 100%);
  }

  /* Responsive Helpers */
  @media (max-width: 768px) {
    .desktop-only {
      display: none !important;
    }
    .mobile-only {
      display: block !important;
    }
    
    /* Hide desktop stats in header */
    .desktop-stat {
      display: none !important;
    }
    
    .desktop-only-inline {
      display: none !important;
    }
    
    .mobile-only-flex {
      display: flex !important;
    }
    
    /* Show mobile-only elements */
    .mobile-hamburger {
      display: flex !important;
    }
    
    /* Sidebar as a sliding drawer */
    aside.sidebar-container {
      position: fixed !important;
      left: -260px !important;
      top: 0 !important;
      bottom: 0 !important;
      width: 260px !important;
      height: 100vh !important;
      transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      z-index: 1000 !important;
      box-shadow: 10px 0 40px rgba(0, 0, 0, 0.6) !important;
    }
    aside.sidebar-container.open {
      left: 0 !important;
    }
    
    /* Make grids/columns stack vertically on mobile */
    .responsive-grid {
      grid-template-columns: 1fr !important;
      gap: 16px !important;
    }
    
    .responsive-flex {
      flex-direction: column !important;
      gap: 16px !important;
    }

    #main-content-scroll {
      padding: 16px 12px 64px !important;
    }

    /* Daily Raffle Mobile Adjustments */
    .raffle-hero-padding {
      padding: 24px 16px !important;
      min-height: auto !important;
    }
    .raffle-hero-title {
      font-size: 24px !important;
    }
    .raffle-stat-gap {
      gap: 16px !important;
    }
    .raffle-stat-value {
      font-size: 22px !important;
    }
    .raffle-timer-value {
      font-size: 26px !important;
    }
    .raffle-hero-badge {
      font-size: 10px !important;
      padding: 3px 8px !important;
    }
  }

  @media (min-width: 769px) {
    .desktop-only {
      display: flex !important;
    }
    .mobile-only {
      display: none !important;
    }
  }

  @keyframes fadeIn    { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
  @keyframes slideUp   { from { opacity:0; transform:translateY(100%) } to { opacity:1; transform:translateY(0) } }
  @keyframes spin      { to { transform:rotate(360deg) } }
  @keyframes bounceIn  { 0% { transform:scale(0.6);opacity:0 } 70% { transform:scale(1.06) } 100% { transform:scale(1);opacity:1 } }
  @keyframes blinkDot  { 0%,100%{opacity:1} 50%{opacity:0.25} }
  @keyframes tickPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }
`
