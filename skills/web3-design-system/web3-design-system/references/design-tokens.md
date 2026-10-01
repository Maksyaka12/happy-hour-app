# Design Tokens — принципи, не готовий бренд

Ці значення — стартова структура. `--accent` заміни на фірмовий колір проєкту; все інше (шкала
радіусів, spacing, типографічний ритм) — переноситься як є, це і є "мова пропорцій" зі скіла.

## Заокруглення (масштабується за розміром — див. SKILL.md §2)

```css
:root {
  --radius-xs: 8px;
  --radius-sm: 12px;
  --radius-md: 18px;
  --radius-lg: 26px;
  --radius-xl: 36px;
  --radius-pill: 999px;
}
```

## Кольори — структура (заміни accent на свій)

```css
:root {
  /* Light mode */
  --light-bg: #FFFFFF;
  --light-surface: #F7F8FB;
  --light-text: #0B0E1A;
  --light-text-secondary: #6B7280;
  --light-hero-card: #C3CDF6;      /* приклад пастельного blob-фону — заміни на свій акцент у 15-20% насиченості */

  /* Dark mode */
  --dark-bg: #05070D;              /* не чистий #000, легкий кольоровий підтон */
  --dark-surface: #0D1420;
  --dark-elevated: #16202E;
  --dark-text: #F5F5F7;
  --dark-text-secondary: rgba(245,245,247,0.55);
  --dark-border: rgba(255,255,255,0.08);

  /* Signature accent — заміни ці два значення на фірмовий колір продукту */
  --accent: #2B5CFF;
  --accent-glow: rgba(43, 92, 255, 0.30);

  /* Semantic */
  --success: #34D399;
  --error: #F87171;
  --warning: #FBBF24;

  /* Chrome/metal gradient для hero-чисел */
  --chrome-gradient: linear-gradient(180deg, #FFFFFF 0%, #CBD5E8 35%, #7F97C4 55%, #FFFFFF 75%, #B9C7E0 100%);
}
```

## Типографіка

```css
--font-display: 'Archivo Black', 'Anton', 'General Sans', sans-serif; /* hero, H1, жирні заголовки */
--font-accent: 'Playfair Display', 'Canela', serif;                   /* italic — 1-2 фрази на екран */
--font-body: 'Inter', 'Geist', -apple-system, sans-serif;             /* UI, параграфи */
--font-mono: 'JetBrains Mono', 'IBM Plex Mono', monospace;            /* лише tx hash / адреси */
```

```css
--text-hero: clamp(2.5rem, 8vw, 6rem);
--text-h1:   clamp(1.75rem, 4vw, 2.75rem);
--text-h2:   1.375rem;   /* різкий стрибок від h1 — не плавна прогресія */
--text-h3:   1.125rem;
--text-body: 1rem;
--text-small:0.875rem;
--text-micro:0.75rem;
```

## Spacing (8px база, щедрі hero-відступи)

```css
--space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
--space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px; --space-9: 96px;
```

