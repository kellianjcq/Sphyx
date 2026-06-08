/**
 * Rug Velocity Scoring (RVS) — temporal dynamics of rug execution.
 * Models cabal distribution rate, retail accumulation rate, LP depth decay rate.
 */

function calculateRVS(mint, event) {
  const transfers = event?.tokenTransfers?.filter((t) => t.mint === mint) || [];

  let cabalSells = 0;
  let retailBuys = 0;
  let lpDecay = 0;

  for (const t of transfers) {
    const amount = Number(t.tokenAmount) || 0;
    if (t.fromUserAccount && amount > 0) cabalSells += amount;
    if (t.toUserAccount && amount > 0) retailBuys += amount;
  }

  const slot = event?.slot || 1;
  const cabalRate = cabalSells / slot;
  const retailRate = retailBuys / slot;
  const lpDecayRate = lpDecay / slot;

  let score = 0;
  if (retailRate > 0 && cabalRate > 0) {
    const distributionRatio = retailRate / cabalRate;
    if (distributionRatio >= 3) score += 40;
    else if (distributionRatio >= 2) score += 25;
  }

  if (cabalRate > retailRate * 0.5) score += 30;
  if (lpDecayRate > 0) score += Math.min(30, lpDecayRate * 10);

  return {
    score: Math.min(100, Math.round(score)),
    vectors: { cabalRate, retailRate, lpDecayRate },
  };
}

module.exports = { calculateRVS };
