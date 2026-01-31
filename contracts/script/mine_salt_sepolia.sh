#!/usr/bin/env bash
# Mine a salt for FullRangeLBPStrategy on Ethereum Sepolia (Agentico launches).
# The strategy address must be a valid Uniswap v4 hook (HOOK_MASK).
#
# Prerequisites:
#   1. Deploy Agentico contracts first (AgenticoLauncher, AgenticoFeeSplitterFactory)
#   2. Build the address miner: cd script/saltGenerator/addressMiner && cargo build --release
#
# Required env: PRIVATE_KEY, AGENTICO_LAUNCHER, AGENT_ADDRESS, FEE_SPLITTER_FACTORY
# Optional: RPC_URL (default https://rpc.sepolia.org), FEE_SPLITTER_FACTORY_NONCE (default 0)
#
# Outputs: SALT (hex bytes32) to stdout; exports CURRENT_BLOCK and SALT for use by forge script.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[[ -f "$ROOT/.env" ]] && set -a && source "$ROOT/.env" && set +a
[[ -f "$ROOT/../.env" ]] && set -a && source "$ROOT/../.env" && set +a
RPC_URL="${RPC_URL:-https://rpc.sepolia.org}"
MINER="$ROOT/script/saltGenerator/target/release/address-miner"

LIQUIDITY_LAUNCHER=0x00000008412db3394C91A5CbD01635c6d140637C
FULL_RANGE_LBP_FACTORY=0x89Dd5691e53Ea95d19ED2AbdEdCf4cBbE50da1ff
HOOK_MASK=0x0000000000000000000000000000000000002000

if [[ -z "$PRIVATE_KEY" ]]; then
  echo "PRIVATE_KEY required" >&2
  exit 1
fi
if [[ -z "$AGENTICO_LAUNCHER" ]]; then
  echo "AGENTICO_LAUNCHER required (deploy Agentico first)" >&2
  exit 1
fi
if [[ -z "$AGENT_ADDRESS" ]]; then
  echo "AGENT_ADDRESS required (wallet that will call launch)" >&2
  exit 1
fi
if [[ -z "$FEE_SPLITTER_FACTORY" ]]; then
  echo "FEE_SPLITTER_FACTORY required" >&2
  exit 1
fi

if [[ ! -x "$MINER" ]]; then
  echo "Build the address miner first:" >&2
  echo "  cd $ROOT/script/saltGenerator && cargo build --release" >&2
  exit 1
fi

CURRENT_BLOCK=$(cast block-number --rpc-url "$RPC_URL" 2>/dev/null)
if [[ -z "$CURRENT_BLOCK" ]]; then
  echo "Could not fetch block number from $RPC_URL" >&2
  exit 1
fi

export CURRENT_BLOCK
echo "CURRENT_BLOCK=$CURRENT_BLOCK" >&2

# msg_sender for salt hashing: AgenticoLauncher (calls LiquidityLauncher.distributeToken)
export AGENTICO_LAUNCHER
export AGENT_ADDRESS
export FEE_SPLITTER_FACTORY

OUT=$(cd "$ROOT" && forge script script/GetInitCodeHashSepolia.s.sol:GetInitCodeHashSepolia \
  --rpc-url "$RPC_URL" \
  -vvv 2>&1)
INIT_HASH=$(echo "$OUT" | grep -oE 'SEPOLIA_INIT_CODE_HASH=0x[a-fA-F0-9]{64}' | cut -d= -f2)
if [[ -z "$INIT_HASH" ]]; then
  echo "Could not extract SEPOLIA_INIT_CODE_HASH from GetInitCodeHash output" >&2
  echo "$OUT" | tail -80 >&2
  exit 1
fi

echo "SEPOLIA_INIT_CODE_HASH=$INIT_HASH" >&2
SALT=$("$MINER" "$INIT_HASH" "$HOOK_MASK" -m "$AGENTICO_LAUNCHER" -s "$FULL_RANGE_LBP_FACTORY" -l "$LIQUIDITY_LAUNCHER" -q)
export SALT
echo "export CURRENT_BLOCK=$CURRENT_BLOCK"
echo "export SALT=$SALT"
