// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

/**
 * @title HappyHourDaily
 * @dev Daily raffle using Chainlink VRF for provably fair winner selection.
 *      Pool is funded by the founder/operator. Supports multi-token partner pools.
 */
contract HappyHourDaily is VRFConsumerBaseV2 {
    address public owner;
    address public operator;

    // VRF config
    address public vrfCoordinator;
    bytes32 public keyHash;
    uint64 public subscriptionId;
    uint16 public requestConfirmations = 3;
    uint32 public callbackGasLimit = 200000;
    uint32 public numWords = 1;

    // Round tracking
    uint256 public currentRound;
    uint256 public roundStartTime;
    uint256 public roundDuration = 1 days;

    // Pool token (default: HH, but can be partner token)
    IERC20 public poolToken;
    uint256 public poolAmount;
    string public sponsorName; // e.g., "Happy Hour" or "Bankr"

    // Eligibility: users who bought >=1 hourly raffle ticket today
    mapping(uint256 => mapping(address => bool)) public dailyEligible;
    mapping(uint256 => address[]) public eligibleUsers;
    mapping(uint256 => mapping(address => uint256)) public userTicketCount; // weighted by tickets

    // VRF request tracking
    mapping(uint256 => uint256) public requestToRound;
    mapping(uint256 => bool) public roundCompleted;

    // Events
    event DailyDeposit(address indexed funder, uint256 amount, string sponsor);
    event UserMarkedEligible(uint256 indexed round, address indexed user, uint256 tickets);
    event RandomnessRequested(uint256 indexed round, uint256 requestId);
    event DailyWinnerDrawn(uint256 indexed round, address winner, uint256 prize);
    event RoundStarted(uint256 indexed round, uint256 startTime, uint256 endTime);
    event PoolTokenUpdated(address oldToken, address newToken);
    event SponsorUpdated(string oldSponsor, string newSponsor);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized: Owner only");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner, "Not authorized: Operator only");
        _;
    }

    constructor(
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint64 _subscriptionId,
        address _poolToken
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        owner = msg.sender;
        operator = msg.sender;
        vrfCoordinator = _vrfCoordinator;
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
        poolToken = IERC20(_poolToken);
        sponsorName = "Happy Hour";
        _startNewRound();
    }

    /**
     * @dev Fund the daily pool. Callable by owner/operator (founder).
     * @param amount Amount of pool tokens to add.
     */
    function fundPool(uint256 amount) external onlyOperator {
        require(amount > 0, "Amount must be > 0");
        require(poolToken.transferFrom(msg.sender, address(this), amount), "Fund transfer failed");
        poolAmount += amount;
        emit DailyDeposit(msg.sender, amount, sponsorName);
    }

    /**
     * @dev Mark a user as eligible for the current daily raffle.
     *      Called by the coordinator when user buys hourly raffle tickets.
     * @param user Address of the participant.
     * @param tickets Number of hourly tickets they bought today.
     */
    function markEligible(address user, uint256 tickets) external onlyOperator {
        require(block.timestamp < roundStartTime + roundDuration, "Round ended");
        require(user != address(0), "Invalid user");

        if (!dailyEligible[currentRound][user]) {
            dailyEligible[currentRound][user] = true;
            eligibleUsers[currentRound].push(user);
        }

        userTicketCount[currentRound][user] += tickets;
        emit UserMarkedEligible(currentRound, user, tickets);
    }

    /**
     * @dev Request randomness from Chainlink VRF to draw the daily winner.
     *      Callable by anyone (incentivized keeper).
     */
    function requestDailyDraw() external {
        require(block.timestamp >= roundStartTime + roundDuration, "Round still active");
        require(!roundCompleted[currentRound], "Already drawn");
        require(eligibleUsers[currentRound].length > 0, "No eligible users");
        require(poolAmount > 0, "Empty pool");

        uint256 requestId = requestRandomness(keyHash, subscriptionId, requestConfirmations, callbackGasLimit, numWords);
        requestToRound[requestId] = currentRound;

        emit RandomnessRequested(currentRound, requestId);
    }

    /**
     * @dev VRF callback. Selects winner based on random number and ticket weights.
     */
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        uint256 round = requestToRound[requestId];
        require(round > 0, "Invalid request");
        require(!roundCompleted[round], "Already completed");

        address[] memory users = eligibleUsers[round];
        require(users.length > 0, "No users");

        // Calculate total ticket weight
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < users.length; i++) {
            totalWeight += userTicketCount[round][users[i]];
        }
        require(totalWeight > 0, "No tickets");

        // Select winner based on weighted random
        uint256 winningTicket = randomWords[0] % totalWeight;
        address winner = _selectWinnerByWeight(users, round, winningTicket);

        // Transfer prize
        uint256 prize = poolAmount;
        poolAmount = 0;
        require(poolToken.transfer(winner, prize), "Prize transfer failed");

        roundCompleted[round] = true;
        emit DailyWinnerDrawn(round, winner, prize);

        // Start next round
        _startNewRound();
    }

    function _selectWinnerByWeight(address[] memory users, uint256 round, uint256 winningTicket) internal view returns (address) {
        uint256 cumulative = 0;
        for (uint256 i = 0; i < users.length; i++) {
            cumulative += userTicketCount[round][users[i]];
            if (winningTicket < cumulative) {
                return users[i];
            }
        }
        return users[users.length - 1]; // fallback
    }

    function _startNewRound() internal {
        currentRound++;
        roundStartTime = block.timestamp;
        emit RoundStarted(currentRound, roundStartTime, roundStartTime + roundDuration);
    }

    // ==================== READ FUNCTIONS ====================

    function getPoolBalance() external view returns (uint256) {
        return poolAmount;
    }

    function getEligibleUsers(uint256 round) external view returns (address[] memory) {
        return eligibleUsers[round];
    }

    function getEligibleCount(uint256 round) external view returns (uint256) {
        return eligibleUsers[round].length;
    }

    function isUserEligible(address user) external view returns (bool) {
        return dailyEligible[currentRound][user];
    }

    function getUserTickets(address user) external view returns (uint256) {
        return userTicketCount[currentRound][user];
    }

    function getCurrentRound() external view returns (uint256) {
        return currentRound;
    }

    function getRoundEndTime() external view returns (uint256) {
        return roundStartTime + roundDuration;
    }

    function getTimeRemaining() external view returns (uint256) {
        uint256 endTime = roundStartTime + roundDuration;
        if (block.timestamp >= endTime) return 0;
        return endTime - block.timestamp;
    }

    function isRoundComplete(uint256 round) external view returns (bool) {
        return roundCompleted[round];
    }

    // ==================== ADMIN ====================

    function setPoolToken(address _newToken) external onlyOwner {
        require(_newToken != address(0), "Invalid token");
        emit PoolTokenUpdated(address(poolToken), _newToken);
        poolToken = IERC20(_newToken);
    }

    function setSponsor(string calldata _sponsor) external onlyOwner {
        emit SponsorUpdated(sponsorName, _sponsor);
        sponsorName = _sponsor;
    }

    function setOperator(address _newOperator) external onlyOwner {
        require(_newOperator != address(0), "Invalid operator");
        operator = _newOperator;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid owner");
        owner = _newOwner;
    }

    function rescueFunds(address _token, address _to, uint256 _amount) external onlyOwner {
        require(_to != address(0), "Invalid recipient");
        IERC20(_token).transfer(_to, _amount);
    }
}
