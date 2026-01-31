# Agentico Smart Contracts

Agentico contracts for the AI Agent ICO launchpad. These integrate with [liquidity-launcher](../../liquidity-launcher/) for token creation, LBP auction, and Uniswap V4 migration.

## Contracts

### Core

- **AgenticoLauncher** — Orchestrator: ERC-8004 check, `launch(LaunchParams)` only. Agents cannot call `multicall` directly. Deploys two OpenZeppelin VestingWallets per launch (agent 65%, platform 5%), transfers 10% to airdrop, 20% to LBP.
- **AgenticoFeeSplitter** — Inherits `AgenticoPositionFeesForwarder` (PositionFeesForwarder logic) + OpenZeppelin `PaymentSplitter`. Holds LP NFT; `collectFees(tokenId)` harvests fees to self; agent/platform call `release(token, account)` for 80/20 split.
- **AgenticoFeeSplitterFactory** — Deploys AgenticoFeeSplitter per launch. Constructor: `(positionManager, timelockBlockNumber)`.
- **VestingWallet** (OpenZeppelin) — Used directly. Two deployed per launch: one for agent (65%), one for platform (5%). Each holds one token; beneficiaries call `release(token)` to claim vested amounts.
- **AgenticoAirdrop** — 10% FCFS per token for first 10k ERC-8004 agents. `deposit(token, amount, unlockBlock)` called by AgenticoLauncher after transfer.

### Interfaces

- **ILiquidityLauncher** — `createToken`, `distributeToken`, `getGraffiti`, `multicall`
- **IUERC20Factory** — `getUERC20Address`
- **IAgenticoFeeSplitterFactory** — `deploy(agent, platformTreasury)`

### Types

- **Distribution** — `strategy`, `amount`, `configData`
- **MigratorParameters** — Full struct for FullRangeLBPStrategy

## AgenticoLauncher constructor

```solidity
constructor(
    address _liquidityLauncher,      // 0x00000008412db3394C91A5CbD01635c6d140637C
    address _identityRegistry,       // ERC-8004: 0x7177a6867296406881E20d6647232314736Dd09A
    address _platformTreasury,       // Agentico treasury (20% of swap fees, 5% vesting)
    address _feeSplitterFactory,     // AgenticoFeeSplitterFactory
    address _airdropContract,        // AgenticoAirdrop (singleton)
    address _uerc20Factory,          // Sepolia: 0xD97d0c9FB20CF472D4d52bD8e0468A6C010ba448
    address _fullRangeLBPFactory,    // Sepolia: 0x89Dd5691e53Ea95d19ED2AbdEdCf4cBbE50da1ff
    address _ccaFactory              // Sepolia: 0xcca1101C61cF5cb44C968947985300DF945C3565
)
```

## LaunchParams

```solidity
struct LaunchParams {
    string name;
    string symbol;
    bytes tokenMetadata;           // abi.encode(UERC20Metadata)
    address vestingBeneficiary;    // Agent address
    uint64 vestingStart;           // Timestamp
    bytes auctionParams;           // abi.encode(AuctionParameters)
    bytes32 salt;                  // Create2 salt for LBP (from mine_salt)
    uint64 migrationBlock;         // Block when LBP can migrate to V4
    uint64 sweepBlock;             // Block when operator can sweep
    address currency;              // Auction currency (e.g. WETH)
    uint64 airdropUnlockBlock;     // Block when airdrop claims can begin
}
```

**Fixed**: decimals = 18, totalSupply = 1 billion (1e9 * 1e18).

## Launch flow

`AgenticoLauncher.launch(params)` — simplified: AgenticoLauncher receives 100%, then distributes:

1. Check `identityRegistry.balanceOf(msg.sender) > 0` (revert if not agent)
2. Deploy `AgenticoFeeSplitter` (positionRecipient for LBP)
3. `createToken(recipient: AgenticoLauncher)` — AgenticoLauncher gets 100%
4. Transfer 10% to airdrop, call `airdrop.deposit(token, amount, unlockBlock)`
5. Deploy two VestingWallets (agent 65%, platform 5%), transfer tokens to each
6. Transfer 20% to LiquidityLauncher, call `distributeToken(LBP, 20%, false, salt)`

## Liquidity-launcher integration

Contracts use **local interfaces** (no import from liquidity-launcher) so they compile with only OpenZeppelin.

To test against liquidity-launcher:

- Clone [liquidity-launcher](https://github.com/Uniswap/liquidity-launcher) next to Agentico:
  ```bash
  cd /home/metta
  git clone https://github.com/Uniswap/liquidity-launcher
  ```
- Or add as submodule at Agentico root:
  ```bash
  cd /home/metta/Agentico
  git submodule add https://github.com/Uniswap/liquidity-launcher liquidity-launcher
  ```
- Remapping `liquidity-launcher/=../liquidity-launcher/src/` in `remappings.txt` points to that path.

## Build

```bash
forge build
```

(via_ir is enabled to avoid stack-too-deep in `_buildMulticall`.)

## Deploy

See [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) for full deployment and salt mining guide.

Deploy order:

1. **AgenticoAirdrop** — Constructor: `identityRegistry`
2. **AgenticoFeeSplitterFactory** — Constructor: `positionManager`, `timelockBlockNumber` (use `type(uint256).max` for permanent LP lock)
3. **AgenticoLauncher** — Constructor: 8 addresses (no vesting contract; VestingWallets deployed per launch)

Deploy to Ethereum Sepolia first, then mainnet.
