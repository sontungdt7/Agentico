// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title IFomo4ClawFeeSplitterFactory
/// @notice Deploys Fomo4ClawFeeSplitter per launch (agent + platform, 100/0)
interface IFomo4ClawFeeSplitterFactory {
    function deploy(address agent, address platformTreasury) external returns (address feeSplitter);
}
