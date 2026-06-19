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
 * @title HappyHourHHManager
 * @dev Manages in-app payments in $HH tokens.
 * Automatically burns 30% of normal service payments (Boost, Raid, Shield, Chests) and 100% of box opening burns.
 * Retains the rest on the contract, allowing the owner/operator to sweep it to the cold wallet.
 */
contract HappyHourHHManager {
    address public owner;
    address public operator;
    address public coldWallet;
    IERC20 public immutable hhToken;

    // Burn address constant for the burn mechanics
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    event HHPaymentReceived(address indexed user, uint256 amount, uint256 burnedAmount, string serviceType);
    event HHRefundBurned(address indexed user, uint256 amount);
    event FundsForwarded(address indexed to, uint256 amount);
    event ColdWalletUpdated(address indexed oldWallet, address indexed newWallet);
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

    /**
     * @param _hhToken Address of the $HH token (ERC20)
     * @param _backendOperator Address of the backend bot operator
     * @param _coldWallet Address of the cold wallet to sweep funds to
     */
    constructor(address _hhToken, address _backendOperator, address _coldWallet) {
        require(_hhToken != address(0), "Invalid token address");
        require(_backendOperator != address(0), "Invalid operator address");
        require(_coldWallet != address(0), "Invalid cold wallet address");
        owner = msg.sender;
        operator = _backendOperator;
        coldWallet = _coldWallet;
        hhToken = IERC20(_hhToken);
    }

    /**
     * @dev Process an in-app payment in $HH tokens (Boost, Chests, Raids, Shields).
     * Automatically transfers 30% to the burn address and keeps 70% in the contract.
     * @param _amount The amount of $HH tokens to pay (18 decimals)
     * @param _serviceType Identifier string of the service being purchased
     */
    function payWithHH(uint256 _amount, string calldata _serviceType) external {
        require(_amount > 0, "Amount must be greater than zero");

        // Pull tokens from user to this contract
        require(hhToken.transferFrom(msg.sender, address(this), _amount), "Payment transfer failed");

        // Burn 30% of the paid amount
        uint256 burnAmount = (_amount * 30) / 100;
        if (burnAmount > 0) {
            require(hhToken.transfer(BURN_ADDRESS, burnAmount), "Burn transfer failed");
        }

        emit HHPaymentReceived(msg.sender, _amount, burnAmount, _serviceType);
    }

    /**
     * @dev Process a voluntary 100% burn of $HH tokens in exchange for +1 box opening attempt.
     * @param _amount The amount of $HH tokens to burn (18 decimals)
     */
    function burnHHForBoxes(uint256 _amount) external {
        require(_amount > 0, "Amount must be greater than zero");

        // Transfer 100% directly to the dead address
        require(hhToken.transferFrom(msg.sender, BURN_ADDRESS, _amount), "Burn transfer failed");

        emit HHRefundBurned(msg.sender, _amount);
    }

    /**
     * @dev Sweeps all accumulated $HH tokens in the contract to the cold wallet.
     * Callable by owner or operator.
     */
    function forwardFunds() external onlyOperator {
        uint256 balance = hhToken.balanceOf(address(this));
        require(balance > 0, "No funds to forward");
        require(hhToken.transfer(coldWallet, balance), "Forward transfer failed");
        emit FundsForwarded(coldWallet, balance);
    }

    /**
     * @dev Allows the owner to change the destination cold wallet address.
     */
    function setColdWallet(address _newColdWallet) external onlyOwner {
        require(_newColdWallet != address(0), "Invalid cold wallet address");
        emit ColdWalletUpdated(coldWallet, _newColdWallet);
        coldWallet = _newColdWallet;
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
    function rescueToken(address _token, address _to, uint256 _amount) external onlyOwner {
        require(_to != address(0), "Invalid recipient address");
        IERC20(_token).transfer(_to, _amount);
    }
}
