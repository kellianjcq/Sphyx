const express = require('express');
const { handleHeliusWebhook } = require('../services/ingest');

const router = express.Router();

function verifyHeliusAuth(req) {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (!secret) return true;

  const auth = req.headers.authorization || req.headers['x-helius-signature'] || '';
  return auth === secret || auth === `Bearer ${secret}`;
}

router.post('/helius', async (req, res) => {
  if (!verifyHeliusAuth(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await handleHeliusWebhook(req.body);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/helius/test', async (req, res) => {
  const sample = req.body?.length ? req.body : [buildSampleMintEvent()];
  try {
    const result = await handleHeliusWebhook(sample);
    res.json({ ok: true, test: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function buildSampleMintEvent() {
  const mint = 'SampleMint' + Date.now().toString(36);
  return {
    type: 'TOKEN_MINT',
    signature: 'test_sig_' + Date.now(),
    slot: 280000000,
    feePayer: 'DeployerWallet111111111111111111111111111',
    description: 'Token mint test event',
    tokenTransfers: [
      {
        mint,
        fromUserAccount: null,
        toUserAccount: 'BuyerWallet1111111111111111111111111111',
        tokenAmount: 1000000,
      },
      {
        mint,
        fromUserAccount: 'DeployerWallet111111111111111111111111111',
        toUserAccount: 'CabalWallet11111111111111111111111111111',
        tokenAmount: 340000000,
      },
    ],
    accountData: [
      {
        account: 'BuyerWallet1111111111111111111111111111',
        tokenBalanceChanges: [{ mint, rawTokenAmount: { tokenAmount: '1000000' } }],
      },
      {
        account: 'CabalWallet11111111111111111111111111111',
        tokenBalanceChanges: [{ mint, rawTokenAmount: { tokenAmount: '340000000' } }],
      },
    ],
  };
}

module.exports = router;
