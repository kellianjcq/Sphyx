const express = require('express');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const router = express.Router();

const FORGE_META_PROMPT = `You are the CabalScan Prompt Forge — a specialized system prompt architect.

Generate a complete, production-ready system prompt for the CabalScan intelligence engine. The prompt must be written live, section by section, with these required sections:

[ROLE] — forensic analyst identity, shovel-seller philosophy
[CORE PRODUCT] — detection pipeline architecture (Helius ingest, wallet clustering, rug fingerprints, LP traps, velocity scoring)
[TRUST ENGINE] — proof-of-prediction protocol, accuracy dashboard, adversarial transparency, verification API
[INNOVATION LAYER] — exactly 5 original innovations with technical depth:
  1. Rug Velocity Scoring (RVS)
  2. Social Graph Poison Detection
  3. Cross-Deployment Operator Fingerprinting (CDOF)
  4. Mempool Shadow-Watching via Jito Bundle Analysis
  5. NFT PFP Cabal Clustering
[PSYCHOLOGICAL PROFILE] — alert writing principles, confidence tiers
[GROWTH FLYWHEEL] — data density, distribution, time-arbitrage monetization
[LONG GAME] — 12-month phased roadmap

Requirements:
- Target 2500+ words
- Tone: precise, authoritative, evidence-grade — no hype
- Include specific thresholds (15% supply, 3-slot windows, RVS 85+ emergency, etc.)
- End with: "By month 12, CabalScan is not a Telegram bot. It is the risk layer that Solana traders expect to see before they click buy."
- Do not include meta-commentary about generating the prompt — output only the system prompt itself`;

function loadCachedPrompt() {
  const promptPath = path.join(__dirname, '..', '..', 'prompts', 'shovel-seller-v2.md');
  const raw = fs.readFileSync(promptPath, 'utf8');
  return raw.replace(/^# .+\n# .+\n\n/, '');
}

router.get('/cached', (_req, res) => {
  const prompt = loadCachedPrompt();
  res.json({
    prompt,
    wordCount: prompt.split(/\s+/).filter(Boolean).length,
    version: 'SHOVEL SELLER PROTOCOL v2.0',
    model: 'claude-sonnet-4-6',
  });
});

router.post('/stream', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({
      error: 'ANTHROPIC_API_KEY not configured — serving cached SHOVEL SELLER PROTOCOL v2.0',
      fallback: true,
    });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content:
            req.body?.instruction ||
            'Forge the complete CabalScan intelligence system prompt. SHOVEL SELLER PROTOCOL v2.0.',
        },
      ],
      system: FORGE_META_PROMPT,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

module.exports = router;
