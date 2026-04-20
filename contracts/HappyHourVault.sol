// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title HappyHourVault
 * @dev Secure vault for holding USDC deposits and distributing prizes for the Happy Hour raffle.
 */

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract HappyHourVault {
    address public owner;
    address public operator;
    IERC20 public usdc;

    event PrizeDistributed(address indexed winner, uint256 prizeAmount, uint256 feeAmount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized: Owner only");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner, "Not authorized: Operator only");
        _;
    }

    constructor(address _usdcToken, address _backendOperator) {
        owner = msg.sender;
        operator = _backendOperator;
        usdc = IERC20(_usdcToken); // On Base, USDC is 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    }

    /**
     * @dev Distributes the pot. Callable by the backend admin bot (operator) OR owner.
     */
    function distributePrize(
        address _winner,
        uint256 _winnerAmount,
        address _foundation,
        uint256 _feeAmount
    ) external onlyOperator {
        // Transfer prize to winner
        require(usdc.transfer(_winner, _winnerAmount), "Winner transfer failed");
        
        // Transfer fee to foundation wallet
        if (_feeAmount > 0) {
            require(usdc.transfer(_foundation, _feeAmount), "Foundation transfer failed");
        }
        
        emit PrizeDistributed(_winner, _winnerAmount, _feeAmount);
    }

    /**
     * @dev Escape hatch to withdraw any accidentally deposited unsupported tokens or clear the vault.
     */
    function rescueFunds(address _token, address _to, uint256 _amount) external onlyOwner {
        IERC20(_token).transfer(_to, _amount);
    }

    /**
     * @dev Transfer owner role to a new wallet (e.g. Smart Wallet)
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        owner = _newOwner;
    }

    /**
     * @dev Update the backend bot operator address if it ever gets compromised
     */
    function setOperator(address _newOperator) external onlyOwner {
        require(_newOperator != address(0), "Invalid address");
        operator = _newOperator;
    }
}
