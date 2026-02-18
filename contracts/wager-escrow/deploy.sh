#!/bin/bash
set -e

# Configuration
CHAIN_ID="xion-testnet-2"
NODE="https://rpc.xion-testnet-2.burnt.com:443"
USDC_DENOM="ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4"
RAKE_BPS="250"              # 2.5% platform rake
MIN_WAGER="1000000"         # 1 USDC (6 decimals)
MAX_WAGER="100000000"       # 100 USDC
TIMEOUT_SECONDS="300"       # 5 minutes

# Your wallet (set this before running)
WALLET_ADDRESS="${WALLET_ADDRESS:-}"
RAKE_RECIPIENT="${RAKE_RECIPIENT:-$WALLET_ADDRESS}"

if [ -z "$WALLET_ADDRESS" ]; then
    echo "Error: Set WALLET_ADDRESS environment variable"
    echo "Usage: WALLET_ADDRESS=xion1... RAKE_RECIPIENT=xion1... ./deploy.sh"
    exit 1
fi

WASM_FILE="./artifacts/wager_escrow.wasm"

if [ ! -f "$WASM_FILE" ]; then
    echo "Building contract..."
    cargo build --release --target wasm32-unknown-unknown
    mkdir -p ./artifacts
    cp ./target/wasm32-unknown-unknown/release/wager_escrow.wasm ./artifacts/
fi

echo "==================================="
echo "Wager Escrow Contract Deployment"
echo "==================================="
echo "Chain:           $CHAIN_ID"
echo "Wallet:          $WALLET_ADDRESS"
echo "Rake Recipient:  $RAKE_RECIPIENT"
echo "Rake BPS:        $RAKE_BPS ($(echo "scale=2; $RAKE_BPS / 100" | bc)%)"
echo "Min Wager:       $MIN_WAGER ($((MIN_WAGER / 1000000)) USDC)"
echo "Max Wager:       $MAX_WAGER ($((MAX_WAGER / 1000000)) USDC)"
echo "Timeout:         $TIMEOUT_SECONDS seconds"
echo "==================================="
echo ""

# Step 1: Store the wager-escrow contract
echo "Step 1: Storing wager-escrow contract code..."
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

# Step 2: Instantiate wager-escrow
echo "Step 2: Instantiate wager-escrow (replace ESCROW_CODE_ID):"
echo ""
cat << EOF
INIT_MSG='{"usdc_denom":"$USDC_DENOM","rake_bps":$RAKE_BPS,"rake_recipient":"$RAKE_RECIPIENT","min_wager":$MIN_WAGER,"max_wager":$MAX_WAGER,"timeout_seconds":$TIMEOUT_SECONDS,"game_contract":null}'

xiond tx wasm instantiate ESCROW_CODE_ID "\$INIT_MSG" \\
  --from $WALLET_ADDRESS \\
  --label "wager-escrow-v1" \\
  --chain-id $CHAIN_ID \\
  --node $NODE \\
  --admin $WALLET_ADDRESS \\
  --gas auto \\
  --gas-adjustment 1.5 \\
  --gas-prices 0.025uxion \\
  -y
EOF
echo ""
echo "Get ESCROW_ADDRESS: xiond query tx <TXHASH> --node $NODE | grep -A1 '_contract_address'"
echo ""

# Step 3: Set game contract (after deploying the game server)
echo "Step 3: Set the game contract that can settle matches (replace addresses):"
echo ""
cat << EOF
UPDATE_MSG='{"update_config":{"game_contract":"GAME_CONTRACT_ADDRESS"}}'

xiond tx wasm execute ESCROW_ADDRESS "\$UPDATE_MSG" \\
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
echo "WAGER_ESCROW_CONTRACT=<ESCROW_ADDRESS>"
echo "==================================="
echo ""
echo "Notes:"
echo "- The admin (deployer) can create escrows and settle games"
echo "- Set game_contract to allow a backend service to settle games"
echo "- Players deposit USDC directly into the escrow contract"
echo "- Winner receives (2 * wager) minus the platform rake"
echo "==================================="
