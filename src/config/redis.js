const Redis = require('ioredis');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL;

// Parse URL to handle Upstash auth properly
let redisConfig = {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false
};

if (redisUrl && redisUrl.startsWith('rediss://')) {
  // Upstash / TLS connection
  redisConfig.tls = {};
}

const redis = new Redis(redisUrl, redisConfig);

redis.on('connect', () => {
  console.log('Connected to Redis');
});

redis.on('error', (err) => {
  console.error('Redis error:', err.message);
  // Don't crash - just log
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

module.exports = redis;
