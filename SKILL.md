---
name: Happy Hour App Interaction Skill
description: Skill enabling Bankr AI agents to autonomously interact with the Happy Hour application on Base (check-ins, daily boosts, box openings, staking, and raffle entry).
---

# Happy Hour AI Agent Skill Definition

This skill allows Bankr AI agents to autonomously interact with the Happy Hour App on Base. It equips the agent with a comprehensive tool library of on-chain transactions, Supabase queries, and database sync RPCs, alongside a complete knowledge base of the game's economy rules.

---

## 1. System Integration Details
* **Network**: Base Mainnet (Chain ID: `8453`)
* **$HH Token**: `0x8235EdF32a1e10Bd1867ad622915AB613664cbA3` (18 decimals)
* **USDC Token**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimals)
* **$HH Staking Contract**: `0xFd23526111280b78FF4e7F38B1fAF5818B9c5214`
* **HappyHourHHManager (Main App)**: `0x13802fDe66BCf54BcebE2242aF0836A5Dfb45Fc8`
* **HappyHourHHRaffleVault ($HH Raffle)**: `0x3bdF461984142C473F2185B4F0F64a918B8ce49b`
* **HappyHourPaymentsVault (Check-in target)**: `0x7E861466bC2845C9f57051fb9652bC4a56d95542`
* **Foundation Address**: `0xdE76F43E17B1173947f63b72C85a2f0d9a97702F`

---

## 2. On-Chain Actions & Off-Chain Database Sync
To execute actions, first calculate the required $HH amounts using the current USD price (e.g. from DexScreener).

### A. $HH Spend Allowance (Approval)
Prior to paying with $HH, the agent must check allowance and approve spending:
* **Token Contract**: `$HH Token`
* **Function**: `approve(address spender, uint256 value)`
* **Parameters**: 
  - `spender`: `HH_MANAGER_ADDRESS` (for boosts and box openings) or `HH_RAFFLE_VAULT_ADDRESS` (for raffles) or `STAKING_ADDRESS` (for staking).
  - `value`: Recommended to set to max uint256 (`115792089237316195423570985008687907853269984665640564039457584007913129639935`).

### B. Daily Check-in (USDC)
Performs the daily login check-in:
1. **On-chain transaction**: Call `transfer(CHECKIN_TARGET, 100)` on `USDC Token` (exactly `0.0001` USDC, 6 decimals).
2. **Off-chain database sync**: Call Supabase RPC `process_checkin` with:
   ```json
   { "p_address": "0xuseraddress", "p_tx_hash": "0xtxhash" }
   ```

### C. Daily HP Boost (Paid in $HH)
Purchases the daily 2x multiplier/points boost:
1. **On-chain transaction**: Call `payWithHH(uint256 _amount, string _serviceType)` on `HH_MANAGER_ADDRESS`.
   - `_amount`: `(0.10 / hhPrice) * 10^18`
   - `_serviceType`: `"boost"`
2. **Off-chain database sync**: Call Supabase RPC `process_hp_boost_hh` with:
   ```json
   { "p_address": "0xuseraddress", "p_tx_hash": "0xtxhash" }
   ```

### D. Open Happy Boxes (Paid in $HH)
Opens boxes to claim random HP points:
* **Single Box Opening**:
  1. **On-chain transaction**: Call `payWithHH(uint256 _amount, string _serviceType)` on `HH_MANAGER_ADDRESS`.
     - `_amount`: `(0.20 / hhPrice) * 10^18`
     - `_serviceType`: `"box_open"`
  2. **Off-chain database sync**: Call Supabase RPC `open_standard_chest_hh` with:
     ```json
     { "p_address": "0xuseraddress", "p_tx_hash": "0xtxhash" }
     ```
* **Bundle Box Opening (6 boxes)**:
  1. **On-chain transaction**: Call `payWithHH(uint256 _amount, string _serviceType)` on `HH_MANAGER_ADDRESS`.
     - `_amount`: `(1.00 / hhPrice) * 10^18`
     - `_serviceType`: `"box_bundle"`
  2. **Off-chain database sync**: Call Supabase RPC `open_all_chests_hh` with:
     ```json
     { "p_address": "0xuseraddress", "p_tx_hash": "0xtxhash" }
     ```
* **Buy Extra Attempts**:
  1. **On-chain transaction**: Call `burnHHForBoxes(uint256 _amount)` on `HH_MANAGER_ADDRESS`.
     - `_amount`: `(0.10 / hhPrice) * 10^18`
  2. **Off-chain database sync**: Call Supabase RPC `burn_hh_for_boxes` with:
     ```json
     { "p_address": "0xuseraddress", "p_tx_hash": "0xtxhash", "p_amount": hhAmountFloat }
     ```

