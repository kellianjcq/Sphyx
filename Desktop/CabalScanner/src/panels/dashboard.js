export function initDashboard(container) {
  container.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <span class="panel-title">Public Accuracy Dashboard — 90 day window</span>
        <div class="panel-meta">
          <span id="dash-updated">—</span>
          <button class="btn" id="btn-refresh">refresh</button>
        </div>
      </div>
      <div class="dashboard-grid" id="dash-stats">
        <div class="stat-card loading">Loading…</div>
      </div>
      <div class="panel-header" style="border-top: 1px solid var(--border)">
        <span class="panel-title">Recent alerts</span>
      </div>
      <div class="alert-table-wrap">
        <table class="alert-table" id="dash-alerts">
          <thead>
            <tr>
              <th>Token</th>
              <th>Tier</th>
              <th>Risk</th>
              <th>RVS</th>
              <th>Outcome</th>
              <th>Time to rug</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
  `;

  document.getElementById('btn-refresh').addEventListener('click', loadDashboard);
  loadDashboard();
}

async function loadDashboard() {
  try {
    const res = await fetch('/api/track-record');
    const data = await res.json();
    renderStats(data);
    renderAlerts(data.recentAlerts);
    document.getElementById('dash-updated').textContent =
      `updated ${new Date(data.updatedAt).toLocaleString()}`;
  } catch {
    document.getElementById('dash-stats').innerHTML =
      '<div class="stat-card error">Failed to load track record</div>';
  }
}

function renderStats(data) {
  const el = document.getElementById('dash-stats');
  el.innerHTML = `
    <div class="stat-card">
      <span class="stat-label">Total alerts (90d)</span>
      <span class="stat-value">${data.totalAlerts}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Confirmed rug rate</span>
      <span class="stat-value ${data.confirmedRugRate ? 'danger' : ''}">${fmtPct(data.confirmedRugRate)}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">False positive rate</span>
      <span class="stat-value">${fmtPct(data.falsePositiveRate)}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Avg alert → rug</span>
      <span class="stat-value">${data.avgTimeToRugMinutes != null ? `${data.avgTimeToRugMinutes}m` : '—'}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Pending outcomes</span>
      <span class="stat-value warn">${data.pendingOutcomes}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">By tier</span>
      <span class="stat-value stat-small">
        ${Object.entries(data.byTier || {})
          .map(([t, n]) => `${t}: ${n}`)
          .join(' · ') || '—'}
      </span>
    </div>
  `;
}

function renderAlerts(alerts) {
  const tbody = document.querySelector('#dash-alerts tbody');
  if (!alerts?.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">No alerts yet</td></tr>';
    return;
  }

  tbody.innerHTML = alerts
    .map((a) => {
      const timeToRug =
        a.outcome === 'rugged' && a.timeToOutcomeMs
          ? `${Math.round(a.timeToOutcomeMs / 60000)}m`
          : a.outcome === 'survived'
            ? '30d+'
            : '—';
      return `<tr>
        <td><code>${a.shortMint}</code></td>
        <td><span class="tier-badge tier-${a.tier}">${a.tier}</span></td>
        <td>${a.riskScore ?? '—'}</td>
        <td>${a.rvsScore ?? '—'}</td>
        <td><span class="outcome outcome-${a.outcome}">${a.outcome}</span></td>
        <td>${timeToRug}</td>
      </tr>`;
    })
    .join('');
}

function fmtPct(val) {
  return val != null ? `${val}%` : '—';
}
