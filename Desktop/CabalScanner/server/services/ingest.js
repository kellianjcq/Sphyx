const { getDb } = require('../db/sqlite');
const { runDetectionPipeline } = require('./analysis');
const { queueAlert } = require('./alerts');
const { recordOutcome } = require('./track-record');
const { isConfigured: isSupabaseConfigured, recordRuggedDeployer } = require('../lib/supabase');

const SNAPSHOT_WINDOW_BLOCKS = 50;

async function handleHeliusWebhook(payload) {
  const events = normalizePayload(payload);
  const processed = [];

  for (const event of events) {
    const result = await processEvent(event);
    if (result) processed.push(result);
  }

  return { processed: processed.length, tokens: processed };
}

function normalizePayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload?.events) return payload.events;
  if (payload?.transactions) return payload.transactions;
  return [payload];
}

async function processEvent(event) {
  const db = getDb();
  const now = Date.now();
  const signature = event.signature || event.transactionSignature || null;
  const slot = event.slot || null;
  const eventType = detectEventType(event);

  db.prepare(
    `INSERT INTO webhook_events (signature, event_type, mint, slot, payload_json, received_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(signature, eventType, extractMint(event), slot, JSON.stringify(event).slice(0, 50000), now);

  if (eventType === 'liquidity_removal') {
    return await handleLiquidityRemoval(event);
  }

  const mint = extractMint(event);
  if (!mint) return null;

  const deployer = extractDeployer(event);
  const symbol = extractSymbol(event);

  const existing = db.prepare('SELECT mint, slot, created_at FROM tokens WHERE mint = ?').get(mint);

  db.prepare(
    `INSERT INTO tokens (mint, deployer, symbol, slot, created_at, updated_at, first_snapshot_block)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(mint) DO UPDATE SET
       deployer = COALESCE(excluded.deployer, tokens.deployer),
       symbol = COALESCE(excluded.symbol, tokens.symbol),
       slot = COALESCE(excluded.slot, tokens.slot),
       updated_at = excluded.updated_at`
  ).run(mint, deployer, symbol, slot, existing?.created_at || now, now, slot);

  const inSnapshotWindow =
    !existing?.slot || !slot || slot - (existing.slot || slot) <= SNAPSHOT_WINDOW_BLOCKS;

  const analysis = await runDetectionPipeline(mint, event, { inSnapshotWindow });
  const full = { mint, symbol, slot, eventType, ...analysis };

  if (full.shouldAlert) {
    const alert = await queueAlert(full);
    full.alertId = alert.id;
  }

  return full;
}

async function handleLiquidityRemoval(event) {
  const mint = extractMint(event);
  if (!mint) return { eventType: 'liquidity_removal', mint: null };

  const db = getDb();
  const now = Date.now();

  db.prepare(`UPDATE tokens SET rugged_at = ?, updated_at = ? WHERE mint = ?`).run(now, now, mint);

  const token = db.prepare('SELECT deployer FROM tokens WHERE mint = ?').get(mint);
  if (token?.deployer && isSupabaseConfigured()) {
    try {
      await recordRuggedDeployer(token.deployer);
    } catch (err) {
      console.error('CDOF record failed:', err.message);
    }
  }

  const pendingAlerts = db
    .prepare(`SELECT id FROM alerts WHERE mint = ? AND outcome = 'pending' ORDER BY fired_at DESC`)
    .all(mint);

  for (const alert of pendingAlerts) {
    recordOutcome(alert.id, 'rugged');
  }

  return { eventType: 'liquidity_removal', mint, ruggedAt: now, alertsResolved: pendingAlerts.length };
}

function detectEventType(event) {
  const desc = (event.description || event.type || '').toLowerCase();
  const transfers = event.tokenTransfers || [];

  if (desc.includes('liquidity') && (desc.includes('remov') || desc.includes('withdraw'))) {
    return 'liquidity_removal';
  }
  if (desc.includes('mint') || event.type === 'TOKEN_MINT') return 'token_mint';
  if (desc.includes('swap') || event.type === 'SWAP') return 'swap';

  const hasMintCreation = transfers.some((t) => t.mint && !t.fromUserAccount);
  if (hasMintCreation) return 'token_mint';

  return event.type || 'unknown';
}

function extractMint(event) {
  const transfers = event.tokenTransfers || [];
  for (const t of transfers) {
    if (t.mint) return t.mint;
  }

  for (const account of event.accountData || []) {
    for (const change of account.tokenBalanceChanges || []) {
      if (change.mint) return change.mint;
    }
  }

  if (event.mint) return event.mint;

  const match = event.description?.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  return match?.[0] || null;
}

function extractDeployer(event) {
  return event.feePayer || event.feePayerAccount || event.accountData?.[0]?.account || null;
}

function extractSymbol(event) {
  return (
    event.tokenTransfers?.[0]?.tokenStandard?.symbol ||
    event.events?.[0]?.token?.symbol ||
    event.description?.match(/\$([A-Z0-9]{2,10})/)?.[1] ||
    null
  );
}

module.exports = { handleHeliusWebhook, extractMint, detectEventType };
