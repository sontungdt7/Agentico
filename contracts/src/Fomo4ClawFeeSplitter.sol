// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Fomo4ClawPositionFeesForwarder} from "./periphery/Fomo4ClawPositionFeesForwarder.sol";
import {PaymentSplitter} from "@openzeppelin-contracts-4/finance/PaymentSplitter.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";

/// @title Fomo4ClawFeeSplitter
/// @notice Holds LP NFT and forwards 100% of swap fees to token creator
/// @dev Inherits Fomo4ClawPositionFeesForwarder (collectFees) + PaymentSplitter (release). FeeRecipient is address(this).
contract Fomo4ClawFeeSplitter is Fomo4ClawPositionFeesForwarder, PaymentSplitter, IERC721Receiver {
    /// @notice Deploy fee splitter with position manager, operator (agent), timelock, and payees
    /// @param _positionManager Uniswap v4 Position Manager
    /// @param _agent Launching agent (100% of fees, also operator for position)
    /// @param _platformTreasury Platform address (0% of fees, kept for PaymentSplitter compatibility)
    /// @param _timelockBlockNumber Block after which operator can transfer position (use type(uint256).max for permanent lock)
    constructor(
        IPositionManager _positionManager,
        address _agent,
        address _platformTreasury,
        uint256 _timelockBlockNumber
    )
        Fomo4ClawPositionFeesForwarder(_positionManager, _agent, _timelockBlockNumber, address(this))
        PaymentSplitter(_payees(_agent, _platformTreasury), _shares())
    {}

    function _payees(address agent, address platform) private pure returns (address[] memory) {
        address[] memory p = new address[](2);
        p[0] = agent;
        p[1] = platform;
        return p;
    }

    function _shares() private pure returns (uint256[] memory) {
        // 100% of swap fees to agent, 0% to platform
        uint256[] memory s = new uint256[](2);
        s[0] = 100;
        s[1] = 0;
        return s;
    }

    /// @notice Receive LP NFT from Position Manager
    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Receive ETH (required for PaymentSplitter + position recipient)
    receive() external payable override(Fomo4ClawPositionFeesForwarder, PaymentSplitter) {}
}
