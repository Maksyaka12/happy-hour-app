# Happy Hour AI Consumer Platform — Infrastructure Plan

## 1. Six Pillars of Infrastructure

| # | Component | Status | Notes |
|---|-----------|--------|-------|
| 1 | Frontend (Web + Base Mini App) | Exists, upgrading | Add Happy Bot chat, X link, Club |
| 2 | Backend (Supabase) | Exists, optimizing | Query counter, automations, X-links, event indexer |
| 3 | On-chain Contracts | Partial | Staking stays, new raffle/points/membership/coordinator/daily |
| 4 | @happyhourbot (X Agent) | To create | Branded agent, knows platform, executes on-chain |
| 5 | Skill (happy-hour-agent) | To create | For external agents to read state and execute |
| 6 | x402 Endpoints | To create | 6-8 paid APIs for autonomous agent access |

---

## 2. On-Chain Contract Architecture

### 2.1 Existing Contract (Keep As-Is)
- **Staking**: `0xFd23526111280b78FF4e7F38B1fAF5818B9c5214`
  - `stake(amount, durationDays)` — 7 or 10 days
  - `unstake(positionIndex)`
  - `getUserPositions(user)`
  - `userStakes(user, index)` — amount, startTime, endTime, apr, active
  - `totalActiveStaked(user)`
  - `hhToken()`

### 2.2 New Contracts to Deploy

#### `HappyHourRaffle` — Hourly Raffles
- `depositHH(amount)` — deposit $HH, receive tickets
- `tokensPerTicket` — cached price (~$0.10 equivalent), updated periodically
- `getPoolBalance()` — current pool size
- `getUserTickets(user, round)` — tickets for user in round
- `getCurrentRound()` — current round number
- `getRoundEndTime()` — when current round ends
- `distributePrize(winner, winnerAmount, burnAmount)` — operator only
- Events: `Deposit(user, amount, tickets, round)`, `WinnerDrawn(round, winner, prize, burned)`
- 15% burn on prize distribution

#### `HappyHourDaily` — Daily Raffle
- `recordParticipation(user)` — called by Raffle contract when user buys ticket
- `drawWinner()` — callable by anyone, uses Chainlink VRF
- `getPoolBalance()` — current daily pool
- `getParticipants(round)` — list of eligible users
- `getParticipantTicketCount(user, round)` — weighted entries
- `fundPool(token, amount)` — sponsor deposits prize tokens
- `getPoolToken()` — current prize token (default $HH)
- Events: `ParticipationRecorded(user, round)`, `DailyWinnerDrawn(round, winner, prize, token)`, `PoolFunded(sponsor, token, amount)`

#### `HappyHourPoints` — HP, Check-ins, Streaks, Badges
- `dailyCheckIn()` — +1 HP, updates streak
- `getHP(user)` — total HP
- `getStreak(user)` — current streak
- `getLastCheckIn(user)` — timestamp
- `getDailyEligible(user, day)` — eligible for daily raffle?
- `recordRaffleDeposit(user, amount)` — called by Coordinator, adds HP based on deposit tier
- `addHolderBonus(user)` — +5 HP/day if 100M+ $HH balance
- `addStakerBonus(user)` — +10 HP/day if 100M+ $HH staked
- `getBadge(user)` — none / holder / staker
- `adminAddHP(user, amount)` — admin only
- Events: `CheckIn(user, newHP, streak, timestamp)`, `HPAccrued(user, amount, source)`, `BadgeGranted(user, badge)`

#### `HappyHourMembership` — Happy Club
- `subscribe(token, amount)` — pay in $HH / USDC / ETH (~$10 equivalent)
- `isMember(user)` — returns true/false
- `getExpiry(user)` — membership expiration
- `setPrice(token, amount)` — admin sets token prices
- Events: `Subscribed(user, token, amount, expiry)`

#### `HappyHourCoordinator` — Single Entry Point for Agents
- `raffle`, `daily`, `points`, `membership`, `staking` — contract addresses
- `depositToRaffle(amount)` — transfers $HH, calls raffle.deposit(), records participation, adds HP
- `dailyCheckIn()` — calls points.dailyCheckIn()
- `stakeHH(amount, days)` — calls staking.stake()
- `unstakeHH(index)` — calls staking.unstake()
- `isPremium(user)` — alias for membership.isMember()
- `getUserSummary(user)` — aggregated: HP, streak, tickets, stakes, membership
- `executeAction(actionType, params)` — generic router for agent actions
- Events: `HappyHourAction(user, actionType, amount, timestamp)`