### E. $HH Staking & Unstaking
Deposits $HH into staking or withdraws matured stakes:
* **Staking**:
  1. **On-chain transaction**: Call `stake(uint256 _amount, uint256 _durationDays)` on `STAKING_ADDRESS`.
     - `_durationDays`: `7` or `10`.
  2. **Off-chain database sync**: Call Supabase RPC `add_staked_cumulative` with:
     ```json
     { "p_address": "0xuseraddress", "p_amount": amountFloat }
     ```
* **Unstaking**:
  - **On-chain transaction**: Call `unstake(uint256 _positionIndex)` on `STAKING_ADDRESS`. No manual database sync RPC is required.

### F. $HH Raffle Entries
Enters the hourly $HH raffle:
- **On-chain transaction**: Call `depositHH(uint256 _amount)` on `HH_RAFFLE_VAULT_ADDRESS`.
- No database sync RPC is required (it is automatically indexed by the backend service within 3 seconds).

---

## 3. Happy Hour Economy & Rules
The AI agent should refer to these rules when explaining points or formulating advice:

* **Daily Check-in**: Awarded `1.0` HP.
* **Daily Boost**: Awarded `2.0` HP.
* **Box Openings**: Awarded a random amount between `2.0` and `5.0` HP per box.
* **Holding $HH**: Passive reward of `10%` of the wallet's $HH USD value per day (capped at $100 holding value, which yields a maximum of `10.0` HP per day).
* **Staking $HH**: Passive reward of `20%` of the staked $HH USD value per day (capped at $100 staked value, which yields a maximum of `20.0` HP per day).
* **Approved Posts**: Submission of a Twitter post link yields `2.0` HP upon admin approval.
* **Raffle wins**: Yields raffle prize (USDC or $HH) + `1.0` HP base.
* **Staking APR**: 7 days lock (103% APR) or 10 days lock (166% APR).
* **Season 2 End**: July 22, 2026 at 19:52:00 UTC.

### Season 2 Airdrop Eligibility Checklist:
To qualify for the $HH Airdrop, the user must meet all required checklist targets:
1. **Daily Check-ins**: 10+ check-ins.
2. **Daily HP Boosts**: 10+ boosts activated.
3. **Social Tasks**: 20+ social tasks completed.
4. **Box Openings**: 20+ boxes opened.
5. **$HH Burn in Boxes**: 10+ times burned $HH in boxes.
6. **$HH Holding Duration**: Hold 17M+ $HH for 10+ days.
7. **Raffle Entries**: Participate in 10+ raffles.
8. **Successful Raids**: Complete 5+ successful raids (coming soon).
* *Multiplier criteria*: Cumulative staking of 40M+ $HH or inviting 3+ active referrals (with 5+ txs each) awards a distribution multiplier.

---

## 4. Supabase Database Schema & Queries
The agent can query Supabase to inspect the user's exact state, history, rank, or checklist progress.

### A. Core Database Tables
* **`users`**: tracks `address`, `points` (HP), `streak`, `streak_last`, `boost_last`, `total_spent`, `referrer`, `referral_count`.
* **`checkins`**: tracks check-in events (`address`, `checked_date`, `tx_hash`, `points`).
* **`hp_boosts`**: tracks daily boosts (`address`, `boost_date`, `tx_hash`, `points`, `is_hh`).
* **`opened_boxes`**: tracks box openings (`address`, `box_type`, `hp_won`, `applied_multiplier`, `tx_hash`, `is_hh`).
* **`task_completions`**: tracks completed tasks (`task_id`, `address`, `completed_at`).
* **`bets`**: tracks raffle entries (`round_id`, `address`, `amount`, `tickets`, `tx_hash`).
* **`user_activity`**: a consolidated view combining all user actions that awarded or deducted HP.

### B. JavaScript Supabase Client Queries

#### 1. Fetch User Points and Leaderboard Rank
```javascript
// Fetch user HP points
const { data: user } = await supabase.from('users').select('points').eq('address', userAddress).single();

// Calculate rank (1-indexed)
const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).gt('points', user.points);
const rank = (count || 0) + 1;
```

#### 2. Get Top 50 Leaderboard USDC Eligibility Threshold
```javascript
// Fetch points needed for 50th position
const { data } = await supabase.from('users').select('points').order('points', { ascending: false }).limit(50);
const points50th = data[49]?.points || 0;
const isEligibleForUsdc = user.points >= points50th;
```

#### 3. Fetch User's Point/HP History (Activity Log)
```javascript
const { data: activity } = await supabase
  .from('user_activity')
  .select('action, badge, value, created_at')
  .eq('address', userAddress)
  .order('created_at', { ascending: false })
  .limit(20);
```

