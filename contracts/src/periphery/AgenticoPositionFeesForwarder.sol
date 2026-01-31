// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {AgenticoTimelockedPositionRecipient} from "./AgenticoTimelockedPositionRecipient.sol";
import {Multicall} from "liquidity-launcher/Multicall.sol";

/// @title AgenticoPositionFeesForwarder
/// @notice Same as PositionFeesForwarder but extends AgenticoTimelockedPositionRecipient (virtual receive)
contract AgenticoPositionFeesForwarder is AgenticoTimelockedPositionRecipient, Multicall {
    event FeesForwarded(address indexed feeRecipient);

    address public immutable feeRecipient;

    constructor(
        IPositionManager _positionManager,
        address _operator,
        uint256 _timelockBlockNumber,
        address _feeRecipient
    ) AgenticoTimelockedPositionRecipient(_positionManager, _operator, _timelockBlockNumber) {
        feeRecipient = _feeRecipient;
    }

    function collectFees(uint256 _tokenId) external nonReentrant {
        (PoolKey memory poolKey,) = positionManager.getPoolAndPositionInfo(_tokenId);
        bytes memory actions = abi.encodePacked(uint8(Actions.DECREASE_LIQUIDITY), uint8(Actions.TAKE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(_tokenId, 0, 0, 0, bytes(""));
        params[1] = abi.encode(poolKey.currency0, poolKey.currency1, feeRecipient);
        positionManager.modifyLiquidities(abi.encode(actions, params), block.timestamp);
        emit FeesForwarded(feeRecipient);
    }

    receive() external payable virtual override {}
}
