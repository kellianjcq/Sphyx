const { getDb } = require('../db/sqlite');
const { buildWalletGraph, findCabalClusters } = require('./clustering');
const { calculateRVS } = require('./rvs');
const { matchOperatorFingerprint } = require('./cdof');

const CONFIDENCE_THRESHOLDS = {
  soft: 1,
  hard: 3,
  critical: 5,
};

async function runDetectionPipeline(mint, event = {}) {
  const graph = buildWalletGraph(mint, event);
  const clusters = findCabalClusters(graph);
  const rvs = calculateRVS(mint, event);
  const operator = await matchOperatorFingerprint(event);

  const signals = [];

  for (const cluster of clusters) {
    if (cluster.supplyPct > 15 && cluster.coordinationSignals >= 2) {
      signals.push({
        type: 'cabal_cluster',
        supplyPct: cluster.supplyPct,
        wallets: cluster.wallets.length,
        coordinationSignals: cluster.coordinationSignals,
      });
    }
  }

  if (rvs.score >= 70) {
    signals.push({ type: 'rvs_elevated', score: rvs.score });
  }
  if (rvs.score >= 85) {
    signals.push({ type: 'rvs_emergency', score: rvs.score });
  }
  if (operator.match) {
    signals.push({
      type: 'operator_fingerprint',
      operatorId: operator.operatorId,
      confidence: operator.confidence,
    });
  }

  const signalCount = signals.length;
  let confidenceTier = 'none';
  if (signalCount >= CONFIDENCE_THRESHOLDS.critical || operator.confidence >= 0.8) {
    confidenceTier = 'critical';
  } else if (signalCount >= CONFIDENCE_THRESHOLDS.hard) {
    confidenceTier = 'hard';
  } else if (signalCount >= CONFIDENCE_THRESHOLDS.soft) {
    confidenceTier = 'soft';
  }

  const riskScore = Math.min(100, signalCount * 15 + rvs.score * 0.3 + (operator.confidence || 0) * 20);
  const shouldAlert = confidenceTier === 'critical' || rvs.score >= 85;

  const result = {
    riskScore: Math.round(riskScore),
    rvsScore: rvs.score,
    confidenceTier,
    signals,
    graph: { nodes: graph.nodes.length, edges: graph.edges.length, clusters },
    operator,
    shouldAlert,
  };

  const db = getDb();
  db.prepare(
    `UPDATE tokens SET
      risk_score = ?, rvs_score = ?, confidence_tier = ?,
      signals_json = ?, graph_json = ?, updated_at = ?
     WHERE mint = ?`
  ).run(
    result.riskScore,
    result.rvsScore,
    result.confidenceTier,
    JSON.stringify(signals),
    JSON.stringify(result.graph),
    Date.now(),
    mint
  );

  return result;
}

async function getTokenAnalysis(mint) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM tokens WHERE mint = ?').get(mint);
  if (!row) return null;

  return {
    mint: row.mint,
    deployer: row.deployer,
    riskScore: row.risk_score,
    rvsScore: row.rvs_score,
    confidenceTier: row.confidence_tier,
    signals: JSON.parse(row.signals_json || '[]'),
    graph: JSON.parse(row.graph_json || '{}'),
    updatedAt: row.updated_at,
  };
}

module.exports = { runDetectionPipeline, getTokenAnalysis };
