#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { registerWebhook, listWebhooks, getWebhookUrl } = require('../server/services/helius');

async function main() {
  console.log('CabalScan — Helius Webhook Registration\n');

  if (!process.env.HELIUS_API_KEY) {
    console.error('Set HELIUS_API_KEY in .env');
    process.exit(1);
  }
  if (!process.env.PUBLIC_URL && !process.env.RAILWAY_PUBLIC_DOMAIN) {
    console.error('Set PUBLIC_URL in .env (e.g. https://your-cabalscan.railway.app)');
    process.exit(1);
  }

  console.log('Target URL:', getWebhookUrl());

  const existing = await listWebhooks();
  const match = (Array.isArray(existing) ? existing : []).find(
    (w) => w.webhookURL === getWebhookUrl()
  );

  if (match) {
    console.log('Webhook already registered:', match.webhookID);
    return;
  }

  const webhook = await registerWebhook();
  console.log('Registered:', JSON.stringify(webhook, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
