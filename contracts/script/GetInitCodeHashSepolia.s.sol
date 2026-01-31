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

/// @notice Outputs FullRangeLBPStrategy init code hash for Agentico launches
/// @dev Required env: PRIVATE_KEY, AGENTICO_LAUNCHER, AGENT_ADDRESS, FEE_SPLITTER_FACTORY, FEE_SPLITTER_FACTORY_NONCE (default 0).
///      Optional: CURRENT_BLOCK, CURRENCY, TOKEN_NAME, TOKEN_SYMBOL.
///      Optional overrides for chain-specific deployments: LIQUIDITY_LAUNCHER, UERC20_FACTORY, FULL_RANGE_LBP_FACTORY.
///      Default addresses are for Base Sepolia (84532). For Ethereum Sepolia (11155111), set env vars if different.
contract GetInitCodeHashSepolia is Script {
    using AuctionStepsBuilder for bytes;

    // Default: Base Sepolia (liquidity-launcher deployed). Override via env for Ethereum Sepolia if deployed.
    address constant DEFAULT_LIQUIDITY_LAUNCHER = 0x00000008412db3394C91A5CbD01635c6d140637C;
    address constant DEFAULT_FULL_RANGE_LBP_FACTORY = 0xa3A236647c80BCD69CAD561ACf863c29981b6fbC; // Base Sepolia
    address constant DEFAULT_UERC20_FACTORY = 0xD97d0c9FB20CF472D4d52bD8e0468A6C010ba448; // Base Sepolia
    address constant CCA_FACTORY = 0xcca1101C61cF5cb44C968947985300DF945C3565;
    address constant SEPOLIA_WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant NATIVE_ETH = address(0); // CCA: address(0) = raise in ETH
    IPositionManager constant POSITION_MANAGER = IPositionManager(0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4);
    IPoolManager constant POOL_MANAGER = IPoolManager(0xE03A1074c86CFeDd5C142C4F04F1a1536e203543);

    function run() external view {
        vm.envUint("PRIVATE_KEY"); // required for forge script
        address agent = vm.envAddress("AGENT_ADDRESS");
        address agenticoLauncher = vm.envAddress("AGENTICO_LAUNCHER");
        address liquidityLauncher = vm.envOr("LIQUIDITY_LAUNCHER", DEFAULT_LIQUIDITY_LAUNCHER);
        address uerc20Factory = vm.envOr("UERC20_FACTORY", DEFAULT_UERC20_FACTORY);
        address feeSplitterFactory = vm.envAddress("FEE_SPLITTER_FACTORY");
        uint64 feeSplitterFactoryNonce = uint64(vm.envOr("FEE_SPLITTER_FACTORY_NONCE", uint256(0)));
        uint256 currentBlock = vm.envOr("CURRENT_BLOCK", block.number);
        if (currentBlock == 0) currentBlock = block.number;
        address currency = vm.envOr("CURRENCY", NATIVE_ETH); // default: native ETH
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

        // Auction: 1 week (50400 blocks), starting market cap 33 ETH
        // floorPrice Q96 = 33 * 2^96 / 1e9 for 1B supply
        uint256 floorPrice33Eth = (33 * FixedPoint96.Q96) / 1e9;
        uint64 auctionDurationBlocks = 50400; // 1 week
        uint256 step1Blocks = auctionDurationBlocks / 3;
        uint256 step2Blocks = auctionDurationBlocks - step1Blocks;
        uint24 mps1 = uint24(5e6 / step1Blocks);
        uint24 mps2 = uint24((1e7 - mps1 * step1Blocks) / step2Blocks);
        bytes memory auctionStepsData = AuctionStepsBuilder.init().addStep(mps1, uint40(step1Blocks)).addStep(mps2, uint40(step2Blocks));
        AuctionParameters memory auctionParams = AuctionParameters({
            currency: currency,
            tokensRecipient: agenticoLauncher,
            fundsRecipient: agent,
            startBlock: uint64(currentBlock),
            endBlock: uint64(currentBlock + auctionDurationBlocks),
            claimBlock: uint64(currentBlock + auctionDurationBlocks + 10),
            tickSpacing: 100 << FixedPoint96.RESOLUTION,
            validationHook: address(0),
            floorPrice: floorPrice33Eth,
            requiredCurrencyRaised: 0,
            auctionStepsData: auctionStepsData
        });

        uint128 initialSupply = 1_000_000_000 * 1e18; // 1 billion

        bytes32 graffiti = ILiquidityLauncher(liquidityLauncher).getGraffiti(agenticoLauncher);
        address token = IUERC20Factory(uerc20Factory).getUERC20Address(
            tokenName,
            tokenSymbol,
            18,
            liquidityLauncher,
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
