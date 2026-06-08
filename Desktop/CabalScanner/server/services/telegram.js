const { getDb } = require('../db/sqlite');

const FREE_DELAY_MS = 15 * 60 * 1000;
const pendingTimers = new Map();

function isConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

function getChannels() {
  return {
    pro: process.env.TELEGRAM_PRO_CHANNEL_ID || process.env.TELEGRAM_ALERT_CHANNEL_ID,
    free: process.env.TELEGRAM_FREE_CHANNEL_ID || process.env.TELEGRAM_ALERT_CHANNEL_ID,
  };
}

async function api(method, body = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not configured');

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'Telegram API error');
  return data.result;
}

async function sendMessage(chatId, text, options = {}) {
  return api('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...options,
  });
}

function explorerLink(signature) {
  if (!signature || signature.startsWith('pending:')) return null;
  const sig = signature.replace(/^memo:/, '');
  return `https://solscan.io/tx/${sig}`;
}

async function deliverAlert(alertId, { tier = 'pro', message, memoTxHash, mint }) {
  const channels = getChannels();
  const chatId = tier === 'pro' ? channels.pro : channels.free;
  if (!chatId) return { skipped: true, reason: 'no channel configured' };

  const explorer = explorerLink(memoTxHash);
  const footer = explorer
    ? `\n\n<a href="${explorer}">On-chain proof</a> · <a href="https://solscan.io/token/${mint}">Token</a>`
    : `\n\n<a href="https://solscan.io/token/${mint}">Token</a>`;

  const result = await sendMessage(chatId, message + footer);

  const db = getDb();
  db.prepare(
    `UPDATE alerts SET telegram_sent_at = ?, telegram_message_id = ?, delivery_tier = ? WHERE id = ?`
  ).run(Date.now(), String(result.message_id), tier, alertId);

  return { messageId: result.message_id, chatId, tier };
}

async function scheduleFreeTierAlert(alertId, payload) {
  if (pendingTimers.has(alertId)) return;

  const timer = setTimeout(async () => {
    pendingTimers.delete(alertId);
    try {
      await deliverAlert(alertId, { ...payload, tier: 'free' });
    } catch (err) {
      console.error(`Free-tier alert ${alertId} failed:`, err.message);
    }
  }, FREE_DELAY_MS);

  pendingTimers.set(alertId, timer);
}

async function dispatchAlert(alertId, payload) {
  if (!isConfigured()) return { skipped: true, reason: 'telegram not configured' };

  const channels = getChannels();
  const results = [];

  if (channels.pro) {
    try {
      results.push(await deliverAlert(alertId, { ...payload, tier: 'pro' }));
    } catch (err) {
      console.error('Pro alert failed:', err.message);
    }
  }

  if (channels.free && channels.free !== channels.pro) {
    await scheduleFreeTierAlert(alertId, payload);
    results.push({ tier: 'free', scheduled: true, delayMs: FREE_DELAY_MS });
  } else if (channels.free && !channels.pro) {
    await scheduleFreeTierAlert(alertId, payload);
    results.push({ tier: 'free', scheduled: true, delayMs: FREE_DELAY_MS });
  }

  return results;
}

async function sendTestAlert() {
  const channels = getChannels();
  const chatId = channels.pro || channels.free;
  if (!chatId) throw new Error('No Telegram channel configured');

  const message = [
    '<b>CabalScan — Test Alert</b>',
    'Risk: 0/100 | RVS: 0/100',
    '',
    'Telegram delivery is operational.',
    `Pro channel: ${channels.pro || '—'}`,
    `Free channel: ${channels.free || '—'} (15m delay)`,
  ].join('\n');

  return sendMessage(chatId, message);
}

function getStatus() {
  const channels = getChannels();
  return {
    configured: isConfigured(),
    proChannel: Boolean(channels.pro),
    freeChannel: Boolean(channels.free),
    freeDelayMinutes: FREE_DELAY_MS / 60000,
    pendingDelayed: pendingTimers.size,
  };
}

module.exports = {
  dispatchAlert,
  sendTestAlert,
  sendMessage,
  getStatus,
  isConfigured,
};
