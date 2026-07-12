// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

/**
 * @title HappyHourMembership
 * @dev Happy Club subscription: ~$10 equivalent in HH, USDC, or ETH.
 *      Grants unlimited bot queries and automation access.
 *      Designed for agentic verification: isMember(wallet) check.
 */
contract HappyHourMembership {
    address public owner;
    address public treasury;

    // Accepted tokens
    IERC20 public hhToken;
    IERC20 public usdc;
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    // Pricing (~$10 equivalent, set by oracle/owner periodically)
    uint256 public hhPrice;    // in HH tokens
    uint256 public usdcPrice;  // in USDC (6 decimals)
    uint256 public ethPrice;   // in wei

    // Membership tracking
    mapping(address => uint256) public membershipExpiry;
    mapping(address => uint256) public totalPaid;

    // Events
    event MembershipPurchased(address indexed user, uint256 expiry, string tokenType, uint256 amount);
    event PricesUpdated(uint256 hhPrice, uint256 usdcPrice, uint256 ethPrice);
    event TreasuryUpdated(address oldTreasury, address newTreasury);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized: Owner only");
        _;
    }

    constructor(
        address _hhToken,
        address _usdc,
        address _treasury,
        uint256 _hhPrice,
        uint256 _usdcPrice,
        uint256 _ethPrice
    ) {
        owner = msg.sender;
        treasury = _treasury;
        hhToken = IERC20(_hhToken);
        usdc = IERC20(_usdc);
        hhPrice = _hhPrice;
        usdcPrice = _usdcPrice;
        ethPrice = _ethPrice;
    }

    /**
     * @dev Purchase membership with HH tokens.
     * @param durationDays Number of days (30 or 365).
     */
    function purchaseWithHH(uint256 durationDays) external {
        require(durationDays == 30 || durationDays == 365, "Invalid duration");
        uint256 cost = (hhPrice * durationDays) / 30;
        require(hhToken.transferFrom(msg.sender, treasury, cost), "HH transfer failed");
        _grantMembership(msg.sender, durationDays, "HH", cost);
    }

    /**
     * @dev Purchase membership with USDC.
     * @param durationDays Number of days (30 or 365).
     */
    function purchaseWithUSDC(uint256 durationDays) external {
        require(durationDays == 30 || durationDays == 365, "Invalid duration");
        uint256 cost = (usdcPrice * durationDays) / 30;
        require(usdc.transferFrom(msg.sender, treasury, cost), "USDC transfer failed");
        _grantMembership(msg.sender, durationDays, "USDC", cost);
    }

    /**
     * @dev Purchase membership with ETH.
     * @param durationDays Number of days (30 or 365).
     */
    function purchaseWithETH(uint256 durationDays) external payable {
        require(durationDays == 30 || durationDays == 365, "Invalid duration");
        uint256 cost = (ethPrice * durationDays) / 30;
        require(msg.value >= cost, "Insufficient ETH");

        // Forward ETH to treasury
        (bool sent, ) = treasury.call{value: cost}("");
        require(sent, "ETH transfer failed");

        // Refund excess
        if (msg.value > cost) {
            (bool refunded, ) = msg.sender.call{value: msg.value - cost}("");
            require(refunded, "Refund failed");
        }

        _grantMembership(msg.sender, durationDays, "ETH", cost);
    }

    function _grantMembership(address user, uint256 durationDays, string memory tokenType, uint256 amount) internal {
        uint256 currentExpiry = membershipExpiry[user];
        uint256 base = currentExpiry > block.timestamp ? currentExpiry : block.timestamp;
        uint256 newExpiry = base + (durationDays * 1 days);

        membershipExpiry[user] = newExpiry;
        totalPaid[user] += amount;

        emit MembershipPurchased(user, newExpiry, tokenType, amount);
    }

    // ==================== READ FUNCTIONS ====================

    function isMember(address user) external view returns (bool) {
        return membershipExpiry[user] > block.timestamp;
    }

    function getExpiry(address user) external view returns (uint256) {
        return membershipExpiry[user];
    }

    function getTimeRemaining(address user) external view returns (uint256) {
        if (membershipExpiry[user] <= block.timestamp) return 0;
        return membershipExpiry[user] - block.timestamp;
    }

    function getMembershipDaysRemaining(address user) external view returns (uint256) {
        uint256 remaining = membershipExpiry[user] > block.timestamp ? membershipExpiry[user] - block.timestamp : 0;
        return remaining / 1 days;
    }

    // ==================== ADMIN ====================

    function setPrices(uint256 _hhPrice, uint256 _usdcPrice, uint256 _ethPrice) external onlyOwner {
        hhPrice = _hhPrice;
        usdcPrice = _usdcPrice;
        ethPrice = _ethPrice;
        emit PricesUpdated(_hhPrice, _usdcPrice, _ethPrice);
    }

    function setTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Invalid treasury");
        emit TreasuryUpdated(treasury, _newTreasury);
        treasury = _newTreasury;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid owner");
        owner = _newOwner;
    }

    receive() external payable {
        revert("Use purchaseWithETH");
    }
}
