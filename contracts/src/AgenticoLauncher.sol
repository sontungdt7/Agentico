// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {VestingWallet} from "@openzeppelin/contracts/finance/VestingWallet.sol";
import {ILiquidityLauncher} from "./interfaces/ILiquidityLauncher.sol";
import {IAgenticoFeeSplitterFactory} from "./interfaces/IAgenticoFeeSplitterFactory.sol";
import {Distribution} from "./types/Distribution.sol";
import {MigratorParameters} from "./types/MigratorParameters.sol";

/// @title AgenticoLauncher
/// @notice Orchestrator for Agentico ICO launches. Only ERC-8004 registered agents can launch.
/// @dev Simplified flow: createToken(recipient=this) -> AgenticoLauncher gets 100%.
/// Transfer 10% to airdrop, 65% to agent VestingWallet, 5% to platform VestingWallet; use 20% via distributeToken (LBP).
contract AgenticoLauncher {
    using SafeERC20 for IERC20;

    uint8 public constant DECIMALS = 18;
    uint128 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18; // 1 billion
    uint64 public constant VESTING_DURATION = 5 * 365 * 24 * 60 * 60; // 5 years

    address public immutable liquidityLauncher;
    IERC721 public immutable identityRegistry;
    address public immutable platformTreasury;
    address public immutable feeSplitterFactory;
    address public immutable airdropContract;
    address public immutable uerc20Factory;
    address public immutable fullRangeLBPFactory;
    address public immutable ccaFactory;

    error NotRegisteredAgent();

    struct LaunchParams {
        string name;
        string symbol;
        bytes tokenMetadata;
        address vestingBeneficiary;
        uint64 vestingStart;
        bytes auctionParams;
        bytes32 salt;
        uint64 migrationBlock;
        uint64 sweepBlock;
        address currency;
        uint64 airdropUnlockBlock; // block when airdrop claims can begin
    }

    constructor(
        address _liquidityLauncher,
        address _identityRegistry,
        address _platformTreasury,
        address _feeSplitterFactory,
        address _airdropContract,
        address _uerc20Factory,
        address _fullRangeLBPFactory,
        address _ccaFactory
    ) {
        liquidityLauncher = _liquidityLauncher;
        identityRegistry = IERC721(_identityRegistry);
        platformTreasury = _platformTreasury;
        feeSplitterFactory = _feeSplitterFactory;
        airdropContract = _airdropContract;
        uerc20Factory = _uerc20Factory;
        fullRangeLBPFactory = _fullRangeLBPFactory;
        ccaFactory = _ccaFactory;
    }

    /// @notice Launch an ICO. Only callable by wallets holding ERC-8004 identity.
    /// @dev Flow: createToken(recipient=this) -> 100% to AgenticoLauncher.
    /// Transfer 10% to airdrop, 70% to vesting; 20% via distributeToken (LBP).
    function launch(LaunchParams calldata params) external {
        if (identityRegistry.balanceOf(msg.sender) == 0) revert NotRegisteredAgent();

        uint256 supply = uint256(TOTAL_SUPPLY);
        uint256 amount20 = (supply * 20) / 100;
        uint256 amount10 = (supply * 10) / 100;
        uint256 amount65 = (supply * 65) / 100;
        uint256 amount5 = (supply * 5) / 100;

        // 1) Deploy fee splitter (positionRecipient for LBP)
        address feeSplitter = IAgenticoFeeSplitterFactory(feeSplitterFactory).deploy(msg.sender, platformTreasury);

        // 2) Create token — recipient = AgenticoLauncher (this contract gets 100%)
        address token = ILiquidityLauncher(liquidityLauncher).createToken(
            uerc20Factory,
            params.name,
            params.symbol,
            DECIMALS,
            TOTAL_SUPPLY,
            address(this),
            params.tokenMetadata
        );

        // 3) Transfer 10% to airdrop and initialize
        IERC20(token).safeTransfer(airdropContract, amount10);
        IAgenticoAirdrop(airdropContract).deposit(token, amount10, params.airdropUnlockBlock);

        // 4) Deploy two VestingWallets (one per launch: start differs) — 65% agent, 5% platform
        VestingWallet agentVesting =
            new VestingWallet(params.vestingBeneficiary, params.vestingStart, VESTING_DURATION);
        VestingWallet platformVesting =
            new VestingWallet(platformTreasury, params.vestingStart, VESTING_DURATION);
        IERC20(token).safeTransfer(address(agentVesting), amount65);
        IERC20(token).safeTransfer(address(platformVesting), amount5);

        // 5) Transfer 20% to LiquidityLauncher, then distributeToken (LBP)
        IERC20(token).safeTransfer(liquidityLauncher, amount20);

        MigratorParameters memory migratorParams = MigratorParameters({
            migrationBlock: params.migrationBlock,
            currency: params.currency,
            poolLPFee: 10000, // 1% (hundredths of a bip: 10000 = 1%)
            poolTickSpacing: 200, // conventional for 1% fee (Uniswap v3 tier)
            tokenSplit: 5e6,
            initializerFactory: ccaFactory,
            positionRecipient: feeSplitter,
            sweepBlock: params.sweepBlock,
            operator: msg.sender,
            maxCurrencyAmountForLP: type(uint128).max
        });

        bytes memory lbpConfigData = abi.encode(migratorParams, params.auctionParams);

        ILiquidityLauncher(liquidityLauncher).distributeToken(
            token,
            Distribution({
                strategy: fullRangeLBPFactory,
                amount: uint128(amount20),
                configData: lbpConfigData
            }),
            false, // payerIsUser=false: LiquidityLauncher pays (we just sent it 20%)
            params.salt
        );
    }
}

/// @dev Minimal interface for airdrop deposit
interface IAgenticoAirdrop {
    function deposit(address token, uint256 amount, uint64 unlockBlock) external;
}
