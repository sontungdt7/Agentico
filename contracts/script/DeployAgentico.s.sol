// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {AgenticoLauncher} from "../src/AgenticoLauncher.sol";
import {AgenticoFeeSplitterFactory} from "../src/AgenticoFeeSplitterFactory.sol";
import {AgenticoAirdrop} from "../src/AgenticoAirdrop.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";

/// @notice Deploy Agentico contracts to Ethereum Sepolia or mainnet
/// @dev Usage: forge script script/DeployAgentico.s.sol:DeployAgentico --rpc-url $RPC_URL --broadcast -vvvv
contract DeployAgentico is Script {
    // Ethereum Sepolia addresses (from liquidity-launcher Parameters.sol)
    address constant LIQUIDITY_LAUNCHER = 0x00000008412db3394C91A5CbD01635c6d140637C;
    address constant IDENTITY_REGISTRY = 0x7177a6867296406881E20d6647232314736Dd09A; // ERC-8004
    address constant UERC20_FACTORY = 0xD97d0c9FB20CF472D4d52bD8e0468A6C010ba448;
    address constant FULL_RANGE_LBP_FACTORY = 0x89Dd5691e53Ea95d19ED2AbdEdCf4cBbE50da1ff;
    address constant CCA_FACTORY = 0xcca1101C61cF5cb44C968947985300DF945C3565;
    IPositionManager constant POSITION_MANAGER = IPositionManager(0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4);

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);

        console2.log("Deploying Agentico contracts on chain:", block.chainid);
        console2.log("Deployer:", deployer);

        // 1. Deploy AgenticoAirdrop
        AgenticoAirdrop airdrop = new AgenticoAirdrop(IDENTITY_REGISTRY);
        console2.log("AgenticoAirdrop:", address(airdrop));

        // 2. Deploy AgenticoFeeSplitterFactory (timelock = type(uint256).max for permanent LP lock)
        AgenticoFeeSplitterFactory feeSplitterFactory =
            new AgenticoFeeSplitterFactory(POSITION_MANAGER, type(uint256).max);
        console2.log("AgenticoFeeSplitterFactory:", address(feeSplitterFactory));

        // 3. Deploy AgenticoLauncher (vesting uses OpenZeppelin VestingWallet — deployed per launch)
        address platformTreasury = deployer; // Replace with actual platform treasury
        AgenticoLauncher launcher = new AgenticoLauncher(
            LIQUIDITY_LAUNCHER,
            IDENTITY_REGISTRY,
            platformTreasury,
            address(feeSplitterFactory),
            address(airdrop),
            UERC20_FACTORY,
            FULL_RANGE_LBP_FACTORY,
            CCA_FACTORY
        );
        console2.log("AgenticoLauncher:", address(launcher));

        vm.stopBroadcast();

        console2.log("\n=== Deployment Complete ===");
        console2.log("Update lib/liquidity-launcher.ts with AgenticoLauncher address");
    }
}
