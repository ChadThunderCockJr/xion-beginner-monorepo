#!/bin/bash
# Instantiates a CW721 contract for Gammon Token Packs.
#
# Uses the existing CW721 base contract (Code ID 1878 on testnet).
# No custom contract needed — standard CW721 with minter set to admin.
#
# Prerequisites:
#   - xiond CLI installed
#   - Key named "admin" in the keyring (or change CREATOR_KEY below)
#
# Usage:
#   ./scripts/setup-gammon-nft.sh
#
# NFT Metadata Convention:
#   Token ID format: pack-{amount}-{uuid} (e.g., pack-100-abc123)
#   Pack tiers: 100, 500, 1000 GAMMON

set -euo pipefail

CHAIN_ID="xion-testnet-2"
NODE="https://rpc.xion-testnet-2.burnt.com:443"
CREATOR_KEY="${GAMMON_CREATOR_KEY:-admin}"
CW721_CODE_ID="${CW721_CODE_ID:-1878}"

CREATOR_ADDR=$(xiond keys show "$CREATOR_KEY" -a)

echo "==> Creator/Minter address: $CREATOR_ADDR"
echo "==> CW721 Code ID: $CW721_CODE_ID"

# Instantiate CW721 for Gammon Token Packs
echo ""
echo "==> Instantiating CW721 contract..."
xiond tx wasm instantiate "$CW721_CODE_ID" \
  '{"name":"Gammon Token Packs","symbol":"GPACK","minter":"'"$CREATOR_ADDR"'"}' \
  --label "gammon-token-packs" \
  --admin "$CREATOR_ADDR" \
  --from "$CREATOR_KEY" \
  --chain-id "$CHAIN_ID" \
  --node "$NODE" \
  --gas auto --gas-adjustment 1.5 --gas-prices 0.025uxion \
  -y

echo ""
echo "Waiting for tx to be included..."
sleep 6

echo ""
echo "==> Done! Find the contract address with:"
echo "  xiond q wasm list-contract-by-code $CW721_CODE_ID --node $NODE"
echo ""
echo "Then set NEXT_PUBLIC_CROSSMINT_NFT_CONTRACT in your .env files."
