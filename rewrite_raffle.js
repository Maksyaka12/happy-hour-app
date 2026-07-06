const fs = require('fs');
const file = 'frontend/src/components/RaffleSection.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Variables
content = content.replace(
`  const accentColor = isHH ? '#3B82F6' : '#10B981'
  const lightAccentColor = isHH ? '#60A5FA' : '#34D399'
  const timerColor = isClosed ? '#FC401F' : '#FFFFFF'
  const gradientColor = isHH 
    ? 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)' 
    : 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
  const glowColor = isHH ? 'rgba(59, 130, 246, 0.25)' : 'rgba(16, 185, 129, 0.25)'
  const hueFilter = isHH
    ? 'hue-rotate(0deg) brightness(0.4) contrast(1.15)' 
    : 'hue-rotate(200deg) brightness(0.4) contrast(1.15)'

  const heroHueFilter = isHH
    ? 'hue-rotate(0deg) brightness(0.68) contrast(1.1)' 
    : 'hue-rotate(200deg) brightness(0.68) contrast(1.1)'

  const cardBg = 'linear-gradient(135deg, rgba(28,29,44,0.95) 0%, rgba(28,29,44,0.85) 100%), url(/banner.jpg) center/cover'
  const heroCardBg = 'linear-gradient(135deg, rgba(28,29,44,0.95) 0%, rgba(28,29,44,0.85) 100%), url(/banner.jpg) center/cover'
  const cardBorder = '1px solid var(--border)'
  const cardShadow = '0 4px 12px rgba(0,0,0,0.1)'`,
`  const accentColor = '#0000FF'
  const lightAccentColor = '#0000FF'
  const timerColor = isClosed ? '#FC401F' : '#FFFFFF'
  const gradientColor = 'transparent'
  const glowColor = 'transparent'
  const hueFilter = 'none'

  const heroHueFilter = 'none'

  const cardBg = 'rgba(23, 25, 35, 0.65)'
  const heroCardBg = 'rgba(23, 25, 35, 0.65)'
  const cardBorder = '1px solid rgba(255, 255, 255, 0.05)'
  const cardShadow = 'none'`);

// 2. Toggles
content = content.replace(
`            background: isHH ? '#3B82F6' : 'transparent',
            color: isHH ? '#fff' : '#717886',
            fontWeight: 850,`,
`            background: isHH ? '#0000FF' : '#222533',
            color: isHH ? '#fff' : '#717886',
            fontWeight: 600,`);

content = content.replace(
`            background: !isHH ? '#3B82F6' : 'transparent',
            color: !isHH ? '#fff' : '#717886',
            fontWeight: 850,`,
`            background: !isHH ? '#0000FF' : '#222533',
            color: !isHH ? '#fff' : '#717886',
            fontWeight: 600,`);

// 3. Hero card styling (Add backdropFilter and change border-radius)
content = content.replace(
`          {/* Hero card */}
          <div style={{
            background: heroCardBg,
            border: cardBorder,
            borderRadius: 20,
            padding: '20px 18px 16px',
            marginBottom: 12,
            boxShadow: cardShadow,
            position: 'relative',
            overflow: 'hidden'
          }}>`,
`          {/* Hero card */}
          <div style={{
            background: heroCardBg,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: cardBorder,
            borderRadius: 16,
            padding: '20px 18px 16px',
            marginBottom: 12,
            boxShadow: cardShadow,
            position: 'relative',
            overflow: 'hidden'
          }}>`);

// 4. Remove Radial Glows in Hero Card
content = content.replace(
`            {/* White overlay dot */}
            <div style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.06) 0%, transparent 70%)',
              pointerEvents: 'none'
            }} />

            {/* Colored radial gradient glow */}
            <div style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: isHH
                ? 'radial-gradient(circle, rgba(59, 130, 246, 0.22) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(20, 184, 166, 0.22) 0%, transparent 70%)',
              pointerEvents: 'none',
              zIndex: 1
            }} />`,
`            {/* Glows removed */}`);

// 5. Daily Raffle Hero Card radial glow
content = content.replace(
`            {/* Colored radial gradient glow */}
            <div style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16, 184, 166, 0.22) 0%, transparent 70%)',
              pointerEvents: 'none',
              zIndex: 1
            }} />`,
`            {/* Glow removed */}`);

// 6. Daily Raffle Hero card border-radius
content = content.replace(
`          {/* Daily Raffle Hero Card */}
          <div style={{
            background: heroCardBg,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: cardBorder,
            borderRadius: 20,
            padding: '20px 18px 16px',
            marginBottom: 12,
            boxShadow: cardShadow,
            position: 'relative',
            overflow: 'hidden'
          }}>`,
`          {/* Daily Raffle Hero Card */}
          <div style={{
            background: heroCardBg,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: cardBorder,
            borderRadius: 16,
            padding: '20px 18px 16px',
            marginBottom: 12,
            boxShadow: cardShadow,
            position: 'relative',
            overflow: 'hidden'
          }}>`);

