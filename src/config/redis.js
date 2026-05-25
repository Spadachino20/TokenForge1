// Redis disabled for Railway - using in-memory alternatives
// To re-enable: uncomment below and install ioredis

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
