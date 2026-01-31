// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {FullRangeLBPStrategy} from "liquidity-launcher/strategies/lbp/FullRangeLBPStrategy.sol";
import {MigratorParameters} from "liquidity-launcher/types/MigratorParameters.sol";
import {AuctionParameters} from "@uniswap/continuous-clearing-auction/src/interfaces/IContinuousClearingAuction.sol";
import {AuctionStepsBuilder} from "@uniswap/continuous-clearing-auction/test/utils/AuctionStepsBuilder.sol";
import {FixedPoint96} from "@uniswap/v4-core/src/libraries/FixedPoint96.sol";
import {IUERC20Factory} from "@uniswap/uerc20-factory/src/interfaces/IUERC20Factory.sol";
import {ILiquidityLauncher} from "liquidity-launcher/interfaces/ILiquidityLauncher.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

/// @notice Outputs FullRangeLBPStrategy init code hash for Agentico launches on Ethereum Sepolia
/// @dev Required env: PRIVATE_KEY, AGENTICO_LAUNCHER, AGENT_ADDRESS, FEE_SPLITTER_FACTORY, FEE_SPLITTER_FACTORY_NONCE (default 0).
///      Optional: CURRENT_BLOCK, CURRENCY (Sepolia WETH), TOKEN_NAME, TOKEN_SYMBOL.
///      The params must match what will be used in the actual launch() call.
contract GetInitCodeHashSepolia is Script {
    using AuctionStepsBuilder for bytes;

    address constant LIQUIDITY_LAUNCHER = 0x00000008412db3394C91A5CbD01635c6d140637C;
    address constant FULL_RANGE_LBP_FACTORY = 0x89Dd5691e53Ea95d19ED2AbdEdCf4cBbE50da1ff;
    address constant UERC20_FACTORY = 0xD97d0c9FB20CF472D4d52bD8e0468A6C010ba448;
    address constant CCA_FACTORY = 0xcca1101C61cF5cb44C968947985300DF945C3565;
    address constant SEPOLIA_WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    IPositionManager constant POSITION_MANAGER = IPositionManager(0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4);
    IPoolManager constant POOL_MANAGER = IPoolManager(0xE03A1074c86CFeDd5C142C4F04F1a1536e203543);

    function run() external view {
        vm.envUint("PRIVATE_KEY"); // required for forge script
        address agent = vm.envAddress("AGENT_ADDRESS");
        address agenticoLauncher = vm.envAddress("AGENTICO_LAUNCHER");
        address feeSplitterFactory = vm.envAddress("FEE_SPLITTER_FACTORY");
        uint64 feeSplitterFactoryNonce = uint64(vm.envOr("FEE_SPLITTER_FACTORY_NONCE", uint256(0)));
        uint256 currentBlock = vm.envOr("CURRENT_BLOCK", block.number);
        if (currentBlock == 0) currentBlock = block.number;
        address currency = vm.envOr("CURRENCY", SEPOLIA_WETH);
        string memory tokenName = vm.envOr("TOKEN_NAME", string("Agent Token"));
        string memory tokenSymbol = vm.envOr("TOKEN_SYMBOL", string("AGNT"));

        // Predict fee splitter address: next CREATE from factory
        address feeSplitter = vm.computeCreateAddress(feeSplitterFactory, feeSplitterFactoryNonce);

        (uint64 migrationBlock, uint64 sweepBlock) = _blocks(uint64(currentBlock));

        MigratorParameters memory migratorParams = MigratorParameters({
            migrationBlock: migrationBlock,
            currency: currency,
            poolLPFee: 10000, // 1%
            poolTickSpacing: 200, // conventional for 1%
            tokenSplit: 5e6, // 50% to auction, 50% to LP
            initializerFactory: CCA_FACTORY,
            positionRecipient: feeSplitter,
            sweepBlock: sweepBlock,
            operator: agent,
            maxCurrencyAmountForLP: type(uint128).max
        });

        // Auction: ~300 blocks duration. Steps: sum(mps * blockDelta) = 1e7, sum(blockDelta) = 300
        bytes memory auctionStepsData = AuctionStepsBuilder.init().addStep(33334, 100).addStep(33333, 200);
        uint64 auctionDurationBlocks = 300;
        AuctionParameters memory auctionParams = AuctionParameters({
            currency: currency,
            tokensRecipient: agenticoLauncher,
            fundsRecipient: agent,
            startBlock: uint64(currentBlock),
            endBlock: uint64(currentBlock + auctionDurationBlocks),
            claimBlock: uint64(currentBlock + auctionDurationBlocks + 10),
            tickSpacing: 100 << FixedPoint96.RESOLUTION,
            validationHook: address(0),
            floorPrice: 1000 << FixedPoint96.RESOLUTION,
            requiredCurrencyRaised: 0,
            auctionStepsData: auctionStepsData
        });

        uint128 initialSupply = 1_000_000_000 * 1e18; // 1 billion

        bytes32 graffiti = ILiquidityLauncher(LIQUIDITY_LAUNCHER).getGraffiti(agenticoLauncher);
        address token = IUERC20Factory(UERC20_FACTORY).getUERC20Address(
            tokenName,
            tokenSymbol,
            18,
            LIQUIDITY_LAUNCHER,
            graffiti
        );

        bytes memory deployedBytecode = abi.encodePacked(
            type(FullRangeLBPStrategy).creationCode,
            abi.encode(
                token,
                initialSupply,
                migratorParams,
                abi.encode(auctionParams),
                POSITION_MANAGER,
                POOL_MANAGER
            )
        );
        bytes32 initCodeHash = keccak256(deployedBytecode);

        console2.log("SEPOLIA_INIT_CODE_HASH=%s", vm.toString(initCodeHash));
    }

    function _blocks(uint64 base) internal pure returns (uint64 migrationBlock, uint64 sweepBlock) {
        migrationBlock = base + 500;
        sweepBlock = base + 1_000;
    }
}
