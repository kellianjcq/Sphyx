import { showToast } from '../app.js';

export function initAlerts(container) {
  container.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <span class="panel-title">Alert pipeline — Helius ingest → Telegram delivery</span>
        <div class="panel-meta">
          <button class="btn" id="btn-test-webhook">test webhook</button>
          <button class="btn" id="btn-test-telegram">test telegram</button>
          <button class="btn" id="btn-refresh-alerts">refresh</button>
        </div>
      </div>
      <div class="status-grid" id="pipeline-status"></div>
      <div class="panel-header" style="border-top: 1px solid var(--border)">
        <span class="panel-title">Recent alert queue</span>
      </div>
      <div class="alert-feed" id="alert-feed"></div>
    </section>
  `;

  document.getElementById('btn-refresh-alerts').addEventListener('click', loadAll);
  document.getElementById('btn-test-webhook').addEventListener('click', testWebhook);
  document.getElementById('btn-test-telegram').addEventListener('click', testTelegram);
  loadAll();
}

async function loadAll() {
  await Promise.all([loadStatus(), loadFeed()]);
}

async function loadStatus() {
  const el = document.getElementById('pipeline-status');
  try {
    const [helius, telegram] = await Promise.all([
      fetch('/api/helius/status').then((r) => r.json()),
      fetch('/api/telegram/status').then((r) => r.json()),
    ]);

    el.innerHTML = `
      <div class="status-card">
        <span class="status-label">Helius</span>
        <span class="status-value ${helius.configured ? 'ok' : 'off'}">${helius.configured ? 'configured' : 'not configured'}</span>
        <span class="status-detail">${helius.webhookUrl || 'Set PUBLIC_URL + HELIUS_API_KEY'}</span>
      </div>
      <div class="status-card">
        <span class="status-label">Telegram Pro</span>
        <span class="status-value ${telegram.proChannel ? 'ok' : 'off'}">${telegram.proChannel ? 'live' : 'not set'}</span>
        <span class="status-detail">Real-time delivery</span>
      </div>
      <div class="status-card">
        <span class="status-label">Telegram Free</span>
        <span class="status-value ${telegram.freeChannel ? 'ok' : 'off'}">${telegram.freeChannel ? 'live' : 'not set'}</span>
        <span class="status-detail">${telegram.freeDelayMinutes}m delay · ${telegram.pendingDelayed} queued</span>
      </div>
    `;
  } catch {
    el.innerHTML = '<div class="status-card error">Status unavailable</div>';
  }
}

async function loadFeed() {
  const el = document.getElementById('alert-feed');
  try {
    const data = await fetch('/api/telegram/alerts').then((r) => r.json());
    if (!data.alerts?.length) {
      el.innerHTML = '<div class="feed-empty">No alerts fired yet</div>';
      return;
    }

    el.innerHTML = data.alerts
      .map(
        (a) => `
      <div class="feed-item">
        <div class="feed-head">
          <span class="tier-badge tier-${a.tier}">${a.tier}</span>
          <code>${a.mint?.slice(0, 8)}…</code>
          <span class="feed-time">${new Date(a.firedAt).toLocaleString()}</span>
        </div>
        <div class="feed-body">
          Risk ${a.riskScore ?? '—'}/100 · RVS ${a.rvsScore ?? '—'}/100 ·
          <span class="outcome outcome-${a.outcome}">${a.outcome}</span>
          ${a.telegramSentAt ? ` · sent ${a.deliveryTier}` : ' · telegram pending'}
        </div>
      </div>`
      )
      .join('');
  } catch {
    el.innerHTML = '<div class="feed-empty">Failed to load alerts</div>';
  }
}

async function testWebhook() {
  const btn = document.getElementById('btn-test-webhook');
  btn.disabled = true;
  try {
    const res = await fetch('/webhook/helius/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '[]' });
    const data = await res.json();
    showToast(data.processed ? `Processed ${data.processed} test event(s)` : 'Webhook test complete');
    loadAll();
  } catch (err) {
    showToast(err.message);
  } finally {
    btn.disabled = false;
  }
}

async function testTelegram() {
  const btn = document.getElementById('btn-test-telegram');
  btn.disabled = true;
  try {
    const res = await fetch('/api/telegram/test', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('Telegram test sent');
  } catch (err) {
    showToast(err.message);
  } finally {
    btn.disabled = false;
  }
}
