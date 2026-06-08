require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const promptForgeRouter = require('./routes/prompt-forge');
const verifyRouter = require('./routes/verify');
const webhookRouter = require('./routes/webhook');
const heliusRouter = require('./routes/helius');
const trackRecordRouter = require('./routes/track-record');
const telegramRouter = require('./routes/telegram');
const { initDb } = require('./db/sqlite');
const { autoResolveSurvived } = require('./services/track-record');

const app = express();
const PORT = process.env.PORT || 3847;

initDb();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api/prompt-forge', promptForgeRouter);
app.use('/api/verify', verifyRouter);
app.use('/api/helius', heliusRouter);
app.use('/api/track-record', trackRecordRouter);
app.use('/api/telegram', telegramRouter);
app.use('/webhook', webhookRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'cabalscan', version: '0.1.0' });
});

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next();
  });
});

setInterval(() => autoResolveSurvived(), 60 * 60 * 1000);

app.listen(PORT, () => {
  const publicBase = process.env.PUBLIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN;
  console.log(`CabalScan server listening on http://localhost:${PORT}`);
  if (publicBase) {
    const url = publicBase.startsWith('http') ? publicBase : `https://${publicBase}`;
    console.log(`Public URL: ${url}`);
    console.log(`Webhook: ${url.replace(/\/$/, '')}/webhook/helius`);
  }
});