## Motion

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--duration-fast: 150ms;
--duration-base: 200ms;
--duration-count-up: 1000ms;
--duration-marquee: 22s;
```

## Готові компоненти

### Primary button (pill, glow)
```css
.btn-primary {
  background: var(--accent);
  color: #fff;
  border-radius: var(--radius-pill);
  padding: 14px 28px;
  font-family: var(--font-display);
  font-weight: 800;
  transition: transform var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 32px var(--accent-glow);
}
```

### Card
```css
.card {
  background: var(--dark-surface);
  border: 1px solid var(--dark-border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  transition: border-color var(--duration-base) var(--ease-out), transform var(--duration-base) var(--ease-out);
}
.card:hover { border-color: rgba(255,255,255,0.16); transform: translateY(-2px); }
```

### Hero blob-картка (light mode промо-блок)
```css
.hero-blob {
  background: var(--light-hero-card);
  border-radius: var(--radius-xl);
  padding: var(--space-7) var(--space-6);
}
```

### Chrome hero-число
```css
.chrome-number {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: var(--text-hero);
  background: var(--chrome-gradient);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  -webkit-text-stroke: 1.5px rgba(10,14,26,0.85);
  filter: drop-shadow(0 4px 0 rgba(10,14,26,0.5)) drop-shadow(0 10px 24px var(--accent-glow));
}
```

### Мікс-вага для hero-балансу (не хром, для звичайних сум)
```html
<span class="balance">
  <span class="balance__symbol">$</span><span class="balance__int">0</span><span class="balance__dec">.88</span>
</span>
```
```css
.balance__symbol { font-weight: 300; opacity: 0.6; }
.balance__int { font-weight: 900; }
.balance__dec { font-weight: 500; opacity: 0.85; }
```

### Live pulse indicator
```css
.live-dot {
  width: 8px; height: 8px; border-radius: 50%; background: var(--success);
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(52,211,153,0.5); }
  70% { box-shadow: 0 0 0 10px rgba(52,211,153,0); }
  100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
}
```

### Marquee (стрічка живої активності)
```css
.ticker-track { display: flex; gap: 24px; white-space: nowrap; animation: scroll-left var(--duration-marquee) linear infinite; }
@keyframes scroll-left { from { transform: translateX(0); } to { transform: translateX(-50%); } }
```

### Quick-action grid tile
```css
.action-tile {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  background: var(--dark-surface); border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-3);
}
.action-tile__icon { width: 20px; height: 20px; color: var(--dark-text); }
.action-tile__label { font-size: var(--text-small); color: var(--dark-text); font-weight: 600; }
```

### Asset list row
```css
.asset-row { display: flex; align-items: center; justify-content: space-between; padding: var(--space-3) 0; gap: var(--space-3); }
.asset-row__left { display: flex; align-items: center; gap: var(--space-3); }
.asset-row__avatar { position: relative; width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; }
.asset-row__badge {
  position: absolute; right: -2px; bottom: -2px; width: 18px; height: 18px;
  border-radius: 50%; border: 2px solid var(--dark-bg);
}
.asset-row__name { font-weight: 700; color: var(--dark-text); display: flex; align-items: center; gap: 4px; }
.asset-row__sub { font-size: var(--text-small); color: var(--dark-text-secondary); }
.asset-row__right { text-align: right; }
.asset-row__price { font-weight: 700; color: var(--dark-text); }
.asset-row__change--up { color: var(--success); font-size: var(--text-small); }
.asset-row__change--down { color: var(--error); font-size: var(--text-small); }
```

### Filter chip row
```css
.chip-row { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
.chip { display: flex; align-items: center; gap: 6px; white-space: nowrap;
  border-radius: var(--radius-pill); padding: 10px 16px;
  background: rgba(255,255,255,0.05); color: var(--dark-text-secondary); font-weight: 600; }
.chip--active { background: rgba(255,255,255,0.10); color: var(--dark-text); }
.chip__icon { color: var(--accent); } /* іконки чіпів — акцентним кольором, не мультиколор */
```

### Sidebar nav (desktop web-app)
```css
.sidebar-nav { display: flex; flex-direction: column; gap: 4px; width: 220px; padding: var(--space-4); }
.sidebar-nav__item { display: flex; align-items: center; gap: 10px; padding: 10px 14px;
  border-radius: var(--radius-md); color: var(--dark-text-secondary); font-weight: 600; }
.sidebar-nav__item--active { color: var(--dark-text); background: rgba(255,255,255,0.06); }
.sidebar-nav__cta { border-radius: var(--radius-pill); background: #fff; color: #000;
  font-weight: 700; padding: 12px 20px; text-align: center; margin-top: var(--space-3); }
```

### Item card-grid (marketplace-style collection)
```css
.item-card { border-radius: var(--radius-lg); overflow: hidden; background: var(--dark-surface); }
.item-card__thumb { position: relative; aspect-ratio: 1; width: 100%; }
.item-card__badges { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; }
.item-card__badge { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--dark-surface); }
```

### Quantity stepper (кількість квитків/токенів)
```css
.stepper { display: flex; align-items: center; justify-content: center; gap: var(--space-5); }
.stepper__btn { width: 40px; height: 40px; border-radius: 50%; background: var(--dark-elevated);
  display: flex; align-items: center; justify-content: center; font-weight: 700; }
.stepper__value { font-size: var(--text-h1); font-weight: 800; min-width: 60px; text-align: center; }
.preset-row { display: flex; gap: 8px; }
.preset-row button { border-radius: var(--radius-pill); padding: 8px 18px; font-weight: 600;
  background: rgba(255,255,255,0.05); }
.preset-row button.active { background: var(--dark-elevated); border: 1px solid var(--accent); }
```

### Decorative orbit rings (dark hero, desktop)
```css
.hero-orbit { position: absolute; inset: 0; pointer-events: none; }
.hero-orbit::before, .hero-orbit::after {
  content: ''; position: absolute; top: 50%; left: 50%; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.06); transform: translate(-50%, -50%);
}
.hero-orbit::before { width: 600px; height: 600px; }
.hero-orbit::after { width: 900px; height: 900px; }
```

### Floating bottom nav (mobile)
```css
.bottom-nav {
  position: fixed; bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  left: 16px; right: 16px; border-radius: var(--radius-pill);
  background: rgba(13,20,32,0.92); backdrop-filter: blur(20px);
  border: 1px solid var(--dark-border);
  display: flex; justify-content: space-around; padding: 10px 8px;
}
.bottom-nav .active { background: var(--accent); border-radius: var(--radius-pill); padding: 8px 14px; }
```
