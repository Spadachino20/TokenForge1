const { Pool } = require('pg');
require('dotenv').config();

// Fix DATABASE_URL: encode special chars in password (e.g. ! -> %21)
function fixDbUrl(url) {
  if (!url) return url;
  try {
    // Extract and re-encode the password portion
    const match = url.match(/^(postgresql:\/\/[^:]+:)([^@]+)(@.+)$/);
    if (match) {
      const password = decodeURIComponent(match[2]); // decode if already encoded
      const encoded = encodeURIComponent(password);  // re-encode properly
      return match[1] + encoded + match[3];
    }
  } catch (e) {}
  return url;
}

const pool = new Pool({
  connectionString: fixDbUrl(process.env.DATABASE_URL),
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
