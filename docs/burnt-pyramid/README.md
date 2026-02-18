# Burnt Pyramid

A referral-based chat community where members pay $8 to join and earn $5 for each person they invite.

## How It Works

1. **Pay $8** to become a member
2. **Get a unique referral link** to share with friends
3. **Earn $5** every time someone joins through your link
4. **Access the Backroom** - a members-only chat space

## Architecture

### Application Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         LANDING PAGE                            │
│                              (/)                                │
│   • View community stats (members, total paid out)              │
│   • Learn how the pyramid works                                 │
│   • "Enter" button → redirects to /join                         │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                          JOIN PAGE                              │
│                            (/join)                              │
│                                                                 │
│   ┌─────────────────┐    ┌─────────────────┐                   │
│   │  CREDIT CARD    │    │  ACCOUNT        │                   │
│   │  (Crossmint)    │    │  BALANCE        │                   │
│   │                 │    │                 │                   │
│   │  Pay $8 via     │    │  Pay $8 from    │                   │
│   │  embedded       │    │  existing       │                   │
│   │  checkout       │    │  balance        │                   │
│   └────────┬────────┘    └────────┬────────┘                   │
│            │                      │                             │
│            └──────────┬───────────┘                             │
│                       ▼                                         │
│              Membership Activated                               │
│              Referral Link Generated                            │
└─────────────────────────────────────────────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
┌─────────────────────────┐     ┌─────────────────────────────────┐
│       DASHBOARD         │     │           BACKROOM              │
│       (/dashboard)      │     │           (/chat)               │
│                         │     │                                 │
│ • Total earnings        │     │ • Members-only chat             │
│ • Referral count        │     │ • Community discussion          │
│ • Referral link to      │     │ • Real-time messages            │
│   copy/share            │     │                                 │
│ • Recent recruit list   │     │                                 │
└─────────────────────────┘     └─────────────────────────────────┘
```

### Referral Flow

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   MEMBER A   │ shares  │   VISITOR    │  joins  │   MEMBER B   │
│              │ ──────► │              │ ──────► │              │
│ Referral link│         │ Clicks link  │         │ Pays $8      │
└──────────────┘         │ with ?ref=A  │         │              │
                         └──────────────┘         └──────────────┘
                                                         │
                                                         ▼
                                                  ┌──────────────┐
                                                  │   PAYOUT     │
                                                  │              │
                                                  │ • $5 → A     │
                                                  │ • $3 → Platform│
                                                  └──────────────┘
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 16, TypeScript, Tailwind | App router, UI components |
| Auth | Abstraxion | Email/social login (no passwords) |
| Payments | Crossmint | Credit card processing |
| Database | Vercel KV (Redis) | Member & earnings data |
| Backend | Next.js API Routes | Membership & referral APIs |

### API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/members` | POST | Register new member after payment |
| `/api/members?address=` | GET | Check if user is a member |
| `/api/referrals?address=` | GET | Get earnings and referral stats |
| `/api/stats` | GET | Global community statistics |
| `/api/webhook/crossmint` | POST | Handle payment confirmations |

### Data Model

**Member**
```
{
  accountId: string
  referrerId: string | null
  joinedAt: timestamp
  paymentMethod: "card" | "balance"
}
```

**Earning**
```
{
  memberId: string      // Who earned it
  referredId: string    // Who they referred
  amount: "$5.00"
  status: "paid"
  createdAt: timestamp
}
```

### Page Access

| Page | Non-Member | Member |
|------|------------|--------|
| `/` (Landing) | Full access | Full access |
| `/join` | Payment flow | Redirected to dashboard |
| `/dashboard` | Locked | View earnings & referral link |
| `/chat` | Locked | Full chat access |

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Landing page
│   │   ├── join/page.tsx     # Payment flow
│   │   ├── chat/page.tsx     # Backroom (members only)
│   │   ├── dashboard/page.tsx # Earnings dashboard
│   │   └── api/              # Backend routes
│   │       ├── members/
│   │       ├── referrals/
│   │       ├── stats/
│   │       └── webhook/
│   ├── components/           # Reusable UI components
│   └── lib/
│       ├── db.ts             # Database operations
│       └── crossmint.ts      # Payment config
├── public/                   # Static assets
└── package.json
```

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create `frontend/.env.local`:

```
NEXT_PUBLIC_TREASURY_CONTRACT=...
NEXT_PUBLIC_PYRAMID_CONTRACT=...
NEXT_PUBLIC_CROSSMINT_PROJECT_ID=...
NEXT_PUBLIC_CROSSMINT_COLLECTION_ID=...
```

Vercel KV credentials are auto-configured when connected via the Vercel dashboard.

## Key Constants

- **Entry fee**: $8
- **Referral reward**: $5
- **Platform fee**: $3
