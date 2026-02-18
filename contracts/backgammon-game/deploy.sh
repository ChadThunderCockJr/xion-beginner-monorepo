#!/bin/bash
set -e

# Configuration
CHAIN_ID="xion-testnet-2"
NODE="https://rpc.xion-testnet-2.burnt.com:443"
USDC_DENOM="ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4"

# Your wallet (set this before running)
WALLET_ADDRESS="${WALLET_ADDRESS:-}"
ESCROW_CONTRACT="${ESCROW_CONTRACT:-}"
SERVER_ADDRESS="${SERVER_ADDRESS:-}"

if [ -z "$WALLET_ADDRESS" ]; then
    echo "Error: Set WALLET_ADDRESS environment variable"
    echo "Usage: WALLET_ADDRESS=xion1... [ESCROW_CONTRACT=xion1...] [SERVER_ADDRESS=xion1...] ./deploy.sh"
    exit 1
fi

WASM_FILE="./artifacts/backgammon_game.wasm"

if [ ! -f "$WASM_FILE" ]; then
    echo "Building contract..."
    cargo build --release --target wasm32-unknown-unknown
    mkdir -p ./artifacts
    cp ./target/wasm32-unknown-unknown/release/backgammon_game.wasm ./artifacts/
fi

echo "==================================="
echo "Backgammon Game Contract Deployment"
echo "==================================="
echo "Chain:           $CHAIN_ID"
echo "Wallet:          $WALLET_ADDRESS"
echo "Escrow Contract: ${ESCROW_CONTRACT:-<not set>}"
echo "Server Address:  ${SERVER_ADDRESS:-<not set>}"
echo "USDC Denom:      $USDC_DENOM"
echo "==================================="
echo ""

# Build instantiation message
ESCROW_FIELD="null"
if [ -n "$ESCROW_CONTRACT" ]; then
    ESCROW_FIELD="\"$ESCROW_CONTRACT\""
fi

SERVER_FIELD="null"
if [ -n "$SERVER_ADDRESS" ]; then
    SERVER_FIELD="\"$SERVER_ADDRESS\""
fi

# Step 1: Store the backgammon-game contract
echo "Step 1: Storing backgammon-game contract code..."
echo ""
echo "xiond tx wasm store $WASM_FILE \\"
echo "  --from $WALLET_ADDRESS \\"
echo "  --chain-id $CHAIN_ID \\"
echo "  --node $NODE \\"
echo "  --gas auto \\"
echo "  --gas-adjustment 1.5 \\"
echo "  --gas-prices 0.025uxion \\"
echo "  -y"
echo ""
echo "Get CODE_ID: xiond query tx <TXHASH> --node $NODE | grep -A1 'code_id'"
echo ""

# Step 2: Instantiate backgammon-game
echo "Step 2: Instantiate backgammon-game (replace GAME_CODE_ID):"
echo ""
cat << EOF
INIT_MSG='{"escrow_contract":$ESCROW_FIELD,"server_address":$SERVER_FIELD,"usdc_denom":"$USDC_DENOM"}'

xiond tx wasm instantiate GAME_CODE_ID "\$INIT_MSG" \\
  --from $WALLET_ADDRESS \\
  --label "backgammon-game-v1" \\
  --chain-id $CHAIN_ID \\
  --node $NODE \\
  --admin $WALLET_ADDRESS \\
  --gas auto \\
  --gas-adjustment 1.5 \\
  --gas-prices 0.025uxion \\
  -y
EOF
echo ""
echo "Get GAME_ADDRESS: xiond query tx <TXHASH> --node $NODE | grep -A1 '_contract_address'"
echo ""

# Step 3: Update config with escrow and server addresses (if not set at instantiation)
echo "Step 3: Update config with escrow/server addresses (replace addresses):"
echo ""
cat << EOF
UPDATE_MSG='{"update_config":{"escrow_contract":"ESCROW_ADDRESS","server_address":"SERVER_ADDRESS"}}'

xiond tx wasm execute GAME_ADDRESS "\$UPDATE_MSG" \\
  --from $WALLET_ADDRESS \\
  --chain-id $CHAIN_ID \\
  --node $NODE \\
  --gas auto \\
  --gas-adjustment 1.5 \\
  --gas-prices 0.025uxion \\
  -y
EOF
echo ""
echo "==================================="
echo "After deployment, update your app config:"
echo "BACKGAMMON_GAME_CONTRACT=<GAME_ADDRESS>"
echo "==================================="
echo ""
echo "Notes:"
echo "- escrow_contract: Wager escrow contract for settlement"
echo "- server_address: Authorized game server that can report results"
echo "- Both can be set at instantiation or updated later via UpdateConfig"
echo "==================================="
