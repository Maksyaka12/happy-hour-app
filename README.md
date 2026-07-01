<div align="center">
  <img src="frontend/public/logo.jfif" alt="Happy Hour Logo" width="120" style="border-radius: 20%; margin-bottom: 15px;" />
  <h1>Happy Hour App on Base Mainnet</h1>
  
  <p>
    <a href="https://x.com/happyhour_base" target="_blank">
      <img src="https://img.shields.io/badge/Project_X-000000?style=for-the-badge&logo=x&logoColor=white" alt="Project X" />
    </a>
    <a href="https://x.com/mksvibe" target="_blank">
      <img src="https://img.shields.io/badge/Builder_X-000000?style=for-the-badge&logo=x&logoColor=white" alt="Builder X" />
    </a>
    <a href="https://x.com/happyhour_base/status/2056407740319138199?s=20" target="_blank">
      <img src="https://img.shields.io/badge/🎬_Watch_Promo-FF0000?style=for-the-badge&logoColor=white" alt="Promo Video" />
    </a>
  </p>

  <p>
    <a href="https://happy-hour-based.app/" target="_blank">
      <img src="https://img.shields.io/badge/Launch_Web_App-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Web App" />
    </a>
    <a href="https://happy-hour-based.app/r/" target="_blank">
      <img src="https://img.shields.io/badge/Base_App_Redirect-0052FF?style=for-the-badge&logo=base&logoColor=white" alt="Base App Redirect" />
    </a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Build_on-Base-0052FF?style=for-the-badge&logo=base&logoColor=white" alt="Base Ecosystem" />
    <img src="https://img.shields.io/badge/Powered_by-Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  </p>
</div>

<br />

> Happy Hour is a consumer loyalty app on Base App that transforms blockchain activity into a cinematic, gaming experience with seasonal USDC rewards and a luck-based chance to win USDC in daily raffles.

## 🌟 The Vision

We’ve built a based gateway where users earn points through cinematic unboxings, hourly luck-based raffles, daily streaks and daily social tasks (support creators on Base). Currently, we power hourly raffles that keep the community active. With ecosystem support, we aim to scale this into a Daily Jackpot System. 

This infrastructure directly seeds a prize pool for daily random lotteries, creating a high-frequency retention loop for the Base ecosystem. Our goal is to incentivize users to stay onchain by rewarding consistency with seasonal rewards and give everyone the opportunity to win in fully randomized hourly and daily raffles, ensuring a positive experience on Base.

**We aren't just building an app; we're building a sustainable retention engine that rewards the most loyal members and makes every hour/day on Base a chance to win.**

## 🚀 Key Features

- 🎲 **Hourly USDC Raffles:** Fully randomized, onchain raffles give chance for everyone & keeping the community engaged 24/7.
- 📦 **Cinematic Unboxings:** Gamified "Happy Boxes" dropping random points (HP) & increasing rank for seasonal USDC rewards.
- 🔥 **Daily Streaks & Quests:** Rewarding consistency and daily logins / completing tasks / create content about Base to boost ecosystem retention.
- 🏆 **Dynamic Leaderboards:** Real-time tracking of the most active and loyal community members with USDC rewards in "Season Leaderboard" and points (HP) rewards in "Daily Leaderboard".

## 🛠️ Architecture

- **Frontend:** React + Vite (Web3 integration via wagmi/viem)
- **Backend:** Supabase Edge Functions (Deno) + PostgreSQL
- **Smart Contracts:** Deployed on Base Mainnet (USDC interactions, secure vaults)
- **Automation:** Alchemy Webhooks & Supabase pg_cron

## 📂 Repository Structure

```text
happy-hour-app/
├── frontend/
│   ├── src/
│   │   ├── components/  ← Modular React UI (Leaderboard, Raffle, HappyBoxes, etc.)
│   │   ├── config/      ← Constants, Wagmi configs, and Supabase client
│   │   ├── hooks/       ← Custom Web3 & Data fetching hooks
│   │   ├── App.jsx      ← Core Layout & Tab routing
│   │   └── main.jsx     ← Entry point & Context Providers (Wagmi + QueryClient)
│   ├── index.html       
│   └── vercel.json      ← Static routing & deployment config
│
├── backend/ (Supabase Edge Functions / Deno)
│   ├── on-deposit/      ← Alchemy webhook: records onchain check-ins & deposits
│   ├── draw-round/      ← Core engine: runs hourly random payouts & selects winners
│   ├── get-state/       ← REST API: syncs active round timer/pot to the frontend
│   └── streak-reminder/ ← Automated Cron: manages user streaks & engagement
│
├── database/ (PostgreSQL)
│   ├── 001_schema.sql   ← Tables, Enums & Row Level Security (RLS) policies
│   └── 002_functions.sql← SQL Views & RPC functions
│
├── .env.example         ← Environment template
└── .gitignore           ← Security configs (blocks local .env secrets)
```

## ⚡ Quick Deploy Guide

1. **Database Setup:** Execute `database/001_schema.sql` and `002_functions.sql` in your Supabase SQL Editor.
2. **Environment:** Copy `.env.example` to `.env` and populate your secrets (never commit this file).
3. **Backend Deployment:** Deploy the `backend/` Edge Functions via the Supabase CLI.
4. **Webhooks:** Configure Alchemy Custom Webhooks to point to your `on-deposit` Edge Function.
5. **Frontend:** Deploy the `frontend/` directory to Vercel (or any static host).

---
*Built by mksvibe with 💙 for the Base Community / Ecosystem.*
