import { initPromptForge } from './panels/prompt-forge.js';
import { initDashboard } from './panels/dashboard.js';
import { initAlerts } from './panels/alerts.js';

const PANELS = {
  'prompt-forge': { label: 'prompt-forge', init: initPromptForge },
  dashboard: { label: 'track-record', init: initDashboard },
  alerts: { label: 'alerts', init: initAlerts },
};

let activePanel = 'prompt-forge';

export function initApp() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="terminal">
      <header class="terminal-header">
        <h1>CabalScan Intelligence System — Build Terminal</h1>
        <h2 id="panel-title">CABALSCAN /prompt-forge</h2>
        <nav class="nav" id="nav"></nav>
      </header>
      <div id="panel-container"></div>
    </div>
    <div class="toast" id="toast"></div>
  `;

  renderNav();
  navigate(getRoute());
  window.addEventListener('hashchange', () => navigate(getRoute()));
}

function getRoute() {
  const hash = location.hash.replace('#/', '') || 'prompt-forge';
  return PANELS[hash] ? hash : 'prompt-forge';
}

function renderNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = Object.entries(PANELS)
    .map(
      ([id, p]) =>
        `<button class="nav-item${id === activePanel ? ' active' : ''}" data-panel="${id}">${p.label}</button>`
    )
    .join('');

  nav.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      location.hash = `#/${btn.dataset.panel}`;
    });
  });
}

function navigate(panelId) {
  activePanel = panelId;
  document.getElementById('panel-title').textContent = `CABALSCAN /${PANELS[panelId].label}`;
  renderNav();

  const container = document.getElementById('panel-container');
  container.innerHTML = '';
  PANELS[panelId].init(container);
}

export function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}
