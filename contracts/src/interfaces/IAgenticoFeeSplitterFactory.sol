// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title IAgenticoFeeSplitterFactory
/// @notice Deploys AgenticoFeeSplitter per launch (agent + platform, 80/20)
interface IAgenticoFeeSplitterFactory {
    function deploy(address agent, address platformTreasury) external returns (address feeSplitter);
}
