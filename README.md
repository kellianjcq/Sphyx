# CabalScan — On-Chain Rug Scanner

> Detect hidden wallet concentration and serial rug-pull fingerprints in Solana tokens before you ape in.

## Live at
`https://cabalscan.vercel.app` (after deployment)

---

## Stack
- **Framework**: Next.js 14 (Pages Router)
- **Styling**: Pure CSS with CSS variables — no Tailwind, no UI libs
- **Fonts**: IBM Plex Mono + Syne (Google Fonts)
- **Hosting**: Vercel

---

## Deploy to Vercel in 3 steps

### Option A — Vercel CLI (fastest)
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Inside this folder
cd cabalscan
npm install

# 3. Deploy
vercel

# Follow the prompts:
# - Link to existing project? No
# - Project name: cabalscan
# - Directory: ./
# - Override settings? No
```

Your site is live in ~60 seconds.

### Option B — GitHub + Vercel Dashboard
1. Push this folder to a new GitHub repo
2. Go to vercel.com → Add New Project
3. Import your repo
4. Framework: **Next.js** (auto-detected)
5. Click **Deploy**

---

## Local development
```bash
npm install
npm run dev
# → http://localhost:3000
```

---

## Connect real data (next steps)

### 1. Helius webhook setup
```bash
# In your .env.local
HELIUS_API_KEY=your_key_here
```

Create a webhook at dashboard.helius.dev:
- Type: `ACCOUNT_ACTIVITY`
- Account addresses: leave blank (catch-all)
- Webhook URL: `https://your-domain.vercel.app/api/webhook`

### 2. Add API route for Helius
Create `src/pages/api/webhook.js`:
```js
export default async function handler(req, res) {
  const { accountData } = req.body;
  // Process holder changes → run cabal detection → emit alert
  res.status(200).json({ ok: true });
}
```

### 3. Add scan API route
Create `src/pages/api/scan.js`:
```js
export default async function handler(req, res) {
  const { address } = req.query;
  const holders = await fetch(
    `https://api.helius.xyz/v0/addresses/${address}/balances?api-key=${process.env.HELIUS_API_KEY}`
  );
  // Run cabal detection logic
  res.status(200).json({ verdict, concentration, linkedWallets });
}
```

---

## File structure
```
cabalscan/
├── public/
│   └── favicon.svg
├── src/
│   ├── pages/
│   │   ├── _app.js        ← App wrapper
│   │   ├── _document.js   ← HTML head, meta, fonts
│   │   └── index.js       ← Main landing page
│   └── styles/
│       └── globals.css    ← All styles + animations
├── next.config.js
├── package.json
├── vercel.json
└── README.md
```

---

## Sections
- **Nav** — Fixed with Telegram bot CTA
- **Ticker** — Live-scrolling alert feed
- **Hero** — Title + demo scan card + CTA
- **Stats bar** — Animated counters (scans, rugs, accuracy, saved)
- **How it works** — 6-step grid
- **Live scanner** — Interactive CA input with mock results
- **Pricing** — 4-tier grid (Free / Basic $9 / Pro $49 / API $199)
- **Track record** — Alert history table
- **CTA** — Telegram bot link
- **Footer**

---

## Customize
- Replace all `t.me/CabalScanBot` links with your actual bot username
- Update stats in `SAMPLE_ALERTS` and `useCounter` with real data
- Replace mock `runScan()` with a real `/api/scan` call
- Add Stripe for subscription gating

---

Built with the Shovel Seller Protocol. The blockchain does not lie.
