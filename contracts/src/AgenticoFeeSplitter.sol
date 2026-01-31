// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {AgenticoPositionFeesForwarder} from "./periphery/AgenticoPositionFeesForwarder.sol";
import {PaymentSplitter} from "@openzeppelin-contracts-4/finance/PaymentSplitter.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";

/// @title AgenticoFeeSplitter
/// @notice Holds LP NFT and splits swap fees 80/20 between agent and platform
/// @dev Inherits AgenticoPositionFeesForwarder (collectFees) + PaymentSplitter (release). FeeRecipient is address(this).
contract AgenticoFeeSplitter is AgenticoPositionFeesForwarder, PaymentSplitter, IERC721Receiver {
    /// @notice Deploy fee splitter with position manager, operator (agent), timelock, and payees
    /// @param _positionManager Uniswap v4 Position Manager
    /// @param _agent Launching agent (80% of fees, also operator for position)
    /// @param _platformTreasury Platform address (20% of fees)
    /// @param _timelockBlockNumber Block after which operator can transfer position (use type(uint256).max for permanent lock)
    constructor(
        IPositionManager _positionManager,
        address _agent,
        address _platformTreasury,
        uint256 _timelockBlockNumber
    )
        AgenticoPositionFeesForwarder(_positionManager, _agent, _timelockBlockNumber, address(this))
        PaymentSplitter(_payees(_agent, _platformTreasury), _shares())
    {}

    function _payees(address agent, address platform) private pure returns (address[] memory) {
        address[] memory p = new address[](2);
        p[0] = agent;
        p[1] = platform;
        return p;
    }

    function _shares() private pure returns (uint256[] memory) {
        uint256[] memory s = new uint256[](2);
        s[0] = 80;
        s[1] = 20;
        return s;
    }

    /// @notice Receive LP NFT from Position Manager
    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Receive ETH (required for PaymentSplitter + position recipient)
    receive() external payable override(AgenticoPositionFeesForwarder, PaymentSplitter) {}
}
