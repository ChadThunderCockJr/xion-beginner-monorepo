#!/bin/bash
set -e

# Configuration
CHAIN_ID="xion-testnet-2"
NODE="https://rpc.xion-testnet-2.burnt.com:443"
USDC_DENOM="ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4"
ENTRY_FEE="8000000"      # 8 USDC (6 decimals)
REFERRAL_REWARD="5000000" # 5 USDC
PLATFORM_FEE="3000000"    # 3 USDC

# Your wallet (set this before running)
WALLET_ADDRESS="${WALLET_ADDRESS:-}"
PLATFORM_ADDRESS="${PLATFORM_ADDRESS:-$WALLET_ADDRESS}"

if [ -z "$WALLET_ADDRESS" ]; then
    echo "Error: Set WALLET_ADDRESS environment variable"
    echo "Usage: WALLET_ADDRESS=xion1... PLATFORM_ADDRESS=xion1... ./deploy.sh"
    exit 1
fi

WASM_FILE="./artifacts/pyramid_splitter.wasm"

if [ ! -f "$WASM_FILE" ]; then
    echo "Building contract..."
    cargo build --release --target wasm32-unknown-unknown
    mkdir -p ./artifacts
    cp ./target/wasm32-unknown-unknown/release/pyramid_splitter.wasm ./artifacts/
fi

echo "==================================="
echo "Pyramid Splitter Contract Deployment"
echo "==================================="
echo "Chain:           $CHAIN_ID"
echo "Wallet:          $WALLET_ADDRESS"
echo "Platform:        $PLATFORM_ADDRESS"
echo "Entry Fee:       $ENTRY_FEE ($((ENTRY_FEE / 1000000)) USDC)"
echo "Referral Reward: $REFERRAL_REWARD ($((REFERRAL_REWARD / 1000000)) USDC)"
echo "Platform Fee:    $PLATFORM_FEE ($((PLATFORM_FEE / 1000000)) USDC)"
echo "==================================="
echo ""

# Step 1: Store the pyramid-splitter contract
echo "Step 1: Storing pyramid-splitter contract code..."
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

# Step 2: Instantiate pyramid-splitter
echo "Step 2: Instantiate pyramid-splitter (replace SPLITTER_CODE_ID):"
echo ""
cat << EOF
INIT_MSG='{"platform_address":"$PLATFORM_ADDRESS","usdc_denom":"$USDC_DENOM","entry_fee":$ENTRY_FEE,"referral_reward":$REFERRAL_REWARD,"platform_fee":$PLATFORM_FEE,"nft_contract":null,"crossmint_nft_contract":null}'

xiond tx wasm instantiate SPLITTER_CODE_ID "\$INIT_MSG" \\
  --from $WALLET_ADDRESS \\
  --label "pyramid-splitter-v3" \\
  --chain-id $CHAIN_ID \\
  --node $NODE \\
  --admin $WALLET_ADDRESS \\
  --gas auto \\
  --gas-adjustment 1.5 \\
  --gas-prices 0.025uxion \\
  -y
EOF
echo ""
echo "Get SPLITTER_ADDRESS: xiond query tx <TXHASH> --node $NODE | grep -A1 '_contract_address'"
echo ""

# Step 3: Store CW-721 contract
echo "Step 3: Download and store CW-721 NFT contract:"
echo ""
echo "curl -sL 'https://github.com/CosmWasm/cw-nfts/releases/download/v0.18.0/cw721_base.wasm' -o /tmp/cw721_base.wasm"
echo ""
echo "xiond tx wasm store /tmp/cw721_base.wasm \\"
echo "  --from $WALLET_ADDRESS \\"
echo "  --chain-id $CHAIN_ID \\"
echo "  --node $NODE \\"
echo "  --gas auto \\"
echo "  --gas-adjustment 1.5 \\"
echo "  --gas-prices 0.025uxion \\"
echo "  -y"
echo ""

# Step 4: Instantiate CW-721 with splitter as minter
echo "Step 4: Instantiate CW-721 (replace NFT_CODE_ID and SPLITTER_ADDRESS):"
echo ""
cat << EOF
NFT_INIT='{"name":"Pyramid Membership","symbol":"PYMB","minter":"SPLITTER_ADDRESS"}'

xiond tx wasm instantiate NFT_CODE_ID "\$NFT_INIT" \\
  --from $WALLET_ADDRESS \\
  --label "pyramid-membership-nft" \\
  --chain-id $CHAIN_ID \\
  --node $NODE \\
  --admin $WALLET_ADDRESS \\
  --gas auto \\
  --gas-adjustment 1.5 \\
  --gas-prices 0.025uxion \\
  -y
EOF
echo ""

# Step 5: Update splitter with NFT contract (for direct USDC minting)
echo "Step 5: Update pyramid-splitter with NFT contract (replace addresses):"
echo ""
cat << EOF
UPDATE_MSG='{"update_config":{"nft_contract":"NFT_ADDRESS"}}'

xiond tx wasm execute SPLITTER_ADDRESS "\$UPDATE_MSG" \\
  --from $WALLET_ADDRESS \\
  --chain-id $CHAIN_ID \\
  --node $NODE \\
  --gas auto \\
  --gas-adjustment 1.5 \\
  --gas-prices 0.025uxion \\
  -y
EOF
echo ""

# Step 6: Set crossmint_nft_contract (the NFT contract Crossmint uses)
echo "Step 6: Set Crossmint NFT contract for Claim verification (replace addresses):"
echo ""
cat << EOF
# Get the Crossmint NFT contract address from your Crossmint dashboard
UPDATE_MSG='{"update_config":{"crossmint_nft_contract":"CROSSMINT_NFT_ADDRESS"}}'

xiond tx wasm execute SPLITTER_ADDRESS "\$UPDATE_MSG" \\
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
echo "After deployment, update frontend/.env.local:"
echo "NEXT_PUBLIC_PYRAMID_CONTRACT=<SPLITTER_ADDRESS>"
echo "NEXT_PUBLIC_NFT_CONTRACT=<NFT_ADDRESS>"
echo "==================================="
echo ""
echo "Notes:"
echo "- nft_contract: Used for minting NFTs to direct USDC payers"
echo "- crossmint_nft_contract: Used to verify NFT ownership in Claim"
echo "- Both can be the same contract, or different ones"
echo "==================================="
