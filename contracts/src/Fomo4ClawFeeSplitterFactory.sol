// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Fomo4ClawFeeSplitter} from "./Fomo4ClawFeeSplitter.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";

/// @title Fomo4ClawFeeSplitterFactory
/// @notice Deploys Fomo4ClawFeeSplitter per launch with agent + platformTreasury, 100/0 shares
contract Fomo4ClawFeeSplitterFactory {
    event FeeSplitterDeployed(address indexed feeSplitter, address indexed agent, address indexed platformTreasury);

    IPositionManager public immutable positionManager;
    uint256 public immutable timelockBlockNumber;

    constructor(IPositionManager _positionManager, uint256 _timelockBlockNumber) {
        positionManager = _positionManager;
        timelockBlockNumber = _timelockBlockNumber;
    }

    /// @notice Deploy a new Fomo4ClawFeeSplitter for a launch
    /// @param agent The launching agent (100% of swap fees, also operator for position)
    /// @param platformTreasury Platform address (0% of swap fees, kept for compatibility)
    /// @return feeSplitter The deployed Fomo4ClawFeeSplitter address
    function deploy(address agent, address platformTreasury) external returns (address feeSplitter) {
        feeSplitter = address(
            new Fomo4ClawFeeSplitter(positionManager, agent, platformTreasury, timelockBlockNumber)
        );
        emit FeeSplitterDeployed(feeSplitter, agent, platformTreasury);
    }
}
