import { forgePrompt, loadCachedPrompt } from '../prompt-forge.js';
import { showToast } from '../app.js';

let currentPrompt = '';
let isForging = false;

export function initPromptForge(container) {
  container.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <span class="panel-title">Generate a fully live-written system prompt via Claude Sonnet 4.6</span>
        <div class="panel-meta">
          <span id="forge-status"><span class="status-dot"></span> idle</span>
          <span id="word-count">— 0 words</span>
        </div>
      </div>
      <div class="prompt-output" id="prompt-output"></div>
      <div class="forge-controls">
        <div class="forge-info">
          <strong id="prompt-version">SHOVEL SELLER PROTOCOL v2.0</strong>
          <span id="prompt-model"> — claude-sonnet-4-6</span>
        </div>
        <div class="panel-actions">
          <button class="btn" id="btn-copy">copy</button>
          <button class="btn" id="btn-reset">reset</button>
          <button class="btn btn-primary" id="btn-forge">forge</button>
        </div>
      </div>
    </section>
  `;

  document.getElementById('btn-forge').addEventListener('click', startForge);
  document.getElementById('btn-copy').addEventListener('click', copyPrompt);
  document.getElementById('btn-reset').addEventListener('click', resetPrompt);
  loadCached();
}

async function loadCached() {
  setStatus('loading');
  try {
    const data = await loadCachedPrompt();
    currentPrompt = data.prompt;
    renderPrompt(currentPrompt);
    updateWordCount(data.wordCount);
    setStatus('ready');
  } catch {
    setStatus('error');
  }
}

async function startForge() {
  if (isForging) return;
  isForging = true;
  currentPrompt = '';
  renderPrompt('');
  setStatus('forging');
  document.getElementById('btn-forge').disabled = true;

  try {
    await forgePrompt({
      onChunk(text) {
        currentPrompt += text;
        renderPrompt(currentPrompt);
        updateWordCount(countWords(currentPrompt));
      },
      onFallback(data) {
        currentPrompt = data.prompt;
        renderPrompt(currentPrompt);
        updateWordCount(data.wordCount);
        showToast('API key missing — loaded cached v2.0');
      },
    });
    setStatus('forged');
  } catch (err) {
    setStatus('error');
    showToast(err.message);
    await loadCached();
  } finally {
    isForging = false;
    document.getElementById('btn-forge').disabled = false;
  }
}

function renderPrompt(text) {
  const el = document.getElementById('prompt-output');
  el.innerHTML = formatSections(text);
  el.scrollTop = el.scrollHeight;
}

function formatSections(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[([^\]]+)\]/g, '<span class="section-header">[$1]</span>');
}

function updateWordCount(n) {
  document.getElementById('word-count').textContent = `— ${n} words`;
}

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function setStatus(state) {
  const el = document.getElementById('forge-status');
  const labels = {
    idle: 'idle',
    loading: 'loading',
    ready: 'ready',
    forging: 'streaming',
    forged: 'prompt forged',
    error: 'error',
  };
  const live = state === 'forging';
  el.innerHTML = `<span class="status-dot${live ? ' live' : ''}"></span> ${labels[state] || state}`;
}

async function copyPrompt() {
  if (!currentPrompt) return;
  await navigator.clipboard.writeText(currentPrompt);
  showToast('Copied to clipboard');
}

function resetPrompt() {
  if (isForging) return;
  loadCached();
  showToast('Reset to SHOVEL SELLER PROTOCOL v2.0');
}
