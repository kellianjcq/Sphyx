const express = require('express');
const {
  listWebhooks,
  registerWebhook,
  deleteWebhook,
  getStatus,
  getWebhookUrl,
} = require('../services/helius');

const router = express.Router();

router.get('/status', (_req, res) => {
  res.json(getStatus());
});

router.get('/webhooks', async (_req, res) => {
  try {
    const webhooks = await listWebhooks();
    res.json({ webhooks, targetUrl: getWebhookUrl() });
  } catch (err) {
    res.status(err.message.includes('not configured') ? 503 : 500).json({ error: err.message });
  }
});

router.post('/register', async (_req, res) => {
  try {
    const webhook = await registerWebhook();
    res.json({ ok: true, webhook, targetUrl: getWebhookUrl() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/webhooks/:id', async (req, res) => {
  try {
    await deleteWebhook(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
