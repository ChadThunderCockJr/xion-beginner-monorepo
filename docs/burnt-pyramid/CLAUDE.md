# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Burnt Pyramid Chat is a blockchain-based pyramid scheme chat application on XION, inspired by MSCHF's pyramid.chat. Users pay $8 to enter and earn $5 for each referral.

## Commands

### Frontend (from `frontend/` directory)
```bash
npm run dev      # Start development server at localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
```

### Smart Contracts (from `contracts/pyramid-splitter/`)
```bash
cargo build      # Build contract (CosmWasm, not yet implemented)
cargo test       # Run contract tests
```

## Architecture

### Frontend (`frontend/`)
Next.js 16 app using the App Router with TypeScript and Tailwind CSS.

**Key integrations:**
- **Abstraxion** (`@burnt-labs/abstraxion`): XION Meta Account authentication (email, social, passkeys - no wallet needed)
- **Crossmint** (`@crossmint/client-sdk-react-ui`): Credit card payment processing
- **Vercel KV** (`@vercel/kv`): Redis-based persistence for member/earnings data

**Page structure:**
- `/` - Landing page
- `/join` - Payment flow (Crossmint credit card or direct USDC)
- `/chat` - Chat room (members only)
- `/dashboard` - Earnings and referral management

**API routes:**
- `POST /api/members` - Add member after payment
- `GET /api/members?address=` - Check membership status
- `GET /api/referrals?address=` - Get referral stats
- `POST /api/webhook/crossmint` - Crossmint payment webhook

**Core utilities (`src/lib/`):**
- `xion.ts` - Chain config, USDC handling, address formatting
- `crossmint.ts` - Payment configuration
- `db.ts` - Vercel KV operations for members/earnings

### Smart Contracts (`contracts/`)
CosmWasm contracts for XION (placeholder, not yet implemented). The `pyramid-splitter` contract will handle membership tracking, referral tree, and USDC payouts.

## Environment Variables

Required in `frontend/.env.local`:
- `NEXT_PUBLIC_TREASURY_CONTRACT` - XION treasury for gasless transactions
- `NEXT_PUBLIC_PYRAMID_CONTRACT` - PyramidChat contract address
- `NEXT_PUBLIC_USDC_TOKEN` - USDC token address on XION
- `NEXT_PUBLIC_CROSSMINT_PROJECT_ID` - Crossmint project ID
- `NEXT_PUBLIC_CROSSMINT_COLLECTION_ID` - Crossmint collection ID
- Vercel KV credentials are auto-added when connected via Vercel dashboard

## Key Constants

Defined in `src/lib/xion.ts`:
- Entry fee: $8 USDC (8000000 micro-units)
- Referral reward: $5 USDC (5000000 micro-units)
- Platform fee: $3 USDC (3000000 micro-units)
- Chain: `xion-testnet-2`
