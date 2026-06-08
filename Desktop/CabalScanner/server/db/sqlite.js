const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', '..', 'data');
const dbPath = path.join(dataDir, 'cabalscan.db');

let db;

function migrate(db) {
  const cols = db.prepare(`PRAGMA table_info(alerts)`).all().map((c) => c.name);

  if (!cols.includes('outcome')) {
    db.exec(`ALTER TABLE alerts ADD COLUMN outcome TEXT DEFAULT 'pending'`);
  }
  if (!cols.includes('outcome_at')) {
    db.exec(`ALTER TABLE alerts ADD COLUMN outcome_at INTEGER`);
  }
  if (!cols.includes('telegram_sent_at')) {
    db.exec(`ALTER TABLE alerts ADD COLUMN telegram_sent_at INTEGER`);
  }
  if (!cols.includes('telegram_message_id')) {
    db.exec(`ALTER TABLE alerts ADD COLUMN telegram_message_id TEXT`);
  }
  if (!cols.includes('delivery_tier')) {
    db.exec(`ALTER TABLE alerts ADD COLUMN delivery_tier TEXT`);
  }

  const tokenCols = db.prepare(`PRAGMA table_info(tokens)`).all().map((c) => c.name);
  if (!tokenCols.includes('slot')) {
    db.exec(`ALTER TABLE tokens ADD COLUMN slot INTEGER`);
  }
  if (!tokenCols.includes('symbol')) {
    db.exec(`ALTER TABLE tokens ADD COLUMN symbol TEXT`);
  }
  if (!tokenCols.includes('rugged_at')) {
    db.exec(`ALTER TABLE tokens ADD COLUMN rugged_at INTEGER`);
  }
}

function seedDemoData(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM alerts').get().c;
  if (count > 0) return;

  const now = Date.now();
  const day = 86400000;

  const demos = [
    { mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', tier: 'critical', risk: 92, rvs: 88, outcome: 'rugged', daysAgo: 12, rugDelayMin: 23 },
    { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', tier: 'critical', risk: 87, rvs: 91, outcome: 'rugged', daysAgo: 28, rugDelayMin: 8 },
    { mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', tier: 'hard', risk: 71, rvs: 74, outcome: 'survived', daysAgo: 45, rugDelayMin: null },
    { mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', tier: 'soft', risk: 42, rvs: 35, outcome: 'survived', daysAgo: 60, rugDelayMin: null },
    { mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt', tier: 'critical', risk: 95, rvs: 89, outcome: 'rugged', daysAgo: 5, rugDelayMin: 41 },
  ];

  const insertToken = db.prepare(
    `INSERT OR IGNORE INTO tokens (mint, deployer, created_at, updated_at, risk_score, rvs_score, confidence_tier)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertAlert = db.prepare(
    `INSERT INTO alerts (mint, tier, message, memo_tx_hash, fired_at, outcome, outcome_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  for (const d of demos) {
    const firedAt = now - d.daysAgo * day;
    const outcomeAt = d.outcome === 'rugged' ? firedAt + d.rugDelayMin * 60000 : firedAt + 30 * day;
    insertToken.run(d.mint, 'demo', firedAt, firedAt, d.risk, d.rvs, d.tier);
    insertAlert.run(
      d.mint,
      d.tier,
      `Demo ${d.tier} alert — Risk ${d.risk}/100 | RVS ${d.rvs}/100`,
      `demo:${d.mint.slice(0, 8)}`,
      firedAt,
      d.outcome,
      d.outcome === 'pending' ? null : outcomeAt
    );
  }
}

function initDb() {
  fs.mkdirSync(dataDir, { recursive: true });
  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      mint TEXT PRIMARY KEY,
      deployer TEXT,
      symbol TEXT,
      slot INTEGER,
      created_at INTEGER NOT NULL,
      first_snapshot_block INTEGER,
      risk_score REAL DEFAULT 0,
      rvs_score REAL DEFAULT 0,
      confidence_tier TEXT DEFAULT 'none',
      signals_json TEXT DEFAULT '[]',
      graph_json TEXT DEFAULT '{}',
      rugged_at INTEGER,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mint TEXT NOT NULL,
      tier TEXT NOT NULL,
      message TEXT NOT NULL,
      memo_tx_hash TEXT,
      fired_at INTEGER NOT NULL,
      outcome TEXT DEFAULT 'pending',
      outcome_at INTEGER,
      telegram_sent_at INTEGER,
      telegram_message_id TEXT,
      delivery_tier TEXT,
      FOREIGN KEY (mint) REFERENCES tokens(mint)
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signature TEXT,
      event_type TEXT,
      mint TEXT,
      slot INTEGER,
      payload_json TEXT,
      received_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tokens_updated ON tokens(updated_at);
    CREATE INDEX IF NOT EXISTS idx_alerts_mint ON alerts(mint);
    CREATE INDEX IF NOT EXISTS idx_alerts_fired ON alerts(fired_at);
    CREATE INDEX IF NOT EXISTS idx_webhook_events_mint ON webhook_events(mint);
  `);

  migrate(db);
  seedDemoData(db);

  return db;
}

function getDb() {
  if (!db) initDb();
  return db;
}

module.exports = { initDb, getDb };