// 7. Status Pill
content = content.replace(
`              <span style={{
                background: isClosed ? 'rgba(252, 64, 31, 0.1)' : \`\${glowColor.replace('0.25', '0.08')}\`,
                color: isClosed ? '#FC401F' : '#FFFFFF',
                padding: '3px 8px',
                borderRadius: 8,
                fontSize: 10,
                fontWeight: 800,
                border: isClosed ? '1px solid rgba(252, 64, 31, 0.25)' : \`1px solid rgba(255, 255, 255, 0.25)\`,
                fontFamily: "'Outfit', 'Inter', sans-serif"
              }}>`,
`              <span style={{
                background: isClosed ? 'rgba(252, 64, 31, 0.1)' : 'rgba(5, 150, 105, 0.15)',
                color: isClosed ? '#FC401F' : '#059669',
                height: 24,
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 8px',
                borderRadius: 8,
                fontSize: 10,
                fontWeight: 600,
                border: isClosed ? '1px solid rgba(252, 64, 31, 0.25)' : '1px solid rgba(5, 150, 105, 0.25)',
                fontFamily: "'Outfit', 'Inter', sans-serif"
              }}>`);

// 8. Eligibility card and other containers border-radius and backdrop
// Eligibility Card
content = content.replace(
`          {/* Eligibility Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: 20,
            padding: '16px 18px 14px',
            marginBottom: 12,
            boxShadow: '0 8px 32px rgba(10,11,13,0.05)',
            border: isDailyEligible ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>`,
`          {/* Eligibility Card */}
          <div style={{
            background: cardBg,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: 16,
            padding: '16px 18px 14px',
            marginBottom: 12,
            border: isDailyEligible ? '1px solid rgba(16, 185, 129, 0.35)' : cardBorder,
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>`);

// Position card
content = content.replace(
`          {/* My position */}
          {displayMyEntry && (
            <div style={{
              background: cardBg,
              border: cardBorder, 
              borderLeft: \`4px solid \${accentColor}\`,
              borderRadius: 14,
              padding: '12px 16px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: cardShadow,
            }}>`,
`          {/* My position */}
          {displayMyEntry && (
            <div style={{
              background: cardBg,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: cardBorder, 
              borderLeft: \`4px solid \${accentColor}\`,
              borderRadius: 16,
              padding: '12px 16px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: cardShadow,
            }}>`);

// Bet buttons neon glow and background (line 745ish)
content = content.replace(
`              {BET_OPTS.map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => onBetClick(a)}
                  disabled={isClosed || isPending || isConfirming}
                  style={{
                    background: gradientColor, 
                    border: 'none',
                    borderRadius: 12,
                    padding: '12px 6px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    boxShadow: \`0 4px 14px \${glowColor.replace('0.25', '0.2')}\`, 
                    cursor: 'pointer',
                    opacity: isClosed ? 0.45 : 1,
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}>`,
`              {BET_OPTS.map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => onBetClick(a)}
                  disabled={isClosed || isPending || isConfirming}
                  style={{
                    background: '#0000FF', 
                    border: 'none',
                    borderRadius: 12,
                    padding: '12px 6px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    boxShadow: 'none', 
                    cursor: 'pointer',
                    opacity: isClosed ? 0.45 : 1,
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}>`);

// How it works box
content = content.replace(
`        <div style={{
          background: cardBg,
          border: cardBorder,
          borderRadius: 16,
          padding: '16px 18px',
          boxShadow: cardShadow,
        }}>`,
`        <div style={{
          background: cardBg,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: cardBorder,
          borderRadius: 16,
          padding: '16px 18px',
          boxShadow: cardShadow,
        }}>`);

// Participants box
content = content.replace(
`              <div style={{
                background: cardBg,
                border: cardBorder,
                borderTop: \`3px solid \${accentColor}\`,
                borderRadius: 14,
                overflow: 'hidden',
                boxShadow: cardShadow,
              }}>`,
`              <div style={{
                background: cardBg,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: cardBorder,
                borderTop: \`3px solid \${accentColor}\`,
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: cardShadow,
              }}>`);

// Last Winner Box
content = content.replace(
`          <div style={{
            background: cardBg,
            border: cardBorder,
            borderTop: \`3px solid \${accentColor}\`,
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: cardShadow,
          }}>`,
`          <div style={{
            background: cardBg,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: cardBorder,
            borderTop: \`3px solid \${accentColor}\`,
            borderRadius: 16,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: cardShadow,
          }}>`);

// Font-weights "Change font-weight to 400 (Regular) or 500 (Medium). Remove any 700 (Bold) from long description blocks."
// "How it works" texts
content = content.replace(
`            <div key={i} style={{ marginBottom: i < arr.length - 1 ? 14 : 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: '#FFFFFF', marginBottom: 4, fontFamily: "'Outfit', 'Inter', sans-serif" }}>{q}</div>
              <div style={{ fontSize: 10, color: '#A0AEC0', lineHeight: 1.6, fontWeight: 500, fontFamily: "'Outfit', 'Inter', sans-serif" }}>{a}</div>
            </div>`,
`            <div key={i} style={{ marginBottom: i < arr.length - 1 ? 14 : 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#FFFFFF', marginBottom: 4, fontFamily: "'Outfit', 'Inter', sans-serif" }}>{q}</div>
              <div style={{ fontSize: 10, color: '#A0AEC0', lineHeight: 1.6, fontWeight: 400, fontFamily: "'Outfit', 'Inter', sans-serif" }}>{a}</div>
            </div>`);

