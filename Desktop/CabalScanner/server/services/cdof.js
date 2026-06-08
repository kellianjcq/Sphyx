const { isConfigured, queryOperatorByWallet } = require('../lib/supabase');

const NO_MATCH = {
  match: false,
  operatorId: null,
  confidence: 0,
  hopDistance: null,
};

async function matchOperatorFingerprint(event) {
  const deployer = event?.feePayer || event?.feePayerAccount || null;
  if (!deployer) {
    return { ...NO_MATCH };
  }

  if (!isConfigured()) {
    return { ...NO_MATCH, deployer };
  }

  try {
    const hit = await queryOperatorByWallet(deployer);
    if (!hit) {
      return { ...NO_MATCH, deployer };
    }

    const confidence = Number(hit.confidence) || 0;
    return {
      match: confidence >= 0.5,
      operatorId: hit.operator_id,
      confidence,
      deployer,
      hopDistance: hit.hop_distance ?? 0,
      rugCount: hit.rug_count ?? 0,
    };
  } catch (err) {
    console.error('CDOF lookup failed:', err.message);
    return { ...NO_MATCH, deployer };
  }
}

module.exports = { matchOperatorFingerprint };
