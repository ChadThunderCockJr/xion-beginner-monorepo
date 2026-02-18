# 🔺 Burnt Pyramid - Product Requirements Document

> "Me fail English? That's unpossible! But building a pyramid scheme chat app? That's totally possimpible!" - Ralph Wiggum

## Project Overview

**Burnt Pyramid** is a referral-based chat community on XION blockchain where members pay $8 to join and earn $5 for each person they invite. Think pyramid.chat by MSCHF, but with real payouts.

### Core Value Proposition
- 💰 **Pay once**: $8 via credit card (Crossmint)
- 💸 **Earn forever**: $5 per referral
- 🔒 **Exclusive access**: Members-only chat (the "Backroom")

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 16, TypeScript, Tailwind | App router, UI components |
| Auth | Abstraxion | Email/social login (no wallet needed) |
| Payments | Crossmint | Credit card processing (already configured) |
| Database | Vercel KV (Redis) | Member, earnings, and chat data |
| Backend | Next.js API Routes | Membership, referrals, chat APIs |
| Hosting | Vercel | Already deployed |

> **Note on Smart Contract**: The repo contains a CosmWasm contract (`contracts/pyramid-splitter/`), but **it's optional**. The current flow works entirely with Crossmint + Vercel KV. The contract would enable on-chain referral payouts, but for now we track referrals in the database and can process payouts manually or via future integration.

---

## Current State (What's Already Working)

✅ **Landing page** - Stats display, auth flow, premium UI  
✅ **Join page** - Crossmint credit card checkout (tested!)  
✅ **Dashboard** - Referral link, earnings display  
✅ **Chat UI** - Layout, message bubbles, member list (but mock data)  
✅ **Webhook** - Crossmint webhook adds members to Vercel KV  
✅ **API routes** - Members, referrals, stats  
✅ **Vercel deployment** - Already live  
✅ **Crossmint collection** - Already configured  

---

## What Needs to Be Built

| Feature | Priority | Why |
|---------|----------|-----|
| Real chat backend | 🔴 High | Chat shows mock data - useless without real messages |
| Mobile chat responsiveness | 🔴 High | Sidebar hidden on mobile with no alternative |
| Full mobile optimization | 🟡 Medium | Test all pages on mobile viewports |
| Referral payout tracking | 🟡 Medium | Track who owes $5 to whom |
| Share sheet | 🟢 Low | Better referral link sharing |
| Withdrawal UI | 🟢 Low | Manual for now, can add UI later |

---

## Task List (Ralph Loop Format)

