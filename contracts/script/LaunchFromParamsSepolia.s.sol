// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {Fomo4ClawLauncher} from "../src/Fomo4ClawLauncher.sol";

/// @notice Calls Fomo4ClawLauncher.launch(LaunchParams) using params from a JSON file.
/// @dev The JSON file should be the prepare-launch API response (or at least contain launchParams).
///      1. Get params: curl -X POST https://your-app/api/prepare-launch -H "Content-Type: application/json" -d '{"agentAddress":"0xYourWallet","chainId":11155111,"fomo4clawLauncherAddress":"0x867038c4b23A7f26c67C4c368d4ab60ba97e598b"}' > launch-params.json
///      2. Run: export LAUNCH_PARAMS_JSON=./launch-params.json FOMO4CLAW_LAUNCHER=0x867038c4b23A7f26c67C4c368d4ab60ba97e598b
///         forge script script/LaunchFromParamsSepolia.s.sol:LaunchFromParamsSepolia --rpc-url "$RPC_URL" --broadcast -vvvv
contract LaunchFromParamsSepolia is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address launcher = vm.envAddress("FOMO4CLAW_LAUNCHER");
        string memory path = vm.envString("LAUNCH_PARAMS_JSON");

        string memory json = vm.readFile(path);

        // Parse launchParams from JSON (prepare-launch API response shape). Foundry uses JSONpath: paths start with .
        string memory name = vm.parseJsonString(json, ".launchParams.name");
        string memory symbol = vm.parseJsonString(json, ".launchParams.symbol");
        string memory description = vm.parseJsonString(json, ".launchParams.tokenMetadata.description");
        string memory website = vm.parseJsonString(json, ".launchParams.tokenMetadata.website");
        string memory image = vm.parseJsonString(json, ".launchParams.tokenMetadata.image");
        address vestingBeneficiary = vm.parseJsonAddress(json, ".launchParams.vestingBeneficiary");
        uint64 vestingStart = uint64(vm.parseJsonUint(json, ".launchParams.vestingStart"));
        bytes memory auctionParams = vm.parseJsonBytes(json, ".launchParams.auctionParams");
        bytes32 salt = vm.parseJsonBytes32(json, ".launchParams.salt");
        uint64 migrationBlock = uint64(vm.parseJsonUint(json, ".launchParams.migrationBlock"));
        uint64 sweepBlock = uint64(vm.parseJsonUint(json, ".launchParams.sweepBlock"));
        address currency = vm.parseJsonAddress(json, ".launchParams.currency");
        uint64 airdropUnlockBlock = uint64(vm.parseJsonUint(json, ".launchParams.airdropUnlockBlock"));

        // tokenMetadata bytes = abi.encode(description, website, image) (UERC20Metadata)
        bytes memory tokenMetadata = abi.encode(description, website, image);

        Fomo4ClawLauncher.LaunchParams memory params = Fomo4ClawLauncher.LaunchParams({
            name: name,
            symbol: symbol,
            tokenMetadata: tokenMetadata,
            vestingBeneficiary: vestingBeneficiary,
            vestingStart: vestingStart,
            auctionParams: auctionParams,
            salt: salt,
            migrationBlock: migrationBlock,
            sweepBlock: sweepBlock,
            currency: currency,
            airdropUnlockBlock: airdropUnlockBlock
        });

        console2.log("Launching ICO via Fomo4ClawLauncher:", launcher);
        console2.log("Token:", name, symbol);
        console2.log("Vesting beneficiary:", vestingBeneficiary);

        vm.startBroadcast(pk);
        Fomo4ClawLauncher(launcher).launch(params);
        vm.stopBroadcast();

        console2.log("Launch complete.");
    }
}
