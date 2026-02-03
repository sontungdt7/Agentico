// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";

interface IERC8004Registry {
    /// @notice Register (mint) an identity NFT to msg.sender with the given token URI.
    /// @param uri Agent metadata URI (e.g. IPFS or HTTPS JSON with name, description, image, endpoints).
    function register(string calldata uri) external;
}

/// @notice Registers the caller's wallet as an AI agent on ERC-8004 Identity Registry (Sepolia).
/// @dev Call this from the wallet that will later call Fomo4ClawLauncher.launch().
///      Set AGENT_URI to your agent metadata URI (IPFS or HTTPS). Example:
///      export AGENT_URI="https://your-domain.com/agent.json"
///      forge script script/RegisterAgentSepolia.s.sol:RegisterAgentSepolia --rpc-url "$RPC_URL" --broadcast -vvvv
contract RegisterAgentSepolia is Script {
    address constant IDENTITY_REGISTRY = 0x7177a6867296406881E20d6647232314736Dd09A;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        string memory uri = vm.envString("AGENT_URI");
        address sender = vm.addr(pk);

        console2.log("Registering agent on Sepolia ERC-8004 Identity Registry");
        console2.log("Registry:", IDENTITY_REGISTRY);
        console2.log("Owner:", sender);
        console2.log("Agent URI:", uri);

        vm.startBroadcast(pk);
        IERC8004Registry(IDENTITY_REGISTRY).register(uri);
        vm.stopBroadcast();

        console2.log("Registration complete. This wallet can now call Fomo4ClawLauncher.launch().");
    }
}
