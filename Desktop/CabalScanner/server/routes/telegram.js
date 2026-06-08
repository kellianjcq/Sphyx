const express = require('express');
const { sendTestAlert, getStatus } = require('../services/telegram');
const { listRecentAlerts } = require('../services/alerts');

const router = express.Router();

router.get('/status', (_req, res) => {
  res.json(getStatus());
});

router.get('/alerts', (_req, res) => {
  const alerts = listRecentAlerts(50).map((a) => ({
    id: a.id,
    mint: a.mint,
    symbol: a.symbol,
    tier: a.tier,
    riskScore: a.risk_score,
    rvsScore: a.rvs_score,
    firedAt: a.fired_at,
    outcome: a.outcome,
    telegramSentAt: a.telegram_sent_at,
    deliveryTier: a.delivery_tier,
    memoTxHash: a.memo_tx_hash,
  }));
  res.json({ alerts });
});

router.post('/test', async (_req, res) => {
  try {
    const result = await sendTestAlert();
    res.json({ ok: true, messageId: result.message_id });
  } catch (err) {
    res.status(err.message.includes('not configured') ? 503 : 500).json({ error: err.message });
  }
});

module.exports = router;
