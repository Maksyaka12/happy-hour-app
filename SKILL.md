# Happy Hour AI Agent Skill Definition

This skill allows Bankr AI agents to autonomously interact with the Happy Hour App on Base. It equips the agent with tools to execute on-chain transactions, analyze user progress, formulate strategies to reach the Top 50 Leaderboard, and perform daily tasks to maximize airdrop allocation.

---

## 1. System Integration Details
* **Network**: Base Mainnet (Chain ID: 8453)
* **$HH Token**: `0x8235EdF32a1e10Bd1867ad622915AB613664cbA3` (18 Decimals)
* **USDC Token**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 Decimals)
* **$HH Staking Contract**: `0xFd23526111280b78FF4e7F38B1fAF5818B9c5214`
* **HappyHourHHManager (Main App)**: `0x13802fDe66BCf54BcebE2242aF0836A5Dfb45Fc8`
* **HappyHourHHRaffleVault ($HH Raffle)**: `0x3bdF461984142C473F2185B4F0F64a918B8ce49b`
* **HappyHourPaymentsVault (USDC Check-in)**: `0x7E861466bC2845C9f57051fb9652bC4a56d95542`

---

## 2. Core Capabilities & Contract Interactions

### A. $HH Staking & Unstaking
Allows the agent to deposit $HH into staking or withdraw mature stakes.
* **Staking**:
  * **Function**: `stake(uint256 _amount, uint256 _durationDays)` on `0xFd23526111280b78FF4e7F38B1fAF5818B9c5214`
  * **Durations & APR**: 7 days (103% APR) or 10 days (166% APR).
* **Unstaking**:
  * **Function**: `unstake(uint256 _positionIndex)` on `0xFd23526111280b78FF4e7F38B1fAF5818B9c5214`

### B. Daily HP Boost (Paid in $HH)
Purchases the daily multiplier/points boost.
* **Pricing**: `$0.10` USD worth of $HH tokens (calculated as `0.10 / hhPrice` on-chain or via API).
* **Execution**:
  1. Approve `HH_MANAGER_ADDRESS` to spend $HH (if allowance is low).
  2. Call `payWithHH(uint256 _amount, string _serviceType)` on `0x13802fDe66BCf54BcebE2242aF0836A5Dfb45Fc8` with `_serviceType = "boost"`.

### C. Buy & Open Boxes (Paid in $HH)
Burns $HH to get extra attempts to open Happy Boxes.
* **Pricing**: `$0.10` USD worth of $HH per attempt/box (calculated as `0.10 / hhPrice`).
* **Execution**:
  1. Approve `HH_MANAGER_ADDRESS` to spend $HH (if allowance is low).
  2. Call `burnHHForBoxes(uint256 _amount)` on `0x13802fDe66BCf54BcebE2242aF0836A5Dfb45Fc8`.

### D. $HH Raffle Entries
Enters the hourly $HH raffle.
* **Execution**:
  * Call `depositHH(uint256 _amount)` on `0x3bdF461984142C473F2185B4F0F64a918B8ce49b`.

### E. Daily Check-in (USDC)
Performs the daily login check-in.
* **Execution**:
  * Transfers exactly **`0.0001` USDC** (which is `100` atomic units, since USDC has 6 decimals) to the check-in contract `0x7E861466bC2845C9f57051fb9652bC4a56d95542`.

---

## 3. AI Reasoning & Staking Strategy Loop

The agent must execute a continuous loop following this decision matrix:

