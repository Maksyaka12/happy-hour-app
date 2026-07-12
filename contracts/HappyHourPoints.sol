// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

interface IStaking {
    function totalActiveStaked(address user) external view returns (uint256);
}

/**
 * @title HappyHourPoints
 * @dev Tracks HP (Happy Points), daily check-ins, streaks, and badges.
 *      Integrates with staking contract for Happy Staker badge.
 *      Designed for agentic reads: HP, streak, badges, eligibility.
 */
contract HappyHourPoints {
    address public owner;
    address public operator;
    address public stakingContract;
    address public hhToken;

    // HP balances
    mapping(address => uint256) public hp;

    // Check-in tracking
    mapping(address => uint256) public lastCheckIn;
    mapping(address => uint256) public streak;
    mapping(address => uint256) public maxStreak;

    // Daily raffle eligibility (set by coordinator)
    mapping(uint256 => mapping(address => bool)) public dailyEligible;

    // Badge thresholds
    uint256 public constant HOLDER_THRESHOLD = 100_000_000 * 10**18; // 100M HH
    uint256 public constant STAKER_THRESHOLD = 100_000_000 * 10**18; // 100M HH staked

    // HP rewards
    uint256 public constant CHECKIN_HP = 1;
    uint256 public constant STREAK_7_BONUS = 3;
    uint256 public constant STREAK_14_BONUS = 7;
    uint256 public constant STREAK_30_BONUS = 15;
    uint256 public constant HOLDER_DAILY_HP = 5;
    uint256 public constant STAKER_DAILY_HP = 10;

    // Events
    event CheckIn(address indexed user, uint256 newHP, uint256 streak, uint256 bonus);
    event HPAccrued(address indexed user, uint256 amount, string source);
    event BadgeGranted(address indexed user, string badge);
    event DailyEligibleMarked(uint256 indexed day, address indexed user);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized: Owner only");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner, "Not authorized: Operator only");
        _;
    }

    constructor(address _stakingContract, address _hhToken) {
        owner = msg.sender;
        operator = msg.sender;
        stakingContract = _stakingContract;
        hhToken = _hhToken;
    }

    /**
     * @dev Daily check-in. Gives +1 HP, streak bonuses, and badge daily HP.
     *      Can be called by user directly or via coordinator.
     */
    function checkIn() external {
        require(block.timestamp >= lastCheckIn[msg.sender] + 1 days, "Already checked in today");

        uint256 bonus = 0;
        uint256 newStreak = 1;

        // Streak logic
        if (block.timestamp < lastCheckIn[msg.sender] + 2 days) {
            newStreak = streak[msg.sender] + 1;
        }

        streak[msg.sender] = newStreak;
        if (newStreak > maxStreak[msg.sender]) {
            maxStreak[msg.sender] = newStreak;
        }

        // Streak bonuses
        if (newStreak >= 30) {
            bonus = STREAK_30_BONUS;
        } else if (newStreak >= 14) {
            bonus = STREAK_14_BONUS;
        } else if (newStreak >= 7) {
            bonus = STREAK_7_BONUS;
        }

        // Base check-in + streak bonus
        uint256 totalGain = CHECKIN_HP + bonus;

        // Badge daily HP
        if (isHappyStaker(msg.sender)) {
            totalGain += STAKER_DAILY_HP;
        } else if (isHappyHolder(msg.sender)) {
            totalGain += HOLDER_DAILY_HP;
        }

        hp[msg.sender] += totalGain;
        lastCheckIn[msg.sender] = block.timestamp;

        emit CheckIn(msg.sender, hp[msg.sender], newStreak, bonus);
    }

    /**
     * @dev Accrue HP from raffle deposits. Called by coordinator.
     * @param user Address to receive HP.
     * @param depositAmount HH token amount deposited (for tier calculation).
     */
    function accrueRaffleHP(address user, uint256 depositAmount) external onlyOperator {
        uint256 hpGain = _calculateRaffleHP(depositAmount);
        hp[user] += hpGain;
        emit HPAccrued(user, hpGain, "raffle_deposit");
    }

    /**
     * @dev Admin function to add HP manually (for campaigns, corrections).
     * @param user Address to receive HP.
     * @param amount HP amount to add.
     * @param reason Description for indexing.
     */
    function adminAddHP(address user, uint256 amount, string calldata reason) external onlyOwner {
        hp[user] += amount;
        emit HPAccrued(user, amount, reason);
    }

    /**
     * @dev Mark user as eligible for daily raffle. Called by coordinator.
     */
    function markDailyEligible(address user, uint256 day) external onlyOperator {
        dailyEligible[day][user] = true;
        emit DailyEligibleMarked(day, user);
    }

    // ==================== HP TIERS ====================

    function _calculateRaffleHP(uint256 depositAmount) internal pure returns (uint256) {
        // tiers based on $0.10 ticket price (248632 HH at current rate)
        // tier 1: 0.1-10$ (1-100 tickets) = +1 HP
        // tier 2: 10.01-50$ (101-500 tickets) = +2 HP
        // tier 3: 50.01-100$ (501-1000 tickets) = +3 HP
        // tier 4: 100.01$+ (1001+ tickets) = +5 HP

        uint256 tickets = depositAmount / 248632; // approximate, coordinator passes exact

        if (tickets >= 1001) return 5;
        if (tickets >= 501) return 3;
        if (tickets >= 101) return 2;
        return 1;
    }

    // ==================== BADGE CHECKS ====================

    function isHappyHolder(address user) public view returns (bool) {
        return IERC20(hhToken).balanceOf(user) >= HOLDER_THRESHOLD;
    }

    function isHappyStaker(address user) public view returns (bool) {
        if (stakingContract == address(0)) return false;
        return IStaking(stakingContract).totalActiveStaked(user) >= STAKER_THRESHOLD;
    }

    function getUserBadges(address user) external view returns (string[] memory) {
        bool holder = isHappyHolder(user);
        bool staker = isHappyStaker(user);

        string[] memory badges = new string[](2);
        uint256 count = 0;

        if (holder) {
            badges[count] = "Happy Holder";
            count++;
        }
        if (staker) {
            badges[count] = "Happy Staker";
            count++;
        }

        // Resize array
        string[] memory result = new string[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = badges[i];
        }
        return result;
    }

    // ==================== READ FUNCTIONS ====================

    function getHP(address user) external view returns (uint256) {
        return hp[user];
    }

    function getStreak(address user) external view returns (uint256) {
        return streak[user];
    }

    function getMaxStreak(address user) external view returns (uint256) {
        return maxStreak[user];
    }

    function getLastCheckIn(address user) external view returns (uint256) {
        return lastCheckIn[user];
    }

    function canCheckIn(address user) external view returns (bool) {
        return block.timestamp >= lastCheckIn[user] + 1 days;
    }

    function isDailyEligible(uint256 day, address user) external view returns (bool) {
        return dailyEligible[day][user];
    }

    function getNextStreakBonus(address user) external view returns (uint256) {
        uint256 current = streak[user];
        if (current >= 29) return STREAK_30_BONUS;
        if (current >= 13) return STREAK_14_BONUS;
        if (current >= 6) return STREAK_7_BONUS;
        return 0;
    }

    // ==================== ADMIN ====================

    function setStakingContract(address _staking) external onlyOwner {
        stakingContract = _staking;
    }

    function setOperator(address _newOperator) external onlyOwner {
        require(_newOperator != address(0), "Invalid operator");
        operator = _newOperator;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid owner");
        owner = _newOwner;
    }
}