---

## 3. HP (Happy Points) Logic

### 3.1 Earning HP

| Action | HP Reward |
|--------|-----------|
| Daily check-in | +1 HP |
| Streak 7 days | +3 HP bonus |
| Streak 14 days | +7 HP bonus |
| Streak 30 days | +15 HP bonus |
| Raffle deposit $0.10–$10 (1–100 tickets) | +1 HP |
| Raffle deposit $10.01–$50 (101–500 tickets) | +2 HP |
| Raffle deposit $50.01–$100 (501–1000 tickets) | +3 HP |
| Raffle deposit $100.01+ (1001+ tickets) | +5 HP |
| Happy Holder badge (100M+ $HH balance) | +5 HP/day |
| Happy Staker badge (100M+ $HH staked) | +10 HP/day |

### 3.2 Badges & Win Chance Boosts

| Badge | Requirement | Daily HP | Raffle Boost |
|-------|-------------|----------|--------------|
| None | — | — | — |
| Happy Holder | 100M+ $HH in wallet | +5 HP/day | +2% win chance |
| Happy Staker | 100M+ $HH in staking | +10 HP/day | +5% win chance |

### 3.3 Win Chance Mechanics

**Hourly raffle:**
- Base: tickets / total_tickets
- Holder: base * 1.02
- Staker: base * 1.05
- If both: base * 1.07 (additive)

**Daily raffle:**
- Same boost applies to weighted ticket count
- Participation requirement: bought at least 1 hourly ticket that day

---

## 4. Happy Club Membership

### 4.1 Pricing
- Fixed: ~$10 USD equivalent
- Payable in: $HH, USDC, ETH
- Admin updates `tokenPrice[token]` when market moves

### 4.2 Benefits
| Feature | Free User | Happy Club Member |
|---------|-----------|-------------------|
| Bot queries per day | 5 | Unlimited |
| Automation (auto-checkin, auto-raffle, auto-stake) | No | Yes |
| Priority support | No | Yes |

### 4.3 Query Counter (Off-Chain in Supabase)
- Table: `user_queries(wallet, date, count, platform)`
- Platforms: app_chat, x_dm, telegram
- Shared counter across all platforms
- Resets at 00:00 UTC
- Checked before every bot interaction

---

## 5. Daily Raffle Mechanics

### 5.1 Default Mode (Sponsored by Happy Hour)
- Admin calls `daily.fundPool(HH, amount)` each day
- Pool token = $HH
- Winner receives entire pool

### 5.2 Partner Sponsorship Mode
- Partner calls `daily.fundPool(PARTNER_TOKEN, amount)`
- UI shows: "Sponsored by [Partner Name]"
- Winner receives partner tokens
- Partner can add conditions (e.g., follow their X, join their Telegram)
- Conditions verified off-chain, eligibility stored in Supabase
- Contract only checks: `dailyEligible[user] == true`

### 5.3 Drawing Process
1. At 00:00 UTC, anyone can call `daily.drawWinner()`
2. Contract requests Chainlink VRF random number (~$0.50)
3. VRF callback selects winner based on weighted tickets
4. Winner receives pool tokens
5. New round starts automatically

---

## 6. Hourly Raffle Mechanics

### 6.1 Ticket Pricing
- `tokensPerTicket` cached in contract
- Updated by keeper/admin periodically (e.g., daily)
- No oracle call during deposit

### 6.2 Deposit Flow
```
User deposits 333,000 HH
Contract: tickets = 333,000 / tokensPerTicket = 1
Emit Deposit(user, 333000, 1, round)
Call daily.recordParticipation(user) — marks eligible for daily
Call points.recordRaffleDeposit(user, 333000) — adds +1 HP
```

### 6.3 Prize Distribution
- 85% to winner
- 15% burned
- Operator (backend) calls `distributePrize()`
- Or: automate via keeper

---

## 7. @happyhourbot & In-App Happy Bot

### 7.1 Shared Brain, Two Interfaces

| | Happy Bot (In-App) | @happyhourbot (X) |
|---|-------------------|-------------------|
| Wallet connection | Already connected via Privy/WC | Linked X handle → wallet via API |
| On-chain execution | Direct | Session key or deeplink to sign |
| Query counter | Shared | Shared |
| Automation setup | UI + chat | DM commands |

