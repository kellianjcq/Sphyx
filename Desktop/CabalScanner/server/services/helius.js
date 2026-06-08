const HELIUS_BASE = 'https://api.helius.xyz/v0';

function getApiKey() {
  const key = process.env.HELIUS_API_KEY;
  if (!key) throw new Error('HELIUS_API_KEY not configured');
  return key;
}

function getPublicBase() {
  return process.env.PUBLIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN || null;
}

function getWebhookUrl() {
  const base = getPublicBase();
  if (!base) throw new Error('PUBLIC_URL not configured — set to your deployed webhook base URL');
  const normalized = base.startsWith('http') ? base : `https://${base}`;
  return `${normalized.replace(/\/$/, '')}/webhook/helius`;
}

async function heliusFetch(path, options = {}) {
  const apiKey = getApiKey();
  const url = `${HELIUS_BASE}${path}${path.includes('?') ? '&' : '?'}api-key=${apiKey}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Helius API error:', res.status, JSON.stringify(body));
    throw new Error(body.error || body.message || `Helius API error ${res.status}`);
  }
  return body;
}

async function listWebhooks() {
  return heliusFetch('/webhooks');
}

async function registerWebhook() {
  const webhookURL = getWebhookUrl();
  const authHeader = process.env.HELIUS_WEBHOOK_SECRET || undefined;

  const payload = {
    webhookURL,
    transactionTypes: ['Any'],
    accountAddresses: [
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    ],
    webhookType: 'enhanced',
    ...(authHeader ? { authHeader } : {}),
  };

  return heliusFetch('/webhooks', { method: 'POST', body: JSON.stringify(payload) });
}

async function deleteWebhook(webhookId) {
  return heliusFetch(`/webhooks/${webhookId}`, { method: 'DELETE' });
}

async function getEnhancedTransaction(signature) {
  return heliusFetch(`/transactions/?transactions=${signature}`);
}

async function getTokenHolders(mint) {
  const apiKey = getApiKey();
  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'cabalscan-holders',
      method: 'getTokenAccounts',
      params: { mint, limit: 1000 },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result?.token_accounts || [];
}

function getStatus() {
  const base = getPublicBase();
  return {
    configured: Boolean(process.env.HELIUS_API_KEY),
    webhookUrl: base ? getWebhookUrl() : null,
    publicBase: base,
    hasSecret: Boolean(process.env.HELIUS_WEBHOOK_SECRET),
  };
}

module.exports = {
  listWebhooks,
  registerWebhook,
  deleteWebhook,
  getEnhancedTransaction,
  getTokenHolders,
  getWebhookUrl,
  getStatus,
};
