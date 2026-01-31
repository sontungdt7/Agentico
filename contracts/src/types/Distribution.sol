// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Distribution
/// @notice Matches liquidity-launcher Distribution struct
struct Distribution {
    address strategy;
    uint128 amount;
    bytes configData;
}
