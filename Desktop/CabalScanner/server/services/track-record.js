const { getDb } = require('../db/sqlite');

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function getTrackRecord() {
  const db = getDb();
  const now = Date.now();
  const since90 = now - NINETY_DAYS_MS;

  const totalAlerts = db
    .prepare(`SELECT COUNT(*) as count FROM alerts WHERE fired_at >= ?`)
    .get(since90).count;

  const byTier = db
    .prepare(
      `SELECT tier, COUNT(*) as count FROM alerts WHERE fired_at >= ? GROUP BY tier`
    )
    .all(since90);

  const outcomes = db
    .prepare(
      `SELECT outcome, COUNT(*) as count FROM alerts WHERE fired_at >= ? AND outcome != 'pending' GROUP BY outcome`
    )
    .all(since90);

  const rugged = outcomes.find((o) => o.outcome === 'rugged')?.count || 0;
  const survived = outcomes.find((o) => o.outcome === 'survived')?.count || 0;
  const resolved = rugged + survived;

  const avgTime = db
    .prepare(
      `SELECT AVG(outcome_at - fired_at) as avg_ms
       FROM alerts
       WHERE outcome = 'rugged' AND outcome_at IS NOT NULL AND fired_at >= ?`
    )
    .get(since90);

  const recentAlerts = db
    .prepare(
      `SELECT a.id, a.mint, a.tier, a.memo_tx_hash, a.fired_at, a.outcome, a.outcome_at,
              t.risk_score, t.rvs_score
       FROM alerts a
       LEFT JOIN tokens t ON t.mint = a.mint
       ORDER BY a.fired_at DESC
       LIMIT 25`
    )
    .all();

  const falsePositiveRate = resolved > 0 ? Math.round((survived / resolved) * 1000) / 10 : null;
  const confirmedRugRate = resolved > 0 ? Math.round((rugged / resolved) * 1000) / 10 : null;

  return {
    period: '90d',
    updatedAt: now,
    totalAlerts,
    byTier: Object.fromEntries(byTier.map((r) => [r.tier, r.count])),
    confirmedRugRate,
    falsePositiveRate,
    pendingOutcomes: totalAlerts - resolved,
    avgTimeToRugMs: avgTime?.avg_ms ? Math.round(avgTime.avg_ms) : null,
    avgTimeToRugMinutes: avgTime?.avg_ms ? Math.round(avgTime.avg_ms / 60000) : null,
    recentAlerts: recentAlerts.map(formatAlertRow),
  };
}

function formatAlertRow(row) {
  return {
    id: row.id,
    mint: row.mint,
    shortMint: row.mint?.length > 8 ? `${row.mint.slice(0, 4)}...${row.mint.slice(-4)}` : row.mint,
    tier: row.tier,
    riskScore: row.risk_score,
    rvsScore: row.rvs_score,
    memoTxHash: row.memo_tx_hash,
    firedAt: row.fired_at,
    outcome: row.outcome,
    outcomeAt: row.outcome_at,
    timeToOutcomeMs: row.outcome_at && row.fired_at ? row.outcome_at - row.fired_at : null,
  };
}

function recordOutcome(alertId, outcome) {
  if (!['rugged', 'survived', 'pending'].includes(outcome)) {
    throw new Error('outcome must be rugged, survived, or pending');
  }

  const db = getDb();
  const row = db.prepare('SELECT id FROM alerts WHERE id = ?').get(alertId);
  if (!row) throw new Error('Alert not found');

  const outcomeAt = outcome === 'pending' ? null : Date.now();
  db.prepare(`UPDATE alerts SET outcome = ?, outcome_at = ? WHERE id = ?`).run(
    outcome,
    outcomeAt,
    alertId
  );

  return { alertId, outcome, outcomeAt };
}

function autoResolveSurvived() {
  const db = getDb();
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  const result = db
    .prepare(
      `UPDATE alerts SET outcome = 'survived', outcome_at = ?
       WHERE outcome = 'pending' AND fired_at < ?`
    )
    .run(Date.now(), cutoff);

  return { resolved: result.changes };
}

module.exports = { getTrackRecord, recordOutcome, autoResolveSurvived };
