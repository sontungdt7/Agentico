// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {Fomo4ClawLauncher} from "../src/Fomo4ClawLauncher.sol";
import {Fomo4ClawFeeSplitterFactory} from "../src/Fomo4ClawFeeSplitterFactory.sol";
import {Fomo4ClawAirdrop} from "../src/Fomo4ClawAirdrop.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";

/// @notice Deploy Fomo4Claw contracts to Ethereum Sepolia or mainnet
/// @dev Usage: forge script script/DeployFomo4Claw.s.sol:DeployFomo4Claw --rpc-url $RPC_URL --broadcast -vvvv
contract DeployFomo4Claw is Script {
    // Ethereum Sepolia addresses (from liquidity-launcher Parameters.sol)
    address constant LIQUIDITY_LAUNCHER = 0x00000008412db3394C91A5CbD01635c6d140637C;
    address constant IDENTITY_REGISTRY = 0x7177a6867296406881E20d6647232314736Dd09A; // ERC-8004
    address constant UERC20_FACTORY = 0x0cDE87c11b959E5eB0924c1abF5250eE3f9bD1B5;
    address constant FULL_RANGE_LBP_FACTORY = 0x89Dd5691e53Ea95d19ED2AbdEdCf4cBbE50da1ff;
    address constant CCA_FACTORY = 0xcca1101C61cF5cb44C968947985300DF945C3565;
    IPositionManager constant POSITION_MANAGER = IPositionManager(0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4);

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);

        console2.log("Deploying Fomo4Claw contracts on chain:", block.chainid);
        console2.log("Deployer:", deployer);

        // 1. Deploy Fomo4ClawAirdrop
        Fomo4ClawAirdrop airdrop = new Fomo4ClawAirdrop(IDENTITY_REGISTRY);
        console2.log("Fomo4ClawAirdrop:", address(airdrop));

        // 2. Deploy Fomo4ClawFeeSplitterFactory (timelock = type(uint256).max for permanent LP lock)
        Fomo4ClawFeeSplitterFactory feeSplitterFactory =
            new Fomo4ClawFeeSplitterFactory(POSITION_MANAGER, type(uint256).max);
        console2.log("Fomo4ClawFeeSplitterFactory:", address(feeSplitterFactory));

        // 3. Deploy Fomo4ClawLauncher (vesting uses OpenZeppelin VestingWallet — deployed per launch)
        // Note: IDENTITY_REGISTRY is still used by Fomo4ClawAirdrop for claim eligibility, but not by Fomo4ClawLauncher
        address platformTreasury = deployer; // Replace with actual platform treasury
        Fomo4ClawLauncher launcher = new Fomo4ClawLauncher(
            LIQUIDITY_LAUNCHER,
            platformTreasury,
            address(feeSplitterFactory),
            address(airdrop),
            UERC20_FACTORY,
            FULL_RANGE_LBP_FACTORY,
            CCA_FACTORY
        );
        console2.log("Fomo4ClawLauncher:", address(launcher));

        vm.stopBroadcast();

        console2.log("\n=== Deployment Complete ===");
        console2.log("Update lib/liquidity-launcher.ts with Fomo4ClawLauncher address");
    }
}
