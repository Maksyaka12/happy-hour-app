// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title HappyHourPaymentsVault
 * @dev Cumulative vault for check-ins, boosts, and other payments.
 * Automatically forwards accumulated USDC to the founder's cold wallet via operator sweeps.
 */
contract HappyHourPaymentsVault {
    address public owner;
    address public operator = 0x1aA4aD048ADe8DC9e6b0eaA5F148f308dAB2E56f;
    address public coldWallet = 0xf76365c4157eE3f08fBAb77E9d57B965892D137d;
    IERC20 public constant usdc = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);

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

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Forwards all accumulated USDC in the contract to the founder's cold wallet.
     * Callable by the operator (bot) or the owner.
     */
    function forwardFunds() external onlyOperator {
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No funds to forward");
        require(usdc.transfer(coldWallet, balance), "Forward transfer failed");
        emit FundsForwarded(coldWallet, balance);
    }

    /**
     * @dev Allows the owner to change the destination cold wallet address.
     */
    function setColdWallet(address _newColdWallet) external onlyOwner {
        require(_newColdWallet != address(0), "Invalid address");
        emit ColdWalletUpdated(coldWallet, _newColdWallet);
        coldWallet = _newColdWallet;
    }

    /**
     * @dev Allows the owner to change the operator (bot) address if it gets compromised.
     */
    function setOperator(address _newOperator) external onlyOwner {
        require(_newOperator != address(0), "Invalid address");
        emit OperatorUpdated(operator, _newOperator);
        operator = _newOperator;
    }

    /**
     * @dev Transfers ownership of the contract (e.g. to your Smart Wallet).
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }

    /**
     * @dev Emergency hatch to withdraw any other accidentally sent ERC-20 tokens.
     */
    function rescueToken(address _token, address _to, uint256 _amount) external onlyOwner {
        require(_to != address(0), "Invalid recipient");
        IERC20(_token).transfer(_to, _amount);
    }
}
