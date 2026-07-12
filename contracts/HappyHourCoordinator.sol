// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IHappyHourRaffle {
    function depositHH(uint256 amount) external;
    function tokensPerTicket() external view returns (uint256);
    function getPoolBalance() external view returns (uint256);
    function getUserTickets(address user) external view returns (uint256);
    function getCurrentRound() external view returns (uint256);
    function getRoundEndTime() external view returns (uint256);
}

interface IHappyHourDaily {
    function getPoolBalance() external view returns (uint256);
    function getPoolToken() external view returns (address);
    function getTimeUntilDraw() external view returns (uint256);
    function isEligible(address user, uint256 day) external view returns (bool);
    function getCurrentDay() external view returns (uint256);
}

interface IHappyHourPoints {
    function dailyCheckIn() external;
    function getHP(address user) external view returns (uint256);
    function getStreak(address user) external view returns (uint256);
    function getLastCheckIn(address user) external view returns (uint256);
    function isDailyEligible(address user, uint256 day) external view returns (bool);
    function getBadges(address user) external view returns (bool holder, bool staker);
    function canCheckIn(address user) external view returns (bool);
    function getUserInfo(address user) external view returns (
        uint256 hpBalance,
        uint256 currentStreak,
        uint256 longestStreakRecord,
        uint256 lastCheckInTime,
        bool holder,
        bool staker,
        uint256 lastEligible
    );
}

interface IHappyHourMembership {
    function isMember(address user) external view returns (bool);
    function getExpiry(address user) external view returns (uint256);
    function getTimeUntilExpiry(address user) external view returns (uint256);
}

interface IHappyHourStaking {
    function stake(uint256 amount, uint256 durationDays) external;
    function unstake(uint256 positionIndex) external;
    function getUserPositions(address user) external view returns (uint256[] memory);
    function userStakes(address user, uint256 index) external view returns (uint256 amount, uint256 startTime, uint256 endTime, uint256 apr, bool active);
    function totalActiveStaked(address user) external view returns (uint256);
}

