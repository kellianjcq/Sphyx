export async function loadCachedPrompt() {
  const res = await fetch('/api/prompt-forge/cached');
  if (!res.ok) throw new Error('Failed to load cached prompt');
  return res.json();
}

export async function forgePrompt({ onChunk, onFallback }) {
  const res = await fetch('/api/prompt-forge/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instruction: 'Forge the complete CabalScan intelligence system prompt. SHOVEL SELLER PROTOCOL v2.0.',
    }),
  });

  if (res.status === 503) {
    const data = await res.json();
    const cached = await loadCachedPrompt();
    onFallback(cached);
    return;
  }

  if (!res.ok) throw new Error(`Forge failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const payload = JSON.parse(line.slice(6));
        if (payload.text) onChunk(payload.text);
        if (payload.error) throw new Error(payload.error);
      } catch (e) {
        if (e.message !== 'Unexpected end of JSON input') throw e;
      }
    }
  }
}
