// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BlockNumberish} from "@uniswap/blocknumberish/src/BlockNumberish.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {ReentrancyGuardTransient} from "solady/utils/ReentrancyGuardTransient.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ITimelockedPositionRecipient} from "liquidity-launcher/interfaces/ITimelockedPositionRecipient.sol";

/// @title Fomo4ClawTimelockedPositionRecipient
/// @notice Same as TimelockedPositionRecipient but with virtual receive() for PaymentSplitter inheritance
contract Fomo4ClawTimelockedPositionRecipient is ITimelockedPositionRecipient, ReentrancyGuardTransient, BlockNumberish {
    IPositionManager public immutable positionManager;
    address public immutable operator;
    uint256 public immutable timelockBlockNumber;

    constructor(IPositionManager _positionManager, address _operator, uint256 _timelockBlockNumber) {
        positionManager = _positionManager;
        operator = _operator;
        timelockBlockNumber = _timelockBlockNumber;
    }

    function approveOperator() external {
        if (_getBlockNumberish() < timelockBlockNumber) revert Timelocked();
        IERC721(address(positionManager)).setApprovalForAll(operator, true);
        emit OperatorApproved(operator);
    }

    /// @notice Receive ETH — virtual to allow PaymentSplitter override in Fomo4ClawFeeSplitter
    receive() external payable virtual {}
}
