let client = null;
let unavailable = false;

async function getRedis() {
  if (!process.env.REDIS_URL || unavailable) return null;

  if (!client) {
    try {
      const Redis = require('ioredis');
      client = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        retryStrategy: () => null,
      });
      client.on('error', () => {
        if (!unavailable) {
          console.warn('Redis unavailable — using SQLite only');
          unavailable = true;
        }
      });
      await client.connect();
    } catch {
      unavailable = true;
      client = null;
      return null;
    }
  }

  return client;
}

module.exports = { getRedis };
