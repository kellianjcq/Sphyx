# CabalScan

Solana blockchain surveillance platform — detects cabal wallet coordination and serial rug-pull operator fingerprints.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

- **Build Terminal**: http://localhost:5173
- **API**: http://localhost:3847

## Setup

### 1 · Helius Webhooks

```bash
# .env
HELIUS_API_KEY=your_key
HELIUS_WEBHOOK_SECRET=your_shared_secret
PUBLIC_URL=https://your-deployed-url.com

npm run helius:register
```

Helius POSTs enhanced transactions to `POST /webhook/helius`. Test locally:

```bash
curl -X POST http://localhost:3847/webhook/helius/test
```

Admin API:
- `GET /api/helius/status`
- `GET /api/helius/webhooks`
- `POST /api/helius/register`

### 2 · Telegram Alerts

```bash
# .env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_PRO_CHANNEL_ID=-100xxxxxxxxxx    # real-time
TELEGRAM_FREE_CHANNEL_ID=-100xxxxxxxxxx     # 15-minute delay
```

Or use `TELEGRAM_ALERT_CHANNEL_ID` for a single channel (free-tier delay applies).

Test delivery:

```bash
curl -X POST http://localhost:3847/api/telegram/test
```

### 3 · Track Record Dashboard

Open **track-record** tab in the Build Terminal, or:

```bash
curl http://localhost:3847/api/track-record
```

Metrics (90-day window):
- Total alerts fired
- Confirmed rug rate
- False positive rate (30d survival)
- Average alert → rug time

Mark outcomes manually:

```bash
curl -X POST http://localhost:3847/api/track-record/outcome \
  -H "Content-Type: application/json" \
  -d '{"alertId": 1, "outcome": "rugged"}'
```

Liquidity removal webhooks auto-resolve pending alerts as `rugged`. Alerts older than 30 days auto-resolve as `survived`.

## Architecture

| Layer | Tech | Purpose |
|-------|------|---------|
| Ingest | Helius enhanced webhooks | Token mint / swap / LP events |
| Ephemeral state | SQLite | Per-token data + webhook log |
| Graph analysis | Python + NetworkX | Wallet clustering |
| Alert queue | Redis | Real-time delivery |
| Alerts | Telegram (pro + free tiers) | User notifications |
| Trust | Solana memo program | Proof-of-prediction |

## Terminal Panels

| Panel | Route | Purpose |
|-------|-------|---------|
| prompt-forge | `#/prompt-forge` | Intelligence system prompt |
| track-record | `#/dashboard` | Public accuracy dashboard |
| alerts | `#/alerts` | Pipeline status + alert feed |

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhook/helius` | POST | Helius enhanced transaction webhook |
| `/webhook/helius/test` | POST | Inject sample mint event |
| `/api/track-record` | GET | Dashboard metrics |
| `/api/telegram/test` | POST | Send test Telegram alert |
| `/api/verify/:mint` | GET | Raw graph data for a token |
