// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title IDistributionContract
/// @notice Interface for token distribution contracts (from liquidity-launcher)
interface IDistributionContract {
    error InvalidToken(address token);
    error InvalidAmountReceived(uint256 expected, uint256 received);

    /// @notice Notify a distribution contract that it has received the tokens to distribute
    function onTokensReceived() external;
}
