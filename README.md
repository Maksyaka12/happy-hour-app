# Happy Hour 🍹

Hourly USDC raffle mini app on Base.

## Repo Structure

```
happy-hour/
├── frontend/
│   ├── app.jsx          ← весь UI (React, без збірки)
│   ├── index.html       ← точка входу
│   └── vercel.json      ← конфіг Vercel (static deploy)
│
├── backend/
│   ├── on-deposit/
│   │   └── index.ts     ← Alchemy webhook → записує ставки
│   ├── draw-round/
│   │   └── index.ts     ← розіграш + виплата переможцю
│   └── get-state/
│       └── index.ts     ← REST: стан раунду для фронтенду
│
├── database/
│   ├── 001_schema.sql   ← таблиці + RLS
│   └── 002_functions.sql← SQL функції + cron команди
│
├── .env.example         ← шаблон змінних
├── .gitignore
└── README.md
```

## Quick Deploy

1. Supabase: запусти `database/001_schema.sql`, потім `002_functions.sql`
2. Supabase Secrets: додай всі змінні з `.env.example`
3. Supabase Edge Functions: задеплой `backend/` функції через веб редактор
4. Alchemy: створи webhook на свій Smart Wallet адрес
5. Vercel: підключи репо, Root Directory = `frontend/`
