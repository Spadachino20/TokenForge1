const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redis = require('../config/redis');

// rate-limit-redis v4 requires sendCommand
function makeStore(prefix) {
  return new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix
  });
}

// Rate limit for API key usage (100 req/min)
const apiKeyLimiter = rateLimit({
  store: makeStore('rl:api:'),
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.apiKey || req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: '100 requests per minute per API key'
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limit for auth endpoints (10 req/min)
const authLimiter = rateLimit({
  store: makeStore('rl:auth:'),
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again later'
    });
  }
});

// Rate limit for general API (300 req/min per IP)
const generalLimiter = rateLimit({
  store: makeStore('rl:general:'),
  windowMs: 60 * 1000,
  max: 300,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: '300 requests per minute per IP'
    });
  }
});

module.exports = { apiKeyLimiter, authLimiter, generalLimiter };
