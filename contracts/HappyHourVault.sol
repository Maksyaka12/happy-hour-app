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
    address public admin;
    IERC20 public usdc;

    event PrizeDistributed(address indexed winner, uint256 prizeAmount, uint256 feeAmount);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not authorized: Admin only");
        _;
    }

    constructor(address _usdcToken) {
        admin = msg.sender;
        usdc = IERC20(_usdcToken); // On Base, USDC is 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    }

    /**
     * @dev Distributes the pot to the winner and the fee to the foundation.
     * Callable only by the backend admin bot.
     */
    function distributePrize(
        address _winner,
        uint256 _winnerAmount,
        address _foundation,
        uint256 _feeAmount
    ) external onlyAdmin {
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
    function rescueFunds(address _token, address _to, uint256 _amount) external onlyAdmin {
        IERC20(_token).transfer(_to, _amount);
    }

    /**
     * @dev Transfer admin role to a new wallet.
     */
    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid admin address");
        admin = _newAdmin;
    }
}
