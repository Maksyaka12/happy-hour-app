# Happy Hour Skill

This skill allows Bankr to interact with the Happy Hour App on Base. Happy Hour is a consumer app with seasonal rewards, staking, daily activities, and hourly raffles.

## Integration Details
- **Token ($HH)**: 0x8235EdF32a1e10Bd1867ad622915AB613664cbA3 (Base)
- **Staking Contract**: 0xFd23526111280b78FF4e7F38B1fAF5818B9c5214 (Base)
- **Main App Contract**: 0x13802fDe66BCf54BcebE2242aF0836A5Dfb45Fc8 (Base)
- **Raffle Contract**: 0x3bdF461984142C473F2185B4F0F64a918B8ce49b (Base)
- **Check-in Contract**: 0x7E861466bC2845C9f57051fb9652bC4a56d95542 (Base)

## Capabilities

### Staking $HH
Stake your $HH tokens for a specific duration to earn HP points and APR.
- **Action**: `stake $HH`
- **Contract**: 0xFd23526111280b78FF4e7F38B1fAF5818B9c5214
- **Function**: `stake(uint256 _amount, uint256 _durationDays)`
- **Durations**: 7 days (103% APR) or 10 days (166% APR).
- **Auto-unstake**: Bankr can automatically unstake when the staking period ends.

### Unstaking $HH
Withdraw your staked $HH after the lock period.
- **Action**: `unstake $HH position N` or `unstake happy hour position N`
- **Contract**: 0xFd23526111280b78FF4e7F38B1fAF5818B9c5214
- **Function**: `unstake(uint256 _positionIndex)`

### Daily Check-in
Perform your daily check-in to maintain your streak and earn HP points.
- **Action**: `happy hour check-in`
- **Contract**: 0x7E861466bC2845C9f57051fb9652bC4a56d95542
- **Note**: Free transaction (0 USDC transfer to check-in contract)

### Join Raffle
Participate in the hourly raffles using $HH.
- **Action**: `join happy hour raffle $X`
- **Contract**: 0x3bdF461984142C473F2185B4F0F64a918B8ce49b
- **Function**: `depositHH(uint256 _amount)`
- **Amounts**: 0.1, 0.5, 1, 3, 5, 10 USD (converted to $HH at current price)

### Open Boxes
Burn $HH to open reward boxes.
- **Action**: `open happy hour boxes`
- **Contract**: 0x13802fDe66BCf54BcebE2242aF0836A5Dfb45Fc8
- **Function**: `burnHHForBoxes(uint256 _amount)`

### Pay for Service
Use $HH to pay for in-app services.
- **Action**: `pay with $HH`
- **Contract**: 0x13802fDe66BCf54BcebE2242aF0836A5Dfb45Fc8
- **Function**: `payWithHH(uint256 _amount, string _serviceType)`

### View Status
Check your HP points, leaderboard position, and staking status.
- **Action**: `show my happy hour status`

## Automation
- **Auto Check-in**: Bankr can perform daily check-ins automatically.
- **Auto Unstake**: Bankr monitors staking positions and automatically unstakes when the lock period ends.
- **Auto Re-stake**: Bankr can re-stake unlocked $HH to maintain APR rewards.