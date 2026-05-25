const rateLimit = require('express-rate-limit');

// Simple in-memory stores for Railway (Redis optional)
const stores = {};

function makeStore(prefix) {
  return {
    prefix,
    increment: (key) => {
      const fullKey = prefix + key;
      const now = Date.now();
      if (!stores[fullKey]) {
        stores[fullKey] = { count: 1, resetTime: now + 60000 };
      } else {
        if (now > stores[fullKey].resetTime) {
          stores[fullKey] = { count: 1, resetTime: now + 60000 };
        } else {
          stores[fullKey].count++;
        }
      }
      return Promise.resolve({
        totalHits: stores[fullKey].count,
        resetTime: new Date(stores[fullKey].resetTime)
      });
    },
    decrement: (key) => {
      const fullKey = prefix + key;
      if (stores[fullKey]) stores[fullKey].count = Math.max(0, stores[fullKey].count - 1);
      return Promise.resolve();
    },
    resetKey: (key) => {
      delete stores[prefix + key];
      return Promise.resolve();
    }
  };
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
