// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Distribution} from "../types/Distribution.sol";

/// @title ILiquidityLauncher
/// @notice Interface for the LiquidityLauncher contract (liquidity-launcher)
interface ILiquidityLauncher {
    function createToken(
        address factory,
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        uint128 initialSupply,
        address recipient,
        bytes calldata tokenData
    ) external returns (address tokenAddress);

    function distributeToken(
        address tokenAddress,
        Distribution calldata distribution,
        bool payerIsUser,
        bytes32 salt
    ) external returns (address distributionContract);

    function getGraffiti(address originalCreator) external view returns (bytes32 graffiti);

    function multicall(bytes[] calldata data) external returns (bytes[] memory results);
}
