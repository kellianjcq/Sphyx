const TIER_LABELS = {
  soft: 'Soft Flag',
  hard: 'Hard Flag',
  critical: 'Critical Alert',
};

function formatAlert(analysis) {
  const mint = analysis.mint || 'UNKNOWN';
  const symbol = analysis.symbol ? `$${analysis.symbol}` : shortMint(mint);
  const tier = TIER_LABELS[analysis.confidenceTier] || analysis.confidenceTier;
  const firedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const lines = [
    `<b>${tier}</b> — ${symbol}`,
    `<code>${mint}</code>`,
    `Risk: ${analysis.riskScore}/100 | RVS: ${analysis.rvsScore}/100`,
    `Fired: ${firedAt} UTC`,
  ];

  for (const signal of analysis.signals || []) {
    if (signal.type === 'cabal_cluster') {
      lines.push(
        `Cabal cluster: ${signal.supplyPct}% supply · ${signal.wallets} wallets · ${signal.coordinationSignals} signals`
      );
    }
    if (signal.type === 'operator_fingerprint') {
      lines.push(`Operator: ${signal.operatorId} (${Math.round(signal.confidence * 100)}% match)`);
    }
    if (signal.type === 'rvs_emergency') {
      lines.push(`RVS emergency: ${signal.score}/100`);
    }
    if (signal.type === 'rvs_elevated') {
      lines.push(`RVS elevated: ${signal.score}/100`);
    }
  }

  lines.push('');
  lines.push('<b>Actions</b>');
  lines.push('1. Conservative — exit or avoid new positions');
  lines.push('2. Risk-tolerant — reduce exposure, set tight stops');
  lines.push(`3. Advanced — verify graph: cabalscan.io/verify/${mint}`);

  return lines.join('\n');
}

function formatEvidenceCard(analysis) {
  const mint = analysis.mint || 'UNKNOWN';
  const symbol = analysis.symbol || shortMint(mint);
  const tier = (TIER_LABELS[analysis.confidenceTier] || analysis.confidenceTier).toUpperCase();

  return [
    '┌─ CABALSCAN ─────────────┐',
    `│ ${tier.padEnd(23)}│`,
    `│ ${symbol.padEnd(23)}│`,
    `│ Risk ${String(analysis.riskScore).padStart(3)}/100 · RVS ${String(analysis.rvsScore).padStart(3)}/100 │`,
    '│ On-chain proof attached │',
    '└─────────────────────────┘',
    `solscan.io/token/${mint}`,
  ].join('\n');
}

function shortMint(mint) {
  return mint.length > 8 ? `${mint.slice(0, 4)}...${mint.slice(-4)}` : mint;
}

module.exports = { formatAlert, formatEvidenceCard };