```
                  ┌──────────────────────────────┐
                  │   Fetch User Stats & Goals   │
                  └──────────────┬───────────────┘
                                 ▼
                  ┌──────────────────────────────┐
                  │ Perform Daily Check-in/Boost │
                  └──────────────┬───────────────┘
                                 ▼
                  ┌──────────────────────────────┐
                  │ Check for Unstake Positions  │
                  └──────────────┬───────────────┘
                                 ▼
                  ┌──────────────────────────────┐
                  │ Analyse Leaderboard & Quests │
                  └──────────────┬───────────────┘
                                 ▼
        ┌────────────────────────┴────────────────────────┐
        ▼                                                 ▼
┌──────────────┐                                  ┌──────────────┐
│  In Top 50?  │                                  │  Checklist?  │
└──────┬───────┘                                  └──────┬───────┘
       │                                                 │
       ├─► Yes: Maintain position & Staking              ├─► Complete missing tasks
       └─► No: Open extra boxes & increase volume         └─► Maximize allocation
```

### A. Daily Routine:
1. **Check-in & Boost**: Execute `happyHourCheckIn` and `happyHourBoost` (using $HH) every day.
2. **Claim Maturities**: Query active stakes. If any lock has expired (`block.timestamp >= endTime`), execute `unstake` and restake immediately to compound.

### B. Leaderboard Strategy (Target: Top 50)
* **Goal**: To be eligible for seasonal USDC rewards, the user must rank in the **Top 50**.
* **Action plan**:
  1. Retrieve the current user rank and points (HP) using Supabase queries.
  2. Query the points required for the 50th place.
  3. Calculate the HP gap: `gap = pointsNeeded - userPoints`.
  4. If the gap is positive and there is available $HH budget, calculate how many boxes to open: `extraBoxesNeeded = gap / averagePointsPerBox`.
  5. Spend the budget to open boxes via `burnHHForBoxes` to bridge the gap.

### C. Airdrop Checklist Multiplier Strategy
* **Goal**: Maximize the number of completed criteria on the checklist. A higher count increases the final airdrop allocation.
* **Actions**:
  - Ensure the user has at least one active staking position.
  - Complete daily/weekly box opening thresholds.
  - Make at least one $HH raffle deposit to activate the raffle participant multiplier.
  - Keep check-in streak alive (Streak Protection).

---

## 4. API & Database Queries for Strategy Calculations

To execute the reasoning loop and strategy calculations, the AI agent must query the following endpoints and database tables:

### A. Fetching $HH Token Price
* **Method**: REST HTTP GET
* **Endpoint**: `https://api.dexscreener.com/latest/dex/tokens/0x8235EdF32a1e10Bd1867ad622915AB613664cbA3`
* **JSON Path**: `pairs[0].priceUsd` (parsed as float)

### B. Supabase Database Queries
The agent can query these directly using the Supabase client (`SUPABASE_URL` and `SUPABASE_ANON` from the app config):

1. **Get Current User HP Points & Rank**:
   * **SQL Query**:
     ```sql
     -- Get user points
     SELECT points FROM users WHERE address = '0xuseraddress';
     
     -- Get user rank
     SELECT count(*) + 1 AS rank FROM users WHERE points > (SELECT points FROM users WHERE address = '0xuseraddress');
     ```
   * **JS Supabase Client**:
     ```javascript
     // Get points
     const { data: user } = await supabase.from('users').select('points').eq('address', userAddress).single();
     
     // Get rank
     const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).gt('points', user.points);
     const rank = (count || 0) + 1;
     ```

2. **Get 50th Place HP Points (Top 50 Threshold)**:
   * **SQL Query**:
     ```sql
     SELECT points FROM users ORDER BY points DESC LIMIT 1 OFFSET 49;
     ```
   * **JS Supabase Client**:
     ```javascript
     const { data } = await supabase.from('users').select('points').order('points', { ascending: false }).limit(50);
     const points50th = data[49]?.points || 0;
     ```

3. **Get Average HP Won per Box (for gap calculations)**:
   * **SQL Query**:
     ```sql
     SELECT COALESCE(avg(hp_won), 25) AS avg_hp FROM opened_boxes;
     ```
   * **JS Supabase Client**:
     ```javascript
     const { data } = await supabase.from('opened_boxes').select('hp_won');
     const avgHp = data.length > 0 ? (data.reduce((acc, b) => acc + b.hp_won, 0) / data.length) : 25;
     ```
