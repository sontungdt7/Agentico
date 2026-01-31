// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title MigratorParameters
/// @notice Matches liquidity-launcher MigratorParameters for FullRangeLBPStrategy
struct MigratorParameters {
    uint64 migrationBlock;
    address currency;
    uint24 poolLPFee;
    int24 poolTickSpacing;
    uint24 tokenSplit;
    address initializerFactory;
    address positionRecipient;
    uint64 sweepBlock;
    address operator;
    uint128 maxCurrencyAmountForLP;
}