### 7.2 X Linking Flow
1. In Happy Hour app: Settings → Link X Account
2. Sign message with wallet
3. OAuth with X
4. Supabase stores: `x_links(wallet, x_handle, verified)`
5. @happyhourbot queries `/link?handle=alice` → gets wallet

### 7.3 Bot Knowledge Base
- All contract addresses and ABIs
- HP logic, staking APR, raffle mechanics
- Current pool sizes, times, winners
- How to buy Happy Club
- How to link X
- Strategies (when to stake, optimal deposit sizes)

### 7.4 Automation (Happy Club Only)
User says: "auto: checkin daily at 23:55, deposit 10 HH in raffle every hour, restake after 10 days"
- Bot verifies `membership.isMember(wallet)`
- If no: "Join Happy Club to enable automations"
- If yes: stores rule in Supabase + AppKV
- Cron executes via Bankr automation engine

---

## 8. Skill for External Agents

### 8.1 File: `happy-hour-agent.md`

Contents:
- Platform overview
- Contract addresses and ABIs
- x402 endpoint URLs
- How to read: raffle pool, user tickets, HP, streak, stakes, membership
- How to execute: deposit, checkin, stake, unstake
- Automation rule format
- Example prompts

### 8.2 What External Agents Can Do
- Read all platform state via x402 endpoints
- Execute on-chain actions via coordinator
- Set up automations (if user has Happy Club)
- Monitor pools and notify user

---

## 9. x402 Endpoints (6-8 APIs)

| Endpoint | Method | Description | Price |
|----------|--------|-------------|-------|
| `/hh/raffle` | GET | Current pool, ticket price, time left, your tickets | $0.01 |
| `/hh/daily` | GET | Daily pool, participants, your eligibility, time to draw | $0.01 |
| `/hh/points/:wallet` | GET | HP, streak, last checkin, badges | $0.01 |
| `/hh/staking/:wallet` | GET | Active stakes, rewards, unlock times | $0.01 |
| `/hh/membership/:wallet` | GET | Club status, expiry | $0.01 |
| `/hh/execute` | POST | Execute action (deposit, checkin, stake, unstake) | $0.05 |
| `/hh/campaigns` | GET | Active campaigns, conditions, rewards | $0.01 |
| `/hh/info` | GET | TVL, APR, contract addresses, general stats | Free |

---

## 10. Implementation Phases

### Phase 1: Core Contracts
1. Deploy `HappyHourPoints`
2. Deploy `HappyHourMembership`
3. Deploy `HappyHourRaffle` (v2 with full read functions + events)
4. Deploy `HappyHourDaily`
5. Deploy `HappyHourCoordinator`
6. Wire coordinator to all contracts

### Phase 2: Backend & Indexer
1. Event indexer (WebSocket RPC or Alchemy webhooks)
2. Supabase tables: users, queries, automations, x_links, campaigns
3. API endpoints for bot query counter, X linking
4. Keeper script for `tokensPerTicket` updates

### Phase 3: Frontend Upgrade
1. Happy Bot chat interface
2. X account linking
3. Happy Club purchase flow
4. Automation setup UI
5. Daily raffle partner sponsorship display

### Phase 4: x402 Endpoints
1. Deploy all 6-8 endpoints
2. Test with sample agent queries

### Phase 5: @happyhourbot
1. Create X account
2. Generate X API keys
3. Write personality + storyline files
4. Set up cron automations for posting
5. Implement DM command parser
6. Link to on-chain execution (session keys)

### Phase 6: Skill Publication
1. Write `happy-hour-agent.md`
2. Test with external agent
3. Publish to Bankr skill registry

---

## 11. Open Questions / Next Steps

1. **VRF or backend randomness for daily?** Chainlink VRF is trustless but costs ~$0.50/draw. Backend is free but requires trust.
2. **Who calls `daily.drawWinner()`?** Incentivize keepers with small HH reward?
3. **Partner condition verification?** Off-chain oracle (e.g., did user follow @bankr on X)?
4. **Exact $HH token address?** Needed for coordinator and all contracts.

---

*Plan version: 1.0*
*Created: 2026-07-04*
*Platform: Happy Hour AI Consumer Platform*