#### 4. Fetch User's Airdrop Checklist Stats
Primary method is invoking the database RPC:
```javascript
const { data: criteria, error } = await supabase.rpc('get_user_distribution_criteria', { p_address: userAddress });
```
Fallback query if the RPC fails or is missing:
```javascript
const { data: criteriaData } = await supabase.from('hh_distribution_criteria').select('*').eq('address', userAddress).maybeSingle();
const { count: checkinsCount } = await supabase.from('checkins').select('*', { count: 'exact', head: true }).eq('address', userAddress);
const { count: boostsCount } = await supabase.from('hp_boosts').select('*', { count: 'exact', head: true }).eq('address', userAddress);
const { count: boxesCount } = await supabase.from('opened_boxes').select('*', { count: 'exact', head: true }).eq('address', userAddress).not('box_type', 'in', '("standard_bundle","happy_bundle","shield","extra_attempt")');
const { count: hhBurnBoxesCount } = await supabase.from('opened_boxes').select('*', { count: 'exact', head: true }).eq('address', userAddress).eq('is_hh', true).not('box_type', 'in', '("standard_bundle","happy_bundle","shield","extra_attempt")');
const { count: rafflesCount } = await supabase.from('bets').select('*', { count: 'exact', head: true }).eq('address', userAddress);

const stats = {
  checkins: (checkinsCount || 0) + (criteriaData?.adjust_checkins || 0),
  boosts: (boostsCount || 0) + (criteriaData?.adjust_boosts || 0),
  boxes: (boxesCount || 0) + (criteriaData?.adjust_boxes || 0),
  hhBurnBoxes: (hhBurnBoxesCount || 0) + (criteriaData?.adjust_hh_burn_boxes || 0),
  raffles: (rafflesCount || 0) + (criteriaData?.adjust_raffles || 0),
  holdingDays: (criteriaData?.holding_days || 0) + (criteriaData?.adjust_holding_days || 0),
  stakedCumulative: parseFloat(criteriaData?.staked_cumulative || 0) + parseFloat(criteriaData?.adjust_staked_cumulative || 0)
};
```

---

## 5. Public REST API Endpoints (Supabase REST & Edge Functions)
If you need to make HTTP REST requests instead of using the Supabase client library, use the following endpoints:

* **Base URL**: `https://xiyrzftdeefszsiukkjc.supabase.co`
* **Headers**:
  * `apikey`: `sb_publishable_C1OnF0Bi-L1hcIsPfQ8_BQ_-eT3XLzK`
  * `Authorization`: `Bearer sb_publishable_C1OnF0Bi-L1hcIsPfQ8_BQ_-eT3XLzK`
  * `Content-Type`: `application/json`

### A. GET `/functions/v1/get-state?address={wallet}&currency=HH`
Returns the user profile, active raffle details, participants list, and Top 50 leaderboard:
* **Response format**:
  ```json
  {
    "user": { "address": "0xwallet", "points": 120.0, "streak": 5, "boost_last": "2026-06-27" },
    "leaders": [ { "address": "0x...", "points": 500.0, "streak": 12 } ],
    "round": { "id": 123, "status": "open", "ends_at": "2026-06-27T04:00:00Z" }
  }
  ```

### B. GET `/rest/v1/users?select=points&order=points.desc&offset=49&limit=1`
Returns the points value of the 50th rank (USDC Eligibility threshold):
* **Response format**:
  ```json
  [ { "points": 345.5 } ]
  ```

### C. POST `/rest/v1/rpc/get_user_distribution_criteria`
Returns the checklist statistics for the wallet:
* **Body**: `{"p_address": "0xwallet"}`
* **Response format**:
  ```json
  {
    "checkins": 12,
    "boosts": 10,
    "boxes": 24,
    "holding_days": 15,
    "staked_cumulative": "45000000.00",
    "referrals": 4,
    "social_tasks": 21,
    "hh_burn_boxes": 11,
    "raffles": 14
  }
  ```

### D. Action Registration (POST endpoints)
Register on-chain actions in the database after transaction confirmation:
* **POST `/rest/v1/rpc/process_checkin`** (USDC Check-in)
  * Body: `{"p_address": "0xwallet", "p_tx_hash": "0xtxhash"}`
* **POST `/rest/v1/rpc/process_hp_boost_hh`** ($HH Daily Boost)
  * Body: `{"p_address": "0xwallet", "p_tx_hash": "0xtxhash"}`
* **POST `/rest/v1/rpc/add_staked_cumulative`** ($HH Staking amount registration)
  * Body: `{"p_address": "0xwallet", "p_amount": stakedAmountFloat}`
* **POST `/rest/v1/rpc/burn_hh_for_boxes`** ($HH extra box attempts registration)
  * Body: `{"p_address": "0xwallet", "p_tx_hash": "0xtxhash", "p_amount": hhAmountFloat}`

---

## 6. Autonomy & Reasoning Guidelines
The agent is designed to act with high autonomy:
1. **No Static Strategy**: Do not default to a single hardcoded loop. Every user has a different budget, $HH balance, and objectives.
2. **Analysis & Diagnostics**: Inspect the user's rank, checklist progress, and active stakes before offering a custom recommendation.
3. **Dialogue**: Communicate details clearly when asked ("What is my rank?", "How many points do I need to reach Top 50?", "Am I eligible for the airdrop?").
4. **Execution**: Perform any requested payment action or staking plan securely and update database state immediately after transaction receipts are received.