// Sub-headers typography (should be 14-16px/600, titles 24px/600)
// For example "Round #${displayRound?.id ?? '—'} Raffle"
content = content.replace(
`              <div style={{ fontSize: 14.5, fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.2px', textTransform: 'uppercase', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                Round #{displayRound?.id ?? '—'} Raffle
              </div>`,
`              <div style={{ fontSize: 16, fontWeight: 600, color: '#FFFFFF', letterSpacing: '0.2px', textTransform: 'uppercase', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                Round #{displayRound?.id ?? '—'} Raffle
              </div>`);

content = content.replace(
`              <div style={{ fontSize: 14.5, fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.2px', textTransform: 'uppercase', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                Daily Raffle · Round #{dailyRound}
              </div>`,
`              <div style={{ fontSize: 16, fontWeight: 600, color: '#FFFFFF', letterSpacing: '0.2px', textTransform: 'uppercase', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                Daily Raffle · Round #{dailyRound}
              </div>`);

// Top Titles like "Place Your Bet"
content = content.replace(
`            <div style={{
              fontFamily: "'Outfit', 'Inter', sans-serif",
              fontSize: 11.5,
              color: '#4A5568',
              fontWeight: 800,
              letterSpacing: '0.6px',
              marginBottom: 8,
              textTransform: 'uppercase'
            }}>
              Place Your Bet
            </div>`,
`            <div style={{
              fontFamily: "'Outfit', 'Inter', sans-serif",
              fontSize: 14,
              color: '#A0A5B5',
              fontWeight: 600,
              letterSpacing: '0.6px',
              marginBottom: 8,
              textTransform: 'uppercase'
            }}>
              Place Your Bet
            </div>`);

content = content.replace(
`              <div style={{
                fontFamily: "'Outfit', 'Inter', sans-serif",
                fontSize: 11.5,
                color: '#4A5568',
                fontWeight: 800,
                letterSpacing: '0.6px',
                marginBottom: 8,
                textTransform: 'uppercase'
              }}>
                Participants
              </div>`,
`              <div style={{
                fontFamily: "'Outfit', 'Inter', sans-serif",
                fontSize: 14,
                color: '#A0A5B5',
                fontWeight: 600,
                letterSpacing: '0.6px',
                marginBottom: 8,
                textTransform: 'uppercase'
              }}>
                Participants
              </div>`);

content = content.replace(
`          <div style={{
            fontFamily: "'Outfit', 'Inter', sans-serif",
            fontSize: 11.5,
            color: '#4A5568',
            fontWeight: 800,
            letterSpacing: '0.6px',
            marginBottom: 8,
            textTransform: 'uppercase'
          }}>
            Last Winner
          </div>`,
`          <div style={{
            fontFamily: "'Outfit', 'Inter', sans-serif",
            fontSize: 14,
            color: '#A0A5B5',
            fontWeight: 600,
            letterSpacing: '0.6px',
            marginBottom: 8,
            textTransform: 'uppercase'
          }}>
            Last Winner
          </div>`);

content = content.replace(
`        <div style={{
          fontFamily: "'Outfit', 'Inter', sans-serif",
          fontSize: 11.5,
          color: '#4A5568',
          fontWeight: 800,
          letterSpacing: '0.6px',
          marginBottom: 8,
          textTransform: 'uppercase'
        }}>
          How it works
        </div>`,
`        <div style={{
          fontFamily: "'Outfit', 'Inter', sans-serif",
          fontSize: 14,
          color: '#A0A5B5',
          fontWeight: 600,
          letterSpacing: '0.6px',
          marginBottom: 8,
          textTransform: 'uppercase'
        }}>
          How it works
        </div>`);

// Add tabular nums to numerical elements
// Need to find the exact line for: "Add this property to the numerical elements: font-variant-numeric: tabular-nums;"
// Usually prices or round numbers. Let's just do a global replace for numbers styling that are large.
// Examples:
content = content.replace(
`                  <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'baseline', gap: 4, fontFamily: "'Outfit', 'Inter', sans-serif" }}>`,
`                  <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'baseline', gap: 4, fontFamily: "'Outfit', 'Inter', sans-serif", fontVariantNumeric: 'tabular-nums' }}>`);

content = content.replace(
`                  <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'baseline', gap: 4, fontFamily: "'Outfit', 'Inter', sans-serif" }}>`,
`                  <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'baseline', gap: 4, fontFamily: "'Outfit', 'Inter', sans-serif", fontVariantNumeric: 'tabular-nums' }}>`);

fs.writeFileSync(file, content);
console.log('Replacements complete.');