contract HappyHourCoordinator is Ownable, ReentrancyGuard {
    IERC20 public immutable hhToken;
    
    IHappyHourRaffle public raffle;
    IHappyHourDaily public daily;
    IHappyHourPoints public points;
    IHappyHourMembership public membership;
    IHappyHourStaking public staking;
    
    // Premium check for automation
    mapping(address => bool) public automationEnabled;
    
    // Events
    event HappyHourAction(address indexed user, string actionType, uint256 amount, uint256 timestamp);
    event ContractSet(string name, address indexed contractAddress);
    event AutomationToggled(address indexed user, bool enabled);
    
    constructor(address _hhToken) Ownable(msg.sender) {
        hhToken = IERC20(_hhToken);
    }
    
    // Admin: set contract addresses
    function setRaffle(address _raffle) external onlyOwner {
        raffle = IHappyHourRaffle(_raffle);
        emit ContractSet("raffle", _raffle);
    }
    
    function setDaily(address _daily) external onlyOwner {
        daily = IHappyHourDaily(_daily);
        emit ContractSet("daily", _daily);
    }
    
    function setPoints(address _points) external onlyOwner {
        points = IHappyHourPoints(_points);
        emit ContractSet("points", _points);
    }
    
    function setMembership(address _membership) external onlyOwner {
        membership = IHappyHourMembership(_membership);
        emit ContractSet("membership", _membership);
    }
    
    function setStaking(address _staking) external onlyOwner {
        staking = IHappyHourStaking(_staking);
        emit ContractSet("staking", _staking);
    }
    
    // Premium / membership check
    function isPremium(address user) external view returns (bool) {
        if (address(membership) == address(0)) return false;
        return membership.isMember(user);
    }
    
    // Toggle automation for user (called by backend after verification)
    function setAutomation(address user, bool enabled) external onlyOwner {
        automationEnabled[user] = enabled;
        emit AutomationToggled(user, enabled);
    }
    
    function canAutomate(address user) external view returns (bool) {
        return automationEnabled[user] && this.isPremium(user);
    }
    
    // ====== USER ACTIONS ======
    
    // Deposit to raffle (single entry point)
    function depositToRaffle(uint256 amount) external nonReentrant {
        require(address(raffle) != address(0), "Raffle not set");
        require(amount >= raffle.tokensPerTicket(), "Min 1 ticket");
        
        hhToken.transferFrom(msg.sender, address(this), amount);
        hhToken.approve(address(raffle), amount);
        raffle.depositHH(amount);
        
        emit HappyHourAction(msg.sender, "raffle_deposit", amount, block.timestamp);
    }
    
    // Daily check-in
    function dailyCheckIn() external {
        require(address(points) != address(0), "Points not set");
        points.dailyCheckIn();
        emit HappyHourAction(msg.sender, "checkin", 1, block.timestamp);
    }
    
    // Stake HH
    function stakeHH(uint256 amount, uint256 durationDays) external nonReentrant {
        require(address(staking) != address(0), "Staking not set");
        require(durationDays == 7 || durationDays == 10, "Invalid duration");
        
        hhToken.transferFrom(msg.sender, address(this), amount);
        hhToken.approve(address(staking), amount);
        staking.stake(amount, durationDays);
        
        emit HappyHourAction(msg.sender, "stake", amount, block.timestamp);
    }
    
    // Unstake
    function unstakeHH(uint256 positionIndex) external {
        require(address(staking) != address(0), "Staking not set");
        staking.unstake(positionIndex);
        emit HappyHourAction(msg.sender, "unstake", positionIndex, block.timestamp);
    }
    
    // ====== BATCH ACTIONS (for automation) ======
    
    // Batch: check-in + raffle deposit (gas efficient)
    function dailyRoutine(uint256 raffleAmount) external nonReentrant {
        require(address(points) != address(0), "Points not set");
        require(address(raffle) != address(0), "Raffle not set");
        
        // Check-in
        points.dailyCheckIn();
        emit HappyHourAction(msg.sender, "checkin", 1, block.timestamp);
        
        // Raffle deposit if amount > 0
        if (raffleAmount > 0) {
            hhToken.transferFrom(msg.sender, address(this), raffleAmount);
            hhToken.approve(address(raffle), raffleAmount);
            raffle.depositHH(raffleAmount);
            emit HappyHourAction(msg.sender, "raffle_deposit", raffleAmount, block.timestamp);
        }
    }
    
    // ====== VIEW FUNCTIONS (single source of truth for agents) ======
    
    function getUserSummary(address user) external view returns (
        uint256 hp,
        uint256 streak,
        uint256 lastCheckInTime,
        bool canCheckInToday,
        bool holderBadge,
        bool stakerBadge,
        uint256 raffleTickets,
        uint256 rafflePool,
        uint256 dailyPool,
        address dailyToken,
        uint256 timeUntilDailyDraw,
        bool dailyEligible,
        bool isClubMember,
        uint256 membershipExpiry,
        uint256 totalStaked
    ) {
        if (address(points) != address(0)) {
            (hp, streak, , lastCheckInTime, holderBadge, stakerBadge, ) = points.getUserInfo(user);
            canCheckInToday = points.canCheckIn(user);
        }
        
        if (address(raffle) != address(0)) {
            raffleTickets = raffle.getUserTickets(user);
            rafflePool = raffle.getPoolBalance();
        }
        
        if (address(daily) != address(0)) {
            dailyPool = daily.getPoolBalance();
            dailyToken = daily.getPoolToken();
            timeUntilDailyDraw = daily.getTimeUntilDraw();
            dailyEligible = daily.isEligible(user, daily.getCurrentDay());
        }
        
        if (address(membership) != address(0)) {
            isClubMember = membership.isMember(user);
            membershipExpiry = membership.getExpiry(user);
        }
        
        if (address(staking) != address(0)) {
            totalStaked = staking.totalActiveStaked(user);
        }
    }
    
    function getRaffleInfo() external view returns (
        uint256 pool,
        uint256 ticketPrice,
        uint256 currentRound,
        uint256 roundEndTime
    ) {
        if (address(raffle) != address(0)) {
            pool = raffle.getPoolBalance();
            ticketPrice = raffle.tokensPerTicket();
            currentRound = raffle.getCurrentRound();
            roundEndTime = raffle.getRoundEndTime();
        }
    }
    
    function getDailyInfo() external view returns (
        uint256 pool,
        address token,
        uint256 timeUntilDraw,
        uint256 currentDay
    ) {
        if (address(daily) != address(0)) {
            pool = daily.getPoolBalance();
            token = daily.getPoolToken();
            timeUntilDraw = daily.getTimeUntilDraw();
            currentDay = daily.getCurrentDay();
        }
    }
    
    function getStakingInfo(address user) external view returns (
        uint256 totalActive,
        uint256[] memory positions
    ) {
        if (address(staking) != address(0)) {
            totalActive = staking.totalActiveStaked(user);
            positions = staking.getUserPositions(user);
        }
    }
    
    // ====== ADMIN ======
    
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
    
    // Allow direct token rescue
    function rescueETH() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    receive() external payable {}
}
