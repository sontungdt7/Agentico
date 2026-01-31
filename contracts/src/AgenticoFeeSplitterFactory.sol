// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AgenticoFeeSplitter} from "./AgenticoFeeSplitter.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";

/// @title AgenticoFeeSplitterFactory
/// @notice Deploys AgenticoFeeSplitter per launch with agent + platformTreasury, 80/20 shares
contract AgenticoFeeSplitterFactory {
    event FeeSplitterDeployed(address indexed feeSplitter, address indexed agent, address indexed platformTreasury);

    IPositionManager public immutable positionManager;
    uint256 public immutable timelockBlockNumber;

    constructor(IPositionManager _positionManager, uint256 _timelockBlockNumber) {
        positionManager = _positionManager;
        timelockBlockNumber = _timelockBlockNumber;
    }

    /// @notice Deploy a new AgenticoFeeSplitter for a launch
    /// @param agent The launching agent (80% of swap fees, also operator for position)
    /// @param platformTreasury Platform address (20% of swap fees)
    /// @return feeSplitter The deployed AgenticoFeeSplitter address
    function deploy(address agent, address platformTreasury) external returns (address feeSplitter) {
        feeSplitter = address(
            new AgenticoFeeSplitter(positionManager, agent, platformTreasury, timelockBlockNumber)
        );
        emit FeeSplitterDeployed(feeSplitter, agent, platformTreasury);
    }
}
