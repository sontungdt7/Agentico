// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Fomo4ClawAirdrop
/// @notice 10% FCFS airdrop for first 10,000 ERC-8004 registered agents per token
/// @dev Supports multiple tokens. Fomo4ClawLauncher transfers tokens, then calls deposit().
contract Fomo4ClawAirdrop {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_CLAIMANTS = 10_000;

    IERC721 public immutable identityRegistry;

    struct TokenAirdrop {
        uint256 totalAmount;
        uint256 amountPerAgent;
        uint64 unlockBlock;
        uint256 claimCount;
    }

    mapping(address => TokenAirdrop) public tokenAirdrops;
    mapping(address => mapping(address => bool)) public hasClaimed;

    event AirdropDeposited(address indexed token, uint256 amount, uint64 unlockBlock);
    event Claimed(address indexed token, address indexed agent, uint256 amount);

    error NotRegisteredAgent();
    error AlreadyClaimed();
    error AirdropNotUnlocked();
    error MaxClaimantsReached();

    constructor(address _identityRegistry) {
        identityRegistry = IERC721(_identityRegistry);
    }

    /// @notice Initialize airdrop for a token. Call after transferring tokens to this contract.
    /// @param token The token address
    /// @param amount The amount transferred (10% of supply)
    /// @param unlockBlock Block when claims can begin
    function deposit(address token, uint256 amount, uint64 unlockBlock) external {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance >= amount, "Insufficient balance");

        TokenAirdrop storage airdrop = tokenAirdrops[token];
        require(airdrop.totalAmount == 0, "Already deposited for token");

        airdrop.totalAmount = amount;
        airdrop.amountPerAgent = amount / MAX_CLAIMANTS;
        airdrop.unlockBlock = unlockBlock;

        emit AirdropDeposited(token, amount, unlockBlock);
    }

    /// @notice Claim airdrop (FCFS, first 10k agents per token)
    function claim(address token) external {
        if (identityRegistry.balanceOf(msg.sender) == 0) revert NotRegisteredAgent();
        if (hasClaimed[token][msg.sender]) revert AlreadyClaimed();

        TokenAirdrop storage airdrop = tokenAirdrops[token];
        if (block.number < airdrop.unlockBlock) revert AirdropNotUnlocked();
        if (airdrop.claimCount >= MAX_CLAIMANTS) revert MaxClaimantsReached();

        hasClaimed[token][msg.sender] = true;
        airdrop.claimCount++;

        IERC20(token).safeTransfer(msg.sender, airdrop.amountPerAgent);
        emit Claimed(token, msg.sender, airdrop.amountPerAgent);
    }
}
