// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Interface for standard ERC20 token interactions.
 */
interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title HappyHourStaking
 * @dev Smart contract for staking $HH tokens.
 * Users can stake for 7 days (103% APR) or 10 days (166% APR) to earn yield.
 * Staked positions are locked for the duration. Users unstake themselves after lock expiry.
 */
contract HappyHourStaking {
    struct StakePosition {
        uint256 amount;
        uint256 startTime;
        uint256 endTime;
        uint256 apr; // e.g. 20 for 20% APR, 45 for 45% APR
        uint256 durationDays; // 7 or 10 days
        bool active;
    }

    address public owner;
    address public operator;
    IERC20 public immutable hhToken;

    // Sum of all active user staked principals
    uint256 public totalStakedPrincipal;

    // User address mapping to their list of staking positions
    mapping(address => StakePosition[]) public userStakes;

    event Staked(address indexed user, uint256 indexed positionIndex, uint256 amount, uint256 durationDays, uint256 apr);
    event Unstaked(address indexed user, uint256 indexed positionIndex, uint256 principal, uint256 yield);
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

    constructor() {
        owner = msg.sender;
        operator = 0x1aA4aD048ADe8DC9e6b0eaA5F148f308dAB2E56f;
        hhToken = IERC20(0x8235EdF32a1e10Bd1867ad622915AB613664cbA3);
    }

    /**
     * @dev User stakes $HH tokens for a specific lock duration.
     * @param _amount The amount of $HH tokens to stake (18 decimals)
     * @param _durationDays Lock duration in days (must be 7 or 10)
     */
    function stake(uint256 _amount, uint256 _durationDays) external {
        require(_amount > 0, "Staking amount must be greater than zero");
        require(_durationDays == 7 || _durationDays == 10, "Staking duration must be 7 or 10 days");

        uint256 apr = _durationDays == 7 ? 103 : 166;

        // Pull tokens from user to contract
        require(hhToken.transferFrom(msg.sender, address(this), _amount), "Staking transfer failed");

        // Record the new staking position
        userStakes[msg.sender].push(StakePosition({
            amount: _amount,
            startTime: block.timestamp,
            endTime: block.timestamp + (_durationDays * 1 days),
            apr: apr,
            durationDays: _durationDays,
            active: true
        }));

        totalStakedPrincipal += _amount;

        emit Staked(msg.sender, userStakes[msg.sender].length - 1, _amount, _durationDays, apr);
    }

    /**
     * @dev User unstakes a specific position after the lock period has expired.
     * Calculates the principal + interest yield and pays it to the user.
     * @param _positionIndex Index of the stake position in the user's positions array
     */
    function unstake(uint256 _positionIndex) external {
        require(_positionIndex < userStakes[msg.sender].length, "Invalid position index");
        StakePosition storage pos = userStakes[msg.sender][_positionIndex];
        require(pos.active, "Position already unstaked");
        require(block.timestamp >= pos.endTime, "Staking period has not expired yet");

        pos.active = false;
        totalStakedPrincipal -= pos.amount;

        // Yield = (Principal * APR% * Duration) / (365 * 100)
        uint256 yield = (pos.amount * pos.apr * pos.durationDays) / 36500;
        uint256 totalPayout = pos.amount + yield;

        require(hhToken.balanceOf(address(this)) >= totalPayout, "Insufficient contract rewards reserves");

        // Transfer principal + yield to user
        require(hhToken.transfer(msg.sender, totalPayout), "Unstake transfer failed");

        emit Unstaked(msg.sender, _positionIndex, pos.amount, yield);
    }

    /**
     * @dev Returns all staking positions for a specific user.
     */
    function getUserPositions(address _user) external view returns (StakePosition[] memory) {
        return userStakes[_user];
    }

    /**
     * @dev Returns the total active staked principal for a specific user.
     * Used by the off-chain distributor script to calculate daily passive HP rewards.
     */
    function totalActiveStaked(address _user) external view returns (uint256) {
        uint256 total = 0;
        uint256 length = userStakes[_user].length;
        for (uint256 i = 0; i < length; i++) {
            if (userStakes[_user][i].active) {
                total += userStakes[_user][i].amount;
            }
        }
        return total;
    }

    /**
     * @dev Owner can withdraw excess $HH rewards injected into the contract.
     * Guarantees that active user staked principals can never be withdrawn by the admin.
     * @param _amount Amount of excess $HH to withdraw
     */
    function withdrawExcessRewards(uint256 _amount) external onlyOwner {
        require(hhToken.balanceOf(address(this)) >= totalStakedPrincipal + _amount, "Cannot withdraw active user stakes");
        require(hhToken.transfer(owner, _amount), "Withdraw rewards failed");
    }

    /**
     * @dev Allows the owner to change the operator (bot) address.
     */
    function setOperator(address _newOperator) external onlyOwner {
        require(_newOperator != address(0), "Invalid operator address");
        emit OperatorUpdated(operator, _newOperator);
        operator = _newOperator;
    }

    /**
     * @dev Transfers ownership of the contract.
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid owner address");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }

    /**
     * @dev Emergency hatch to rescue any accidentally deposited non-$HH tokens.
     */
    function rescueFunds(address _token, address _to, uint256 _amount) external onlyOwner {
        require(_token != address(hhToken), "Cannot rescue staked HH token");
        require(_to != address(0), "Invalid recipient address");
        IERC20(_token).transfer(_to, _amount);
    }
}
