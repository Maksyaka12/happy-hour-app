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
    --bg:        #FFFFFF;
    --bg2:       #F8F9FC;
    --bg3:       #EEF0F3;
    --text:      #0A0B0D;
    --text2:     #32353D;
    --muted:     #717886;
    --border:    #DEE1E7;
    --border2:   #EEF0F3;
    --blue-bg:   #EEF0F3;
    --blue-bg2:  #F0F5FF;
    --green-bg:  #D1FAE5;
    --red-bg:    #FEE2E2;
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

  @keyframes fadeIn    { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
  @keyframes slideUp   { from { opacity:0; transform:translateY(100%) } to { opacity:1; transform:translateY(0) } }
  @keyframes spin      { to { transform:rotate(360deg) } }
  @keyframes bounceIn  { 0% { transform:scale(0.6);opacity:0 } 70% { transform:scale(1.06) } 100% { transform:scale(1);opacity:1 } }
  @keyframes blinkDot  { 0%,100%{opacity:1} 50%{opacity:0.25} }
  @keyframes tickPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }
`
