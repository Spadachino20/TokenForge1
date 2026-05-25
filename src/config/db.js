const { Pool } = require('pg');
require('dotenv').config();

// Parse DATABASE_URL to handle IPv6 issues on Railway
let connectionString = process.env.DATABASE_URL || '';

// If it's a Supabase URL with IPv6 address, try to use connection pooler
if (connectionString.includes('[2600:') || connectionString.includes('@db.')) {
  // Supabase pooler uses IPv4 and works better from Railway
  connectionString = connectionString.replace('@db.', '@aws-0-us-east-1.pooler.supabase.com:6543/');
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
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
