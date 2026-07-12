// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

/**
 * @title HappyHourRaffle
 * @dev Hourly raffle vault with ticket-based deposits, 15% burn, and operator prize distribution.
 *      Designed for agentic-economy integration: readable pool state, user tickets, and clear events.
 */
contract HappyHourRaffle {
    address public owner;
    address public operator;
    IERC20 public immutable hhToken;

    // Burn address for the 15% operator fee
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // Price per ticket in HH tokens (e.g., ~$0.10 equivalent)
    uint256 public tokensPerTicket;

    // Round tracking
    uint256 public currentRound;
    uint256 public roundEndTime;
    uint256 public roundDuration = 1 hours;

    // Pool and tickets per round
    mapping(uint256 => uint256) public roundPool;
    mapping(uint256 => mapping(address => uint256)) public userTickets;
    mapping(uint256 => address[]) public roundParticipants;
    mapping(uint256 => mapping(address => bool)) public isParticipant;

    // Events for indexing
    event Deposit(address indexed user, uint256 amount, uint256 tickets, uint256 indexed round);
    event WinnerDrawn(uint256 indexed round, address winner, uint256 prize, uint256 burned);
    event RoundStarted(uint256 indexed round, uint256 endTime);
    event TokensPerTicketUpdated(uint256 oldPrice, uint256 newPrice);
    event OperatorUpdated(address indexed oldOperator, address indexed newOperator);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized: Owner only");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner, "Not authorized: Operator only");
        _;
    }

    constructor(uint256 _tokensPerTicket) {
        owner = msg.sender;
        operator = msg.sender;
        hhToken = IERC20(0x8235EdF32a1e10Bd1867ad622915AB613664cbA3);
        tokensPerTicket = _tokensPerTicket;
        _startNewRound();
    }

    /**
     * @dev Deposit HH tokens to buy tickets for the current round.
     * @param amount Amount of HH tokens to deposit.
     */
    function deposit(uint256 amount) external {
        require(amount >= tokensPerTicket, "Minimum 1 ticket required");
        require(block.timestamp < roundEndTime, "Round ended, wait for next");

        uint256 tickets = amount / tokensPerTicket;
        uint256 cost = tickets * tokensPerTicket;
        uint256 excess = amount - cost;

        // Transfer exact cost from user
        require(hhToken.transferFrom(msg.sender, address(this), cost), "Deposit transfer failed");

        // Refund excess if any
        if (excess > 0) {
            require(hhToken.transfer(msg.sender, excess), "Excess refund failed");
        }

        // Record tickets
        userTickets[currentRound][msg.sender] += tickets;
        roundPool[currentRound] += cost;

        // Track participant for this round
        if (!isParticipant[currentRound][msg.sender]) {
            isParticipant[currentRound][msg.sender] = true;
            roundParticipants[currentRound].push(msg.sender);
        }

        emit Deposit(msg.sender, cost, tickets, currentRound);
    }

    /**
     * @dev Operator draws winner for the current round and starts a new one.
     *      85% to winner, 15% burned.
     * @param winner Address of the selected winner.
     */
    function drawWinner(address winner) external onlyOperator {
        require(block.timestamp >= roundEndTime, "Round still active");
        require(winner != address(0), "Invalid winner");
        require(isParticipant[currentRound][winner], "Winner did not participate");

        uint256 pool = roundPool[currentRound];
        require(pool > 0, "Empty pool");

        uint256 prize = (pool * 85) / 100;
        uint256 burnAmount = pool - prize;

        // Transfer prize to winner
        require(hhToken.transfer(winner, prize), "Prize transfer failed");

        // Burn 15%
        if (burnAmount > 0) {
            require(hhToken.transfer(BURN_ADDRESS, burnAmount), "Burn failed");
        }

        emit WinnerDrawn(currentRound, winner, prize, burnAmount);

        // Start next round
        _startNewRound();
    }

    /**
     * @dev Start a new round manually (operator only).
     */
    function forceNewRound() external onlyOperator {
        _startNewRound();
    }

    function _startNewRound() internal {
        currentRound++;
        roundEndTime = block.timestamp + roundDuration;
        emit RoundStarted(currentRound, roundEndTime);
    }

    // ==================== READ FUNCTIONS ====================

    function getPoolBalance() external view returns (uint256) {
        return roundPool[currentRound];
    }

    function getUserTickets(address user) external view returns (uint256) {
        return userTickets[currentRound][user];
    }

    function getUserTicketsForRound(address user, uint256 round) external view returns (uint256) {
        return userTickets[round][user];
    }

    function getCurrentRound() external view returns (uint256) {
        return currentRound;
    }

    function getRoundEndTime() external view returns (uint256) {
        return roundEndTime;
    }

    function getTicketPrice() external view returns (uint256) {
        return tokensPerTicket;
    }

    function getParticipants(uint256 round) external view returns (address[] memory) {
        return roundParticipants[round];
    }

    function getParticipantCount(uint256 round) external view returns (uint256) {
        return roundParticipants[round].length;
    }

    function getTimeRemaining() external view returns (uint256) {
        if (block.timestamp >= roundEndTime) return 0;
        return roundEndTime - block.timestamp;
    }

    // ==================== ADMIN ====================

    function setTokensPerTicket(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Price must be > 0");
        emit TokensPerTicketUpdated(tokensPerTicket, newPrice);
        tokensPerTicket = newPrice;
    }

    function setRoundDuration(uint256 newDuration) external onlyOwner {
        require(newDuration >= 5 minutes, "Min 5 minutes");
        roundDuration = newDuration;
    }

    function setOperator(address _newOperator) external onlyOwner {
        require(_newOperator != address(0), "Invalid operator");
        emit OperatorUpdated(operator, _newOperator);
        operator = _newOperator;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }

    function rescueFunds(address _token, address _to, uint256 _amount) external onlyOwner {
        require(_to != address(0), "Invalid recipient");
        IERC20(_token).transfer(_to, _amount);
    }
}