```json
[
  {
    "category": "feature",
    "description": "Create real-time chat storage with Vercel KV",
    "steps": [
      "Create src/lib/chat.ts with ChatMessage interface (id, authorAddress, authorName, content, timestamp)",
      "Implement addMessage(authorAddress, content) that encrypts and stores to KV",
      "Implement getMessages(limit=50, before?) for pagination",
      "Use AES-256 encryption with CHAT_ENCRYPTION_KEY env var",
      "Create API route POST /api/chat for sending messages",
      "Create API route GET /api/chat for fetching messages",
      "Verify: POST a message, GET it back, content matches"
    ],
    "passes": true
  },
  {
    "category": "feature",
    "description": "Connect chat page to real backend",
    "steps": [
      "Remove MOCK_MESSAGES constant from chat/page.tsx",
      "Add useEffect to fetch messages from GET /api/chat on mount",
      "Add polling every 3 seconds to refresh messages",
      "Update handleSend to POST to /api/chat",
      "Show loading skeleton while fetching initial messages",
      "Display error toast if fetch fails",
      "Verify: Send a message, refresh page, message persists"
    ],
    "passes": true
  },
  {
    "category": "mobile",
    "description": "Make chat sidebar accessible on mobile",
    "steps": [
      "Add hamburger menu button to chat navbar (visible at < 1024px)",
      "Create slide-out drawer component for member list",
      "Add backdrop overlay when drawer is open",
      "Ensure drawer closes on member click or backdrop tap",
      "Test on 375px viewport - all elements visible and tappable",
      "Verify: On mobile, tap hamburger, see members list"
    ],
    "passes": true
  },
  {
    "category": "mobile",
    "description": "Optimize all pages for mobile",
    "steps": [
      "Test landing page at 375px - fix any horizontal overflow",
      "Test join page - Crossmint checkout should fit without horizontal scroll",
      "Test dashboard - referral link input should wrap properly",
      "Ensure all tap targets are minimum 44x44px",
      "Test on actual iOS Safari and Chrome Android if possible",
      "Verify: Complete full flow on mobile without pinch-zoom needed"
    ],
    "passes": true
  },
  {
    "category": "feature",
    "description": "Add online presence tracking",
    "steps": [
      "Create API route POST /api/presence that stores {address: timestamp} in KV",
      "Create API route GET /api/presence that returns addresses seen in last 60s",
      "Add useEffect in chat page to POST heartbeat every 30 seconds",
      "Fetch online members and show green status indicator",
      "Remove hardcoded member list from sidebar",
      "Verify: Open chat in two browsers, both show as online"
    ],
    "passes": true
  },
  {
    "category": "feature",
    "description": "Improve referral sharing experience",
    "steps": [
      "Add Web Share API call when available (navigator.share)",
      "Fall back to clipboard copy with toast on unsupported browsers",
      "Add share buttons: X (Twitter), Telegram, WhatsApp",
      "Pre-populate share text with catchy message",
      "Verify: On mobile, native share sheet opens"
    ],
    "passes": true
  },
  {
    "category": "feature",
    "description": "Track referral payouts in database",
    "steps": [
      "Update Earning type to include status: pending | approved | paid",
      "When referral joins, create earning with status: pending",
      "Create admin-only API route GET /api/admin/payouts to list pending payouts",
      "Create API route POST /api/admin/payouts/:id/mark-paid",
      "Verify: Referral joins, earning appears in pending list"
    ],
    "passes": true
  },
  {
    "category": "styling",
    "description": "Polish UI with loading states and animations",
    "steps": [
      "Add skeleton loaders for stats on landing page",
      "Add skeleton loader for messages in chat",
      "Animate copy button: show checkmark for 2 seconds after copy",
      "Add subtle fade-in animation for new messages",
      "Verify: Page loads, skeletons appear, then real content"
    ],
    "passes": true
  },
  {
    "category": "security",
    "description": "Add rate limiting to prevent spam",
    "steps": [
      "Create rateLimit helper using Vercel KV sliding window",
      "Limit POST /api/chat to 10 messages per minute per address",
      "Limit POST /api/members to 5 attempts per minute per address",
      "Return 429 Too Many Requests with retry-after header",
      "Verify: Send 11 messages quickly, 11th gets 429 error"
    ],
    "passes": true
  },
  {
    "category": "testing",
    "description": "Test the complete join flow",
    "steps": [
      "Open app in incognito browser",
      "Click Connect, complete Abstraxion auth",
      "Click Enter, select Credit Card payment",
      "Complete Crossmint checkout with test card",
      "Verify membership shows in dashboard",
      "Verify access to chat is granted",
      "Verify: All steps complete without errors"
    ],
    "passes": true
  },
  {
    "category": "testing",
    "description": "Test referral tracking",
    "steps": [
      "Get referral link from member A's dashboard",
      "Open link in new incognito browser (new user B)",
      "Complete join flow as user B",
      "Check member A's dashboard - should show 1 referral",
      "Check earnings show $5.00 pending",
      "Verify: Referral tracked correctly end-to-end"
    ],
    "passes": true
  }
]
```

---

## Success Criteria

| Test | How to Verify | Status |
|------|---------------|--------|
| User can pay $8 with credit card | Complete Crossmint checkout → dashboard shows membership | ⬜ |
| Chat messages persist | Send message → refresh → message still visible | ⬜ |
| Chat works on mobile | Complete flow on 375px viewport, no horizontal scroll | ⬜ |
| Referral link works | Share link → friend joins → you see referral in dashboard | ⬜ |
| Online presence shows | Two browsers logged in → both show as online in sidebar | ⬜ |

---

## Existing Vercel Deployment

> ⚠️ **Note**: App is already deployed on Vercel. Project may be named "frontend". Do NOT create a new project - connect to existing one via Vercel dashboard.

---

## Environment Variables Needed

Already configured in Vercel:
- `KV_REST_API_URL` + `KV_REST_API_TOKEN` (Vercel KV)
- `NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY`
- `NEXT_PUBLIC_CROSSMINT_COLLECTION_ID`
- `NEXT_PUBLIC_TREASURY_CONTRACT`

To add:
- `CHAT_ENCRYPTION_KEY` - 32-character random string for message encryption

---

*"When I grow up, I want to be a principal, or a caterpillar. Until then, I'll keep my tasks atomic and my success criteria measurable."* 🍎
