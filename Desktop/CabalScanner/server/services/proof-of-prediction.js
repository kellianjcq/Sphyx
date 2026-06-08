const crypto = require('crypto');

/**
 * Proof-of-Prediction Protocol — embed alert hash on-chain via Solana memo program.
 * Production: sign and submit memo tx from CABALSCAN_WALLET_PRIVATE_KEY.
 */
async function recordProofOfPrediction(analysis) {
  const payload = {
    mint: analysis.mint,
    riskScore: analysis.riskScore,
    rvsScore: analysis.rvsScore,
    tier: analysis.confidenceTier,
    signals: analysis.signals,
    timestamp: Date.now(),
  };

  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  if (!process.env.CABALSCAN_WALLET_PRIVATE_KEY) {
    return `pending:${hash.slice(0, 16)}`;
  }

  // TODO: submit Solana memo transaction with { mint, riskScore, hash }
  return `memo:${hash.slice(0, 16)}`;
}

module.exports = { recordProofOfPrediction };
