# Salt Generator for Agentico

Finds Create2 salts so the deployed FullRangeLBPStrategy address is a valid Uniswap v4 hook.

## Build

```bash
cd script/saltGenerator
cargo build --release
```

## Usage

Use the top-level `mine_salt_sepolia.sh` script — see [docs/DEPLOYMENT.md](../../../docs/DEPLOYMENT.md).

## Reference

Adapted from [liquidity-launcher/test/saltGenerator](https://github.com/Uniswap/liquidity-launcher/tree/main/test/saltGenerator).
