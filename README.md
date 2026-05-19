# 🍹 Happy Hour Based

![Base Ecosystem](https://img.shields.io/badge/Build_on-Base-0052FF?style=for-the-badge&logo=base&logoColor=white)
![Supabase](https://img.shields.io/badge/Powered_by-Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

> Happy Hour is a consumer loyalty platform on Base that transforms blockchain activity into a cinematic, gaming experience with seasonal USDC rewards.

## 🌟 The Vision

We’ve built a based gateway where users earn points through cinematic unboxings, hourly luck-based raffles, and daily streaks. Currently, we power hourly raffles that keep the community active. With ecosystem support, we aim to scale this into a Daily Jackpot System. 

This infrastructure directly seeds a prize pool for daily random lotteries, creating a high-frequency retention loop for the Base ecosystem. Our goal is to incentivize users to stay onchain by rewarding consistency with seasonal rewards and give everyone the opportunity to win in fully randomized hourly and daily raffles, ensuring a positive experience on Base.

**We aren't just building an app; we're building a sustainable retention engine that rewards the most loyal members and makes every hour/day on Base a chance to win.**

## 🚀 Key Features

- 🎲 **Hourly USDC Raffles:** Fully randomized, onchain raffles keeping the community engaged 24/7.
- 📦 **Cinematic Unboxings:** Gamified "Happy Boxes" dropping random USDC rewards.
- 🔥 **Daily Streaks & Quests:** Rewarding consistency and daily logins to boost ecosystem retention.
- 🏆 **Dynamic Leaderboards:** Real-time tracking of the most active and loyal community members.

## 🛠️ Architecture

- **Frontend:** React + Vite (Web3 integration via wagmi/viem)
- **Backend:** Supabase Edge Functions (Deno) + PostgreSQL
- **Smart Contracts:** Deployed on Base Mainnet (USDC interactions, secure vaults)
- **Automation:** Alchemy Webhooks & Supabase pg_cron

## 📂 Repository Structure

```text
happy-hour/
├── frontend/
│   ├── src/             ← React UI, Web3 components, and animations
│   ├── index.html       ← App entry point
│   └── vercel.json      ← Vercel deployment configuration
│
├── backend/
│   ├── on-deposit/      ← Alchemy webhook processor (records bets)
│   ├── draw-round/      ← Raffle execution and payout logic
│   └── get-state/       ← REST API for real-time frontend sync
│
├── database/
│   ├── 001_schema.sql   ← Core tables & Row Level Security (RLS)
│   └── 002_functions.sql← SQL triggers and cron jobs
│
└── .env.example         ← Environment template
```

## ⚡ Quick Deploy Guide

1. **Database Setup:** Execute `database/001_schema.sql` and `002_functions.sql` in your Supabase SQL Editor.
2. **Environment:** Copy `.env.example` to `.env` and populate your secrets (never commit this file).
3. **Backend Deployment:** Deploy the `backend/` Edge Functions via the Supabase CLI.
4. **Webhooks:** Configure Alchemy Custom Webhooks to point to your `on-deposit` Edge Function.
5. **Frontend:** Deploy the `frontend/` directory to Vercel (or any static host).

---
*Built with 💙 for the Base Ecosystem.*
