// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title IUERC20Factory
/// @notice Interface for UERC20Factory (token creation)
interface IUERC20Factory {
    function getUERC20Address(
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        address recipient,
        bytes32 graffiti
    ) external view returns (address);
}
