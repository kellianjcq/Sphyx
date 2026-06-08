function getConfig() {
  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!rawUrl || !key) return null;

  const url = rawUrl.replace(/\/$/, '');
  return { url, key };
}

function isConfigured() {
  return Boolean(getConfig());
}

async function supabaseFetch(path, options = {}) {
  const config = getConfig();
  if (!config) return null;

  const res = await fetch(`${config.url}${path}`, {
    ...options,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (body.includes('PGRST205')) {
      return null;
    }
    throw new Error(`Supabase error ${res.status}: ${body.slice(0, 200)}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function queryOperatorByWallet(wallet) {
  const direct = await supabaseFetch(
    `/operator_fingerprints?deployer_wallet=eq.${encodeURIComponent(wallet)}&select=*&limit=1`
  );
  if (Array.isArray(direct) && direct[0]) {
    return { ...direct[0], hop_distance: 0 };
  }

  const linked = await supabaseFetch(
    `/operator_wallets?wallet=eq.${encodeURIComponent(wallet)}&select=operator_id,hop_distance&limit=1`
  );
  if (!Array.isArray(linked) || !linked[0]) return null;

  const operator = await supabaseFetch(
    `/operator_fingerprints?operator_id=eq.${encodeURIComponent(linked[0].operator_id)}&select=*&limit=1`
  );
  if (!Array.isArray(operator) || !operator[0]) return null;

  return {
    ...operator[0],
    hop_distance: linked[0].hop_distance ?? 1,
  };
}

async function recordOperatorDeployer(deployer, { operatorId, rugCount = 1, confidence = 0.7 } = {}) {
  const id = operatorId || `op_${deployer.slice(0, 8)}`;
  const rows = await supabaseFetch('/operator_fingerprints?on_conflict=deployer_wallet', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: JSON.stringify({
      operator_id: id,
      deployer_wallet: deployer,
      rug_count: rugCount,
      confidence,
      last_seen_at: new Date().toISOString(),
    }),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function recordRuggedDeployer(deployer) {
  const existing = await queryOperatorByWallet(deployer);
  const rugCount = (existing?.rug_count ?? 0) + 1;
  const confidence = Math.min(0.95, 0.5 + rugCount * 0.1);

  return recordOperatorDeployer(deployer, {
    operatorId: existing?.operator_id,
    rugCount,
    confidence,
  });
}

function getStatus() {
  return {
    configured: isConfigured(),
    url: getConfig()?.url?.replace(/\/rest\/v1.*$/, '') || null,
  };
}

module.exports = {
  isConfigured,
  queryOperatorByWallet,
  recordOperatorDeployer,
  recordRuggedDeployer,
  getStatus,
};
