#!/usr/bin/env bash
# Agentico test flow — follows docs/TEST.md
# Usage:
#   ./scripts/test-flow.sh [--step 0|1|2|3|4|all]
#   --step 0: create wallet (print address; you set PRIVATE_KEY and fund, then re-run)
#   --step 1: check balance
#   --step 2: register on ERC-8004
#   --step 3: get launch params (prepare-launch API)
#   --step 4: launch token
#   --step all (default): run steps 1–4 (requires PRIVATE_KEY set and wallet funded)
#
# Env (defaults shown):
#   PRIVATE_KEY       (required for steps 2,3,4)
#   RPC_URL           https://rpc.sepolia.org
#   AGENTICO_LAUNCHER 0x867038c4b23A7f26c67C4c368d4ab60ba97e598b
#   APP_URL           http://localhost:3000  (prepare-launch API base)
#   AGENT_URI         https://example.com/agent.json  (for step 2 only)
# For saltMined: true in step 3, the app must have FEE_SPLITTER_FACTORY set (and optionally SALT_MINER_URL).

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS_DIR="$REPO_ROOT/contracts"
LAUNCH_PARAMS_FILE="$CONTRACTS_DIR/launch-params.json"

# Defaults
RPC_URL="${RPC_URL:-https://rpc.sepolia.org}"
AGENTICO_LAUNCHER="${AGENTICO_LAUNCHER:-0x867038c4b23A7f26c67C4c368d4ab60ba97e598b}"
APP_URL="${APP_URL:-http://localhost:3000}"
APP_URL="${APP_URL%/}"
AGENT_URI="${AGENT_URI:-https://example.com/agent.json}"

STEP="all"
if [[ "${1:-}" == "--step" && -n "${2:-}" ]]; then
  STEP="$2"
fi

# Load .env from repo root if present
if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$REPO_ROOT/.env"
  set +a
fi

echo "=== Agentico test flow (step: $STEP) ==="
echo "  RPC_URL=$RPC_URL"
echo "  AGENTICO_LAUNCHER=$AGENTICO_LAUNCHER"
echo "  APP_URL=$APP_URL"

run_step_0() {
  echo ""
  echo "--- Step 0: Create wallet ---"
  if [[ -n "${PRIVATE_KEY:-}" ]]; then
    AGENT_ADDRESS="$(cast wallet address --private-key "$PRIVATE_KEY" 2>/dev/null || true)"
    if [[ -n "$AGENT_ADDRESS" ]]; then
      echo "PRIVATE_KEY is set. Agent address: $AGENT_ADDRESS"
      echo "Run with --step 1 to check balance, or --step all to run steps 1–4."
      return 0
    fi
  fi
  echo "Generating a new wallet (dev only)."
  NEW_KEY="0x$(openssl rand -hex 32)"
  AGENT_ADDRESS="$(cast wallet address --private-key "$NEW_KEY")"
  echo ""
  echo "  Private key (save it; used as agent wallet):"
  echo "    $NEW_KEY"
  echo "  Address (fund this with Sepolia ETH):"
  echo "    $AGENT_ADDRESS"
  echo ""
  echo "Then: export PRIVATE_KEY=$NEW_KEY"
  echo "      Fund $AGENT_ADDRESS at https://sepoliafaucet.com/"
  echo "      Re-run: ./scripts/test-flow.sh --step all"
  exit 0
}

run_step_1() {
  echo ""
  echo "--- Step 1: Check balance ---"
  require_private_key
  AGENT_ADDRESS="$(cast wallet address --private-key "$PRIVATE_KEY")"
  echo "Agent address: $AGENT_ADDRESS"
  BALANCE_WEI="$(cast balance "$AGENT_ADDRESS" --rpc-url "$RPC_URL" 2>/dev/null || echo 0)"
  BALANCE_ETH="$(cast from-wei "$BALANCE_WEI" ether 2>/dev/null || echo 0)"
  echo "Balance: $BALANCE_ETH ETH (Sepolia)"
  if [[ "$BALANCE_WEI" -eq 0 ]]; then
    echo "  -> Fund the wallet at https://sepoliafaucet.com/ then re-run."
    exit 1
  fi
  echo "  -> OK"
}

run_step_2() {
  echo ""
  echo "--- Step 2: Register on ERC-8004 ---"
  require_private_key
  echo "AGENT_URI=$AGENT_URI"
  (cd "$CONTRACTS_DIR" && \
    PRIVATE_KEY="$PRIVATE_KEY" RPC_URL="$RPC_URL" AGENT_URI="$AGENT_URI" \
    forge script script/RegisterAgentSepolia.s.sol:RegisterAgentSepolia \
      --rpc-url "$RPC_URL" \
      --broadcast -vvvv)
  echo "  -> Registration complete."
}

run_step_3() {
  echo ""
  echo "--- Step 3: Get launch params (prepare-launch API) ---"
  require_private_key
  AGENT_ADDRESS="$(cast wallet address --private-key "$PRIVATE_KEY")"
  echo "Calling $APP_URL/api/prepare-launch for agent $AGENT_ADDRESS"
  HTTP_CODE="$(curl -s -o "$LAUNCH_PARAMS_FILE" -w '%{http_code}' -X POST "$APP_URL/api/prepare-launch" \
    -H "Content-Type: application/json" \
    -d "{\"agentAddress\": \"$AGENT_ADDRESS\", \"chainId\": 11155111, \"agenticoLauncherAddress\": \"$AGENTICO_LAUNCHER\"}")"
  if [[ "$HTTP_CODE" != "200" ]]; then
    echo "  -> API returned HTTP $HTTP_CODE. Response:"
    cat "$LAUNCH_PARAMS_FILE" | head -c 800
    echo ""
    exit 1
  fi
  if ! grep -q '"launchParams"' "$LAUNCH_PARAMS_FILE" 2>/dev/null; then
    echo "  -> Response missing launchParams. Response:"
    cat "$LAUNCH_PARAMS_FILE" | head -c 800
    echo ""
    exit 1
  fi
  echo "  -> Saved to $LAUNCH_PARAMS_FILE"
}

run_step_4() {
  echo ""
  echo "--- Step 4: Launch token ---"
  require_private_key
  if [[ ! -f "$LAUNCH_PARAMS_FILE" ]]; then
    echo "  -> Missing $LAUNCH_PARAMS_FILE. Run step 3 first."
    exit 1
  fi
  (cd "$CONTRACTS_DIR" && \
    PRIVATE_KEY="$PRIVATE_KEY" RPC_URL="$RPC_URL" AGENTICO_LAUNCHER="$AGENTICO_LAUNCHER" \
    LAUNCH_PARAMS_JSON=./launch-params.json \
    forge script script/LaunchFromParamsSepolia.s.sol:LaunchFromParamsSepolia \
      --rpc-url "$RPC_URL" \
      --broadcast -vvvv)
  echo "  -> Launch complete."
}

require_private_key() {
  if [[ -z "${PRIVATE_KEY:-}" ]]; then
    echo "PRIVATE_KEY is not set. Set it or run with --step 0 to create a wallet."
    exit 1
  fi
}

case "$STEP" in
  0) run_step_0 ;;
  1) run_step_1 ;;
  2) run_step_2 ;;
  3) run_step_3 ;;
  4) run_step_4 ;;
  all)
    run_step_1
    run_step_2
    run_step_3
    run_step_4
    echo ""
    echo "=== All steps complete ==="
    ;;
  *)
    echo "Unknown step: $STEP. Use --step 0|1|2|3|4|all"
    exit 1
    ;;
esac
