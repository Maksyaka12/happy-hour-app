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
 * @title HappyHourHHRaffleVault
 * @dev Dedicated vault for holding $HH token raffle deposits and distributing prizes.
 * Automatically burns the 15% operator fee to the dead address during prize distribution.
 */
contract HappyHourHHRaffleVault {
    address public owner;
    address public operator;
    IERC20 public immutable hhToken;

    // Burn address constant for the 15% burn mechanic
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    event HHDeposited(address indexed user, uint256 amount);
    event PrizeDistributed(address indexed winner, uint256 prizeAmount, uint256 burnAmount);
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
     * @dev User deposits $HH tokens to participate in the raffle round.
     * This registers as a contract transaction instead of a direct ERC20 transfer.
     * @param _amount The amount of $HH tokens to deposit (18 decimals)
     */
    function depositHH(uint256 _amount) external {
        require(_amount > 0, "Amount must be greater than zero");
        require(hhToken.transferFrom(msg.sender, address(this), _amount), "Raffle deposit transfer failed");
        emit HHDeposited(msg.sender, _amount);
    }

    /**
     * @dev Distributes the raffle round prize. Called by the backend operator bot.
     * Automatically transfers 85% to the winner and burns the remaining 15%.
     * @param _winner Address of the selected winner
     * @param _winnerAmount Amount to send to the winner (85% of pool)
     * @param _burnAmount Amount to burn (15% of pool)
     */
    function distributePrize(
        address _winner,
        uint256 _winnerAmount,
        uint256 _burnAmount
    ) external onlyOperator {
        require(_winner != address(0), "Invalid winner address");
        uint256 totalNeeded = _winnerAmount + _burnAmount;
        require(hhToken.balanceOf(address(this)) >= totalNeeded, "Insufficient contract balance");

        // Send 85% to the winner
        require(hhToken.transfer(_winner, _winnerAmount), "Winner payout failed");

        // Burn 15% by transferring to dead address
        if (_burnAmount > 0) {
            require(hhToken.transfer(BURN_ADDRESS, _burnAmount), "Fee burn failed");
        }

        emit PrizeDistributed(_winner, _winnerAmount, _burnAmount);
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
     * @dev Emergency hatch to rescue any accidentally deposited tokens.
     */
    function rescueFunds(address _token, address _to, uint256 _amount) external onlyOwner {
        require(_to != address(0), "Invalid recipient address");
        IERC20(_token).transfer(_to, _amount);
    }
}
