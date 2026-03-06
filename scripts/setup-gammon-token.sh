#!/bin/bash
# Creates the Gammon token denom via Token Factory and sets metadata.
#
# Prerequisites:
#   - xiond CLI installed
#   - Key named "admin" in the keyring (or change CREATOR_KEY below)
#
# Usage:
#   ./scripts/setup-gammon-token.sh
#
# Verify:
#   xiond q bank denom-metadata --node $NODE

set -euo pipefail

CHAIN_ID="xion-testnet-2"
NODE="https://rpc.xion-testnet-2.burnt.com:443"
CREATOR_KEY="${GAMMON_CREATOR_KEY:-admin}"  # key name in keyring

CREATOR_ADDR=$(xiond keys show "$CREATOR_KEY" -a)
DENOM="factory/${CREATOR_ADDR}/gammon"

echo "==> Creator address: $CREATOR_ADDR"
echo "==> Denom will be: $DENOM"

# 1. Create denom
echo ""
echo "==> Step 1: Creating denom..."
xiond tx tokenfactory create-denom gammon \
  --from "$CREATOR_KEY" \
  --chain-id "$CHAIN_ID" \
  --node "$NODE" \
  --gas auto --gas-adjustment 1.5 --gas-prices 0.025uxion \
  -y

echo "Waiting for tx to be included..."
sleep 6

# 2. Set metadata (display name, symbol, decimals)
echo ""
echo "==> Step 2: Setting denom metadata..."
xiond tx tokenfactory set-denom-metadata \
  "$DENOM" \
  "Gammon" "GAMMON" "Gammon betting token for backgammon" 6 \
  --from "$CREATOR_KEY" \
  --chain-id "$CHAIN_ID" \
  --node "$NODE" \
  --gas auto --gas-adjustment 1.5 --gas-prices 0.025uxion \
  -y

echo "Waiting for tx to be included..."
sleep 6

# 3. Mint initial supply (1,000,000 GAMMON = 1_000_000_000_000 ugammon at 6 decimals)
echo ""
echo "==> Step 3: Minting initial supply (1,000,000 GAMMON)..."
xiond tx tokenfactory mint "1000000000000${DENOM}" \
  --from "$CREATOR_KEY" \
  --chain-id "$CHAIN_ID" \
  --node "$NODE" \
  --gas auto --gas-adjustment 1.5 --gas-prices 0.025uxion \
  -y

echo ""
echo "==> Done! Verify with:"
echo "  xiond q bank denom-metadata --node $NODE"
echo "  xiond q bank balances $CREATOR_ADDR --node $NODE"
echo ""
echo "Denom: $DENOM"
