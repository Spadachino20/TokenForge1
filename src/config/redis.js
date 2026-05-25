// Redis disabled for Railway - using in-memory alternatives
// To re-enable: uncomment below and install ioredis

/*
const Redis = require('ioredis');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL;
let redisConfig = {
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false
};
if (redisUrl && redisUrl.startsWith('rediss://')) {
  redisConfig.tls = {};
}
const redis = new Redis(redisUrl, redisConfig);
redis.on('connect', () => console.log('Connected to Redis'));
redis.on('error', (err) => console.error('Redis error:', err.message));
module.exports = redis;
*/

// Mock Redis for Railway compatibility
const mockRedis = {
  get: () => Promise.resolve(null),
  set: () => Promise.resolve('OK'),
  setex: () => Promise.resolve('OK'),
  del: () => Promise.resolve(1),
  call: () => Promise.resolve(null),
  on: () => {},
};

module.exports = mockRedis;
