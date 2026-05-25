const { Pool } = require('pg');
require('dotenv').config();

const isRailway = process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_SERVICE_NAME;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRailway || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('PostgreSQL error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
