const { getDb } = require('../db/sqlite');
const { formatAlert, formatEvidenceCard } = require('./alert-formatter');
const { recordProofOfPrediction } = require('./proof-of-prediction');
const { dispatchAlert } = require('./telegram');
const { getRedis } = require('../lib/redis');

async function queueAlert(analysis) {
  const message = formatAlert(analysis);
  const evidenceCard = formatEvidenceCard(analysis);
  const db = getDb();

  const memoTxHash = await recordProofOfPrediction(analysis);

  const result = db
    .prepare(
      `INSERT INTO alerts (mint, tier, message, memo_tx_hash, fired_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(analysis.mint || 'unknown', analysis.confidenceTier, message, memoTxHash, Date.now());

  const alertId = result.lastInsertRowid;
  const payload = {
    message,
    evidenceCard,
    memoTxHash,
    mint: analysis.mint,
    tier: analysis.confidenceTier,
  };

  const redis = await getRedis();
  if (redis) {
    try {
      await redis.lpush(
        'cabalscan:alerts',
        JSON.stringify({ id: alertId, ...payload, firedAt: Date.now() })
      );
    } catch {
      // SQLite is the source of truth
    }
  }

  const telegram = await dispatchAlert(alertId, payload);

  return { id: alertId, memoTxHash, telegram };
}

async function listRecentAlerts(limit = 25) {
  const db = getDb();
  return db
    .prepare(
      `SELECT a.*, t.risk_score, t.rvs_score, t.symbol
       FROM alerts a
       LEFT JOIN tokens t ON t.mint = a.mint
       ORDER BY a.fired_at DESC
       LIMIT ?`
    )
    .all(limit);
}

module.exports = { queueAlert, listRecentAlerts };